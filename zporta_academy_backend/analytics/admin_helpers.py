# analytics/admin_helpers.py
"""
Helper views for admin to easily track quiz/question analytics
"""
from django.db.models import Count, Avg, Q, F
from django.contrib.contenttypes.models import ContentType
from .models import ActivityEvent


def get_quiz_session_details(session_id):
    """
    Get all events for a quiz session with question-level breakdown
    Returns easy-to-read dict with per-question timing and hints
    """
    events = ActivityEvent.objects.filter(
        session_id=session_id,
        event_type='quiz_answer_submitted'
    ).order_by('timestamp')
    
    questions = []
    for event in events:
        meta = event.metadata or {}
        questions.append({
            'question_id': meta.get('question_id'),
            'time_spent_seconds': (meta.get('time_spent_ms') or 0) / 1000,
            'hints_used': meta.get('hints_used', []),
            'is_correct': meta.get('is_correct', False),
            'attempt_number': meta.get('attempt_index', 1),
            'answered_at': event.timestamp.isoformat(),
        })
    
    # Get completion event if exists
    completion = ActivityEvent.objects.filter(
        session_id=session_id,
        event_type='quiz_completed'
    ).first()
    
    total_time = None
    if completion and completion.metadata:
        total_time_ms = completion.metadata.get('total_time_ms')
        total_time = total_time_ms / 1000 if total_time_ms else None
    
    return {
        'session_id': str(session_id),
        'questions': questions,
        'total_questions': len(questions),
        'total_time_seconds': total_time,
        'completed': completion is not None,
    }


def get_question_analytics(question_id):
    """
    Get analytics for a specific question across all users
    """
    from quizzes.models import Question
    question_ct = ContentType.objects.get_for_model(Question)
    
    events = ActivityEvent.objects.filter(
        content_type=question_ct,
        object_id=question_id,
        event_type='quiz_answer_submitted'
    )
    
    total = events.count()
    correct = events.filter(metadata__is_correct=True).count()
    
    # Average time spent
    times = [
        e.metadata.get('time_spent_ms', 0) 
        for e in events 
        if e.metadata and e.metadata.get('time_spent_ms')
    ]
    avg_time_seconds = (sum(times) / len(times) / 1000) if times else 0
    
    # Hints usage
    hint1_used = events.filter(metadata__hints_used__contains=[1]).count()
    hint2_used = events.filter(metadata__hints_used__contains=[2]).count()
    
    return {
        'question_id': question_id,
        'total_attempts': total,
        'correct_attempts': correct,
        'accuracy_percent': round((correct / total * 100) if total > 0 else 0, 2),
        'avg_time_seconds': round(avg_time_seconds, 2),
        'hint1_usage': hint1_used,
        'hint2_usage': hint2_used,
        'hint_usage_percent': round((hint1_used + hint2_used) / total * 100 if total > 0 else 0, 2),
    }


def get_user_quiz_history(user_id, quiz_id=None):
    """
    Get all quiz attempts for a user, with timing and completion status
    """
    from quizzes.models import Quiz
    quiz_ct = ContentType.objects.get_for_model(Quiz)
    
    filters = {
        'user_id': user_id,
        'event_type__in': ['quiz_started', 'quiz_completed'],
        'content_type': quiz_ct,
    }
    
    if quiz_id:
        filters['object_id'] = quiz_id
    
    events = ActivityEvent.objects.filter(**filters).order_by('-timestamp')
    
    sessions = {}
    for event in events:
        sid = event.session_id
        if not sid:
            continue
            
        if sid not in sessions:
            sessions[sid] = {
                'session_id': str(sid),
                'quiz_id': event.object_id,
                'started_at': None,
                'completed_at': None,
                'total_time_ms': None,
                'questions_completed': 0,
            }
        
        if event.event_type == 'quiz_started':
            sessions[sid]['started_at'] = event.timestamp.isoformat()
        elif event.event_type == 'quiz_completed':
            sessions[sid]['completed_at'] = event.timestamp.isoformat()
            if event.metadata:
                sessions[sid]['total_time_ms'] = event.metadata.get('total_time_ms')
                sessions[sid]['questions_completed'] = event.metadata.get('questions_completed', 0)
    
    return list(sessions.values())
