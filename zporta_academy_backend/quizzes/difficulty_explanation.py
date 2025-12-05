"""
Serializer method field to explain AI quiz difficulty ranking.

This is used in QuizSerializer to show:
- Difficulty level (5-level categorization)
- Confidence score
- Brief explanation of the ranking
"""

from django.contrib.contenttypes.models import ContentType
from intelligence.models import ContentDifficultyProfile
from quizzes.models import Question


def get_difficulty_explanation(quiz_obj):
    """
    Generate a detailed explanation of why the quiz received its difficulty rating.
    
    Returns dict with:
    {
        'difficulty_score': 672.18,
        'difficulty_level': 'Very Hard',
        'level_5': 'Medium ➜ Hard',  # 5-level categorization
        'emoji': '🔶',
        'confidence': 85,
        'explanation': 'This quiz is ranked as Medium-Hard because...',
        'factors': {
            'success_rate': 42.6,
            'attempt_count': 94,
            'unique_users': 28,
            'avg_question_difficulty': 550.5,
            'reasons': [...]
        }
    }
    """
    
    quiz_ct = ContentType.objects.get_for_model(quiz_obj.__class__)
    
    # Get difficulty profile
    try:
        diff_profile = ContentDifficultyProfile.objects.get(
            content_type=quiz_ct,
            object_id=quiz_obj.id
        )
        difficulty_score = diff_profile.computed_difficulty_score
        success_rate = diff_profile.success_rate
        attempt_count = diff_profile.attempt_count
    except ContentDifficultyProfile.DoesNotExist:
        difficulty_score = 400.0
        success_rate = 50.0
        attempt_count = 0
    
    # Determine 5-level category
    if difficulty_score < 320:
        level = "Beginner"
        level_5 = "Beginner"
        emoji = "🟢"
    elif difficulty_score < 420:
        level = "Easy"
        level_5 = "Beginner ➜ Medium"
        emoji = "🟡"
    elif difficulty_score < 520:
        level = "Medium"
        level_5 = "Medium"
        emoji = "🟠"
    elif difficulty_score < 620:
        level = "Hard"
        level_5 = "Medium ➜ Hard"
        emoji = "🔶"
    else:
        level = "Very Hard"
        level_5 = "Hard/Expert"
        emoji = "🔴"
    
    # Calculate average question difficulty
    questions = quiz_obj.questions.all()
    avg_q_difficulty = 0
    if questions.exists():
        question_difficulties = []
        question_ct = ContentType.objects.get_for_model(Question)
        for q in questions:
            try:
                q_profile = ContentDifficultyProfile.objects.get(
                    content_type=question_ct,
                    object_id=q.id
                )
                question_difficulties.append(q_profile.computed_difficulty_score)
            except:
                pass
        if question_difficulties:
            avg_q_difficulty = sum(question_difficulties) / len(question_difficulties)
    
    # Determine confidence level
    if attempt_count >= 30:
        confidence = 95
        confidence_level = "Very High"
    elif attempt_count >= 10:
        confidence = 75
        confidence_level = "High"
    elif attempt_count >= 5:
        confidence = 60
        confidence_level = "Medium"
    else:
        confidence = 40
        confidence_level = "Low"
    
    # Build explanation reasons
    reasons = []
    
    if success_rate < 30:
        reasons.append(f"Very low success rate ({success_rate:.1f}%) - Most users find this quiz challenging")
    elif success_rate < 50:
        reasons.append(f"Low success rate ({success_rate:.1f}%) - Many users struggle with this quiz")
    elif success_rate < 70:
        reasons.append(f"Moderate success rate ({success_rate:.1f}%) - Balanced difficulty for most users")
    else:
        reasons.append(f"High success rate ({success_rate:.1f}%) - Most users can solve this quiz")
    
    if avg_q_difficulty > 600:
        reasons.append(f"Questions are very difficult (avg {avg_q_difficulty:.1f})")
    elif avg_q_difficulty > 500:
        reasons.append(f"Questions are challenging (avg {avg_q_difficulty:.1f})")
    elif avg_q_difficulty > 400:
        reasons.append(f"Questions are moderate difficulty (avg {avg_q_difficulty:.1f})")
    else:
        reasons.append(f"Questions are easier (avg {avg_q_difficulty:.1f})")
    
    if attempt_count > 30:
        reasons.append(f"Based on {attempt_count} attempts - highly reliable ranking")
    elif attempt_count > 10:
        reasons.append(f"Based on {attempt_count} attempts - fairly reliable ranking")
    else:
        reasons.append(f"Based on {attempt_count} attempts - limited data for ranking")
    
    # Build explanation text
    explanation = (
        f"This quiz is rated as '{level_5}' difficulty. "
        f"{reasons[0]} "
        f"{reasons[1] if len(reasons) > 1 else ''} "
        f"{reasons[2] if len(reasons) > 2 else ''}"
    )
    
    return {
        'difficulty_score': round(difficulty_score, 2),
        'difficulty_level': level,
        'level_5': level_5,
        'emoji': emoji,
        'confidence': confidence,
        'confidence_level': confidence_level,
        'explanation': explanation.strip(),
        'factors': {
            'success_rate': round(success_rate, 1),
            'attempt_count': attempt_count,
            'avg_question_difficulty': round(avg_q_difficulty, 1),
            'reasons': reasons
        }
    }
