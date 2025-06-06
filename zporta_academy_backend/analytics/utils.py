# analytics/utils.py
import logging
from django.utils import timezone
from datetime import timedelta
from django.contrib.contenttypes.models import ContentType
from django.db.models import F, Avg, Count, Q # Import Q
import math
import os 
from django.conf import settings 

# Import newly used libraries
import pandas as pd
import numpy as np
from sklearn.dummy import DummyClassifier 
from sklearn.model_selection import train_test_split 
import joblib 

from .models import ActivityEvent, MemoryStat 

try:
    from quizzes.models import Quiz, Question as QuizzesQuestion
    QUIZ_MODEL_AVAILABLE = True
except ImportError:
    Quiz, QuizzesQuestion = None, None
    QUIZ_MODEL_AVAILABLE = False
    logging.warning("analytics.utils: Quizzes app models (Quiz, Question) not available.")

try:
    from users.models import Profile as UserProfile 
    PROFILE_MODEL_AVAILABLE = True
except ImportError:
    UserProfile = None
    PROFILE_MODEL_AVAILABLE = False
    logging.info("analytics.utils: UserProfile model not found.")


logger = logging.getLogger(__name__)

# --- AI Model Constants & Setup ---
AI_MODEL_DIR = os.path.join(settings.BASE_DIR, 'analytics_ai_models')
DIFFICULTY_MODEL_FILENAME = 'question_difficulty_predictor_v1.joblib'
DIFFICULTY_MODEL_PATH = os.path.join(AI_MODEL_DIR, DIFFICULTY_MODEL_FILENAME)

def ensure_ai_model_dir_and_placeholder_model():
    """Ensures the AI model directory exists and creates a placeholder model if none exists."""
    os.makedirs(AI_MODEL_DIR, exist_ok=True)
    if not os.path.exists(DIFFICULTY_MODEL_PATH):
        try:
            model = DummyClassifier(strategy="uniform") 
            X_dummy = np.random.rand(10, 3) 
            y_dummy = np.random.choice(['easy', 'medium', 'hard'], 10)
            model.fit(X_dummy, y_dummy)
            joblib.dump(model, DIFFICULTY_MODEL_PATH)
            logger.info(f"Placeholder AI difficulty model created and saved to {DIFFICULTY_MODEL_PATH}")
        except Exception as e:
            logger.error(f"Could not create placeholder AI model: {e}", exc_info=True)

ensure_ai_model_dir_and_placeholder_model()


# --- Event Logging ---
def log_event(user, event_type, instance=None, metadata=None, related_object=None):
    if metadata is None: metadata = {}
    if related_object and hasattr(related_object, 'pk') and hasattr(related_object, '_meta'):
        try:
            related_ct = ContentType.objects.get_for_model(related_object.__class__)
            metadata.setdefault('related_object_type', related_ct.model)
            metadata.setdefault('related_object_id', related_object.pk)
            if hasattr(related_object, 'title'):
                 metadata.setdefault('related_object_title', str(related_object.title)[:100])
        except Exception as e:
            logger.error(f"log_event: Error processing related_object: {e}", exc_info=True)

    valid_event_types = [choice[0] for choice in ActivityEvent.EVENT_CHOICES]
    if event_type not in valid_event_types:
        logger.error(f"log_event: Invalid event_type '{event_type}'.")
        return
    try:
        ct, obj_id = (None, None)
        if instance and hasattr(instance, '_meta') and hasattr(instance, 'pk'):
            ct = ContentType.objects.get_for_model(instance.__class__)
            obj_id = instance.pk
        elif instance:
            logger.warning(f"log_event: 'instance' provided but is not a valid model instance: {type(instance)}")

        ActivityEvent.objects.create(
            user=user if user and user.is_authenticated else None, 
            event_type=event_type, content_type=ct, object_id=obj_id,
            metadata=metadata, timestamp=timezone.now()
        )
        if PROFILE_MODEL_AVAILABLE and UserProfile and event_type == 'quiz_answer_submitted' and metadata.get('is_correct') and user and user.is_authenticated:
            try:
                profile, _ = UserProfile.objects.get_or_create(user=user)
                profile.growth_score = F('growth_score') + 1
                profile.save(update_fields=['growth_score'])
            except Exception as e:
                 logger.error(f"log_event: Failed to update growth_score for user {user.id}: {e}", exc_info=True)
    except Exception as e:
        user_id_for_log = user.id if user and hasattr(user, 'id') else 'System'
        logger.error(f"log_event: Failed to log event {event_type} for user {user_id_for_log}. Error: {e}", exc_info=True)


# --- AI-Assisted Difficulty Prediction ---
def get_ai_assisted_difficulty_prediction(memory_stat_instance):
    model = None
    try:
        model = joblib.load(DIFFICULTY_MODEL_PATH)
    except FileNotFoundError:
        logger.warning(f"AI difficulty model not found at {DIFFICULTY_MODEL_PATH}. Ensure placeholder or real model exists.")
        return "unknown (model_not_found)"
    except Exception as e:
        logger.error(f"Error loading AI difficulty model: {e}. Prediction unavailable.", exc_info=True)
        return "unknown (load_error)"

    if model is None: 
        return "unknown (model_none_after_load_attempt)"

    features_list = [
        memory_stat_instance.repetitions or 0,
        memory_stat_instance.easiness_factor or 2.5, 
        memory_stat_instance.interval_days or 0,
    ]
    features = np.array([features_list]) 

    try:
        if not hasattr(model, 'classes_'): # Check for classifier attribute
            logger.warning("Loaded AI model does not have 'classes_' attribute. Assuming regression or misconfiguration.")
            # Attempt a direct prediction if it's not a classifier with predict_proba
            prediction_val = model.predict(features)[0]
            return {"predicted_value": float(prediction_val)} # Example for regression

        prediction_proba = model.predict_proba(features)[0] 
        difficulty_scores = dict(zip(model.classes_, prediction_proba))
        predicted_difficulty_class = model.predict(features)[0] 

        logger.info(f"AI Predicted difficulty for item_id {memory_stat_instance.object_id} (stat_id {memory_stat_instance.id}): Class={predicted_difficulty_class}, Scores={difficulty_scores}")
        return {
            "predicted_class": predicted_difficulty_class,
            "scores": {k: float(v) for k, v in difficulty_scores.items()} # Ensure scores are JSON serializable
        }
    except Exception as e:
        logger.error(f"Error during AI prediction for item_id {memory_stat_instance.object_id}: {e}. Defaulting difficulty.", exc_info=True)
        return {"predicted_class": "unknown (prediction_error)"}


# --- MemoryStat Update (SM-2) with AI Insight Logging ---
def update_memory_stat_item(user, learnable_item, quality_of_recall, time_spent_ms=None):
    if not user or not hasattr(user, 'pk') or not user.is_authenticated:
        logger.warning("update_memory_stat_item: Valid, authenticated 'user' instance is required.")
        return None
    if not learnable_item or not hasattr(learnable_item, 'pk') or not hasattr(learnable_item, '_meta'):
        logger.warning(f"update_memory_stat_item: Valid 'learnable_item' model instance is required. Received: {type(learnable_item)}")
        return None
    if not isinstance(quality_of_recall, int) or not (0 <= quality_of_recall <= 5):
        logger.warning(f"update_memory_stat_item: 'quality_of_recall' must be an integer between 0 and 5. Received: {quality_of_recall}")
        return None
    if time_spent_ms is not None and (not isinstance(time_spent_ms, int) or time_spent_ms < 0):
        logger.warning(f"update_memory_stat_item: 'time_spent_ms' must be a non-negative integer. Received: {time_spent_ms}")
        time_spent_ms = None

    try:
        content_type = ContentType.objects.get_for_model(learnable_item.__class__)
    except Exception as e:
        logger.error(f"update_memory_stat_item: Could not get ContentType for {learnable_item.__class__.__name__}. Error: {e}")
        return None

    stat, created = MemoryStat.objects.get_or_create(
        user=user, content_type=content_type, object_id=learnable_item.pk,
        defaults={
            'learnable_item': learnable_item, 'easiness_factor': 2.5, 'repetitions': 0,
            'interval_days': 0.0, 'last_reviewed_at': timezone.now(),
            'current_retention_estimate': 1.0, 'last_quality_of_recall': quality_of_recall,
            'last_time_spent_ms': time_spent_ms, 'ai_insights': {} 
        }
    )
    if not created:
        if not stat.learnable_item: stat.learnable_item = learnable_item
        stat.last_quality_of_recall = quality_of_recall
        stat.last_time_spent_ms = time_spent_ms
    
    q = quality_of_recall
    if q >= 3: 
        stat.easiness_factor += (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        if stat.easiness_factor < 1.3: stat.easiness_factor = 1.3
        stat.repetitions += 1
        if stat.repetitions == 1: stat.interval_days = 1.0
        elif stat.repetitions == 2: stat.interval_days = 6.0
        else: stat.interval_days = math.ceil(stat.interval_days * stat.easiness_factor)
    else: 
        stat.repetitions = 0
        stat.interval_days = 1.0
    
    stat.interval_days = min(stat.interval_days, 365.0 * 2) 
    if q >=3 and stat.interval_days < 1.0: stat.interval_days = 1.0

    stat.last_reviewed_at = timezone.now()
    stat.next_review_at = stat.last_reviewed_at + timedelta(days=float(stat.interval_days))
    stat.current_retention_estimate = 1.0

    ai_prediction_data = get_ai_assisted_difficulty_prediction(stat)
    if stat.ai_insights is None: stat.ai_insights = {} 
    stat.ai_insights['difficulty_prediction'] = ai_prediction_data 
    stat.ai_insights['last_prediction_timestamp'] = timezone.now().isoformat()
    
    try:
        stat.save()
        predicted_class_log = "N/A"
        if isinstance(ai_prediction_data, dict): # Check if it's a dict before accessing
            predicted_class_log = ai_prediction_data.get('predicted_class', 'N/A')
        elif isinstance(ai_prediction_data, str): # Handle string case from error/not found
            predicted_class_log = ai_prediction_data

        logger.info(
            f"MemoryStat Updated: User {user.id}, Item {content_type.model}#{learnable_item.pk}, "
            f"Q={q}, Reps={stat.repetitions}, EF={stat.easiness_factor:.2f}, "
            f"Int={stat.interval_days:.1f}d, Next={stat.next_review_at.strftime('%Y-%m-%d') if stat.next_review_at else 'N/A'}, "
            f"Time={time_spent_ms}ms, AI_Difficulty={predicted_class_log}"
        )
        return stat
    except Exception as e:
        logger.error(f"Failed to save MemoryStat for User {user.id}, Item {content_type.model}#{learnable_item.pk}. Error: {e}", exc_info=True)
        return None

# --- Analytics Reporting (Using Pandas, Numpy) ---
def generate_question_performance_report(days_history=30):
    if not QUIZ_MODEL_AVAILABLE or not QuizzesQuestion:
        logger.warning("generate_question_performance_report: QuizzesQuestion model not available.")
        return None

    cutoff_date = timezone.now() - timedelta(days=days_history)
    try:
        question_ct = ContentType.objects.get_for_model(QuizzesQuestion)
    except Exception as e:
        logger.error(f"Could not get ContentType for QuizzesQuestion: {e}")
        return None

    # Corrected filter to avoid repeating 'metadata__has_key'
    answer_events_qs = ActivityEvent.objects.filter(
        Q(metadata__has_key='time_spent_ms') & Q(metadata__has_key='is_correct'), # Ensure both keys exist
        content_type=question_ct,
        event_type='quiz_answer_submitted',
        timestamp__gte=cutoff_date,
        # We also need quiz_id in metadata for context if grouping by quiz later,
        # but for now, we are grouping by question_id (object_id)
        # metadata__has_key='quiz_id' # Optional, if you need it for further grouping
    ).values(
        'object_id', 
        'metadata__time_spent_ms',
        'metadata__is_correct',
        'metadata__quiz_id' 
    )
    
    if not answer_events_qs.exists():
        logger.info("generate_question_performance_report: No relevant answer events found.")
        return "No data for report."

    df = pd.DataFrame(list(answer_events_qs))
    if df.empty:
        logger.info("generate_question_performance_report: DataFrame is empty after initial load.")
        return "No data for report after DataFrame creation."

    df.rename(columns={
        'object_id': 'question_id', 
        'metadata__time_spent_ms': 'time_spent_ms',
        'metadata__is_correct': 'is_correct',
        'metadata__quiz_id': 'quiz_id'
    }, inplace=True)
    
    df['time_spent_ms'] = pd.to_numeric(df['time_spent_ms'], errors='coerce')
    df['is_correct'] = df['is_correct'].apply(lambda x: bool(x) if x is not None else None) 
    df.dropna(subset=['question_id', 'time_spent_ms', 'is_correct'], inplace=True)

    if df.empty:
        logger.info("generate_question_performance_report: DataFrame is empty after cleaning.")
        return "Not enough clean data for report."

    report = df.groupby('question_id').agg(
        total_attempts=('is_correct', 'count'), 
        average_time_spent_seconds=('time_spent_ms', lambda x: np.mean(x) / 1000 if pd.Series(x).notna().any() else 0),
        correctness_rate=('is_correct', lambda x: np.mean(x) * 100 if pd.Series(x).notna().any() else 0)
    ).reset_index()

    report['average_time_spent_seconds'] = report['average_time_spent_seconds'].round(2)
    report['correctness_rate'] = report['correctness_rate'].round(2)
    
    report_json_str = report.to_json(orient='records') 
    
    log_event(
        user=None, event_type='analytics_report_generated',
        metadata={
            'report_type': 'question_performance', 'days_history': days_history,
            'questions_analyzed': len(report), 
            'report_data_summary_json': report_json_str 
        }
    )
    logger.info(f"Generated Question Performance Report analyzing {len(report)} questions.")
    return report.to_dict(orient='records') 


def predict_overall_quiz_retention_days(user, quiz_instance):
    if not QUIZ_MODEL_AVAILABLE or not Quiz: return 0
    if not user or not isinstance(quiz_instance, Quiz): return 0
    try:
        quiz_content_type = ContentType.objects.get_for_model(Quiz)
        stat = MemoryStat.objects.filter(user=user, content_type=quiz_content_type, object_id=quiz_instance.pk).first()
        if stat and stat.next_review_at:
            days_until = (stat.next_review_at - timezone.now()).total_seconds() / (60*60*24)
            return math.ceil(days_until) if days_until > 0 else 0
        elif stat and not stat.last_reviewed_at : return 1 
        elif not stat: 
            last_activity = ActivityEvent.objects.filter(
                user=user, content_type=quiz_content_type, object_id=quiz_instance.id,
                event_type__in=['quiz_completed', 'quiz_submitted', 'quiz_answer_submitted']
            ).order_by('-timestamp').first()
            if last_activity:
                days_since = (timezone.now() - last_activity.timestamp).days
                if days_since <= 1: return 7 
                if days_since <= 7: return 3  
                return 1 
            return 1 
        return 1 
    except Exception as e:
        logger.error(f"Error in predict_overall_quiz_retention_days for user {user.id}, quiz {quiz_instance.id}: {e}", exc_info=True)
        return 0
