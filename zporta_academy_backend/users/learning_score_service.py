# users/learning_score_service.py
"""
Learning Score Service - Calculates user learning scores based on:
- Unique correct quiz questions (+1 each)
- Completed lessons (+1 each)
- Enrolled courses (+2 free / +3 premium)
"""
from django.db.models import Q
from django.contrib.contenttypes.models import ContentType
from analytics.models import ActivityEvent
from lessons.models import LessonCompletion
from enrollment.models import Enrollment
from courses.models import Course

# Try to import Quiz and Question models
try:
    from quizzes.models import Quiz, Question
    QUIZ_MODELS_AVAILABLE = True
except ImportError:
    QUIZ_MODELS_AVAILABLE = False


def compute_learning_score(user):
    """
    Compute learning score breakdown for a user.
    
    Args:
        user: Django User instance
        
    Returns:
        dict with:
            - total_score: int
            - quiz_items: list of dicts (quiz_id, quiz_title, question_id, question_text, points)
            - lesson_items: list of dicts (course_id, course_title, lesson_id, lesson_title, points)
            - course_items: list of dicts (course_id, course_title, is_free, is_premium, points)
    """
    
    # === 1. Quiz questions: +1 per unique question answered correctly ===
    quiz_items = []
    quiz_score = 0
    
    # Get all correct answers (MySQL-compatible approach - deduplicate in Python)
    # Order by newest first (-timestamp)
    correct_answers = ActivityEvent.objects.filter(
        user=user,
        event_type='quiz_answer_submitted',
        metadata__is_correct=True,
        metadata__has_key='question_id'
    ).order_by('-timestamp')
    
    # Track unique questions to avoid double-counting
    seen_questions = set()
    
    for event in correct_answers:
        question_id = event.metadata.get('question_id')
        
        # Skip if we've already counted this question
        if question_id in seen_questions:
            continue
            
        seen_questions.add(question_id)
        
        # Try to get actual titles from database
        quiz_id = event.metadata.get('quiz_id')
        quiz_title = event.metadata.get('quiz_title') or event.metadata.get('related_object_title', 'Quiz')
        quiz_permalink = event.metadata.get('quiz_permalink')
        question_text = event.metadata.get('question_text', 'Question')
        subject_name = None
        
        # If we have Quiz models available and quiz_id, fetch real data
        if QUIZ_MODELS_AVAILABLE and quiz_id:
            try:
                quiz = Quiz.objects.select_related('subject').filter(id=quiz_id).first()
                if quiz:
                    quiz_title = quiz.title
                    if hasattr(quiz, 'permalink'):
                        quiz_permalink = quiz.permalink
                    if quiz.subject:
                        subject_name = quiz.subject.name
                    
                    # Try to get the question text
                    if question_id:
                        question = Question.objects.filter(id=question_id).first()
                        if question and question.question_text:
                            question_text = question.question_text[:200]  # Limit length
            except Exception as e:
                # Silently fail and use metadata values
                pass
        
        quiz_items.append({
            'quiz_id': quiz_id,
            'quiz_title': quiz_title,
            'quiz_permalink': quiz_permalink,
            'question_id': question_id,
            'question_text': question_text,
            'subject': subject_name,
            'answered_at': event.timestamp.isoformat() if event.timestamp else None,
            'points': 1
        })
        quiz_score += 1
    
    # === 2. Lessons: +1 per completed lesson ===
    lesson_items = []
    lesson_score = 0
    
    lesson_completions = LessonCompletion.objects.filter(
        user=user
    ).select_related('lesson', 'lesson__course', 'lesson__course__subject').order_by('-completed_at')
    
    for completion in lesson_completions:
        lesson = completion.lesson
        course = lesson.course
        subject_name = course.subject.name if course and course.subject else None
        
        lesson_items.append({
            'course_id': course.id if course else None,
            'course_title': course.title if course else None,
            'lesson_id': lesson.id,
            'lesson_title': lesson.title,
            'lesson_permalink': lesson.permalink,
            'subject': subject_name,
            'completed_at': completion.completed_at.isoformat() if completion.completed_at else None,
            'points': 1
        })
        lesson_score += 1
    
    # === 3. Enrolled courses: +2 free / +3 premium ===
    course_items = []
    course_score = 0
    
    course_content_type = ContentType.objects.get_for_model(Course)
    enrollments = Enrollment.objects.filter(
        user=user,
        content_type=course_content_type,
        enrollment_type='course'
    ).select_related('content_type')
    
    # Track unique courses to avoid double-counting
    processed_courses = set()
    
    for enrollment in enrollments:
        course = enrollment.content_object
        if not course or course.id in processed_courses:
            continue
            
        processed_courses.add(course.id)
        
        # Determine if free or premium
        is_free = course.course_type == 'free' or (course.price is None or course.price == 0)
        is_premium = not is_free
        points = 2 if is_free else 3
        subject_name = course.subject.name if hasattr(course, 'subject') and course.subject else None
        
        course_items.append({
            'course_id': course.id,
            'course_title': course.title,
            'course_permalink': course.permalink,
            'subject': subject_name,
            'is_free': is_free,
            'is_premium': is_premium,
            'points': points
        })
        course_score += points
    
    # === Return complete breakdown ===
    total_score = quiz_score + lesson_score + course_score
    
    return {
        'total_score': total_score,
        'quiz_items': quiz_items,
        'lesson_items': lesson_items,
        'course_items': course_items,
        'breakdown': {
            'quiz_score': quiz_score,
            'lesson_score': lesson_score,
            'course_score': course_score
        }
    }


def compute_impact_score(user):
    """
    Compute the impact score for a teacher based on student activity.
    Tracks how students engage with this teacher's content.
    
    Scoring:
    - For each enrollment in teacher's courses: +2 (free) or +3 (premium)
    - For each unique question answered by each unique user: +1
    
    Args:
        user: Django User instance
        
    Returns:
        dict with:
            - total_score: int
            - course_items: list of course enrollments with points
            - quiz_items: list of unique question answers by students
    """
    
    # === 1. Course Enrollments (students enrolling in teacher's courses) ===
    course_items = []
    course_score = 0
    
    # Find courses created by this teacher
    teacher_courses = Course.objects.filter(created_by=user).select_related('subject')
    course_content_type = ContentType.objects.get_for_model(Course)
    
    # Track processed enrollments to avoid duplicates
    processed_enrollments = set()
    
    for course in teacher_courses:
        # Determine course type and points
        is_free = course.course_type == 'free' or (course.price is None or course.price == 0)
        is_premium = not is_free
        points = 2 if is_free else 3
        
        # Find enrollments in this course
        enrollments = Enrollment.objects.filter(
            content_type=course_content_type,
            object_id=course.id,
            enrollment_type='course'
        ).exclude(user=user).select_related('user').order_by('-enrollment_date')
        
        subject_name = course.subject.name if course.subject else None
        
        for enrollment in enrollments:
            # Create unique key to avoid counting same enrollment twice
            enroll_key = (enrollment.user_id, course.id)
            if enroll_key in processed_enrollments:
                continue
            processed_enrollments.add(enroll_key)
            
            course_items.append({
                'course_id': course.id,
                'course_title': course.title,
                'course_permalink': course.permalink,
                'subject': subject_name,
                'student_id': enrollment.user.id,
                'student_username': enrollment.user.username,
                'student_name': enrollment.user.get_full_name() or enrollment.user.username,
                'enrolled_at': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
                'is_free': is_free,
                'is_premium': is_premium,
                'points': points
            })
            course_score += points
    
    # === 2. Quiz Questions Answered (unique user+question combinations) ===
    quiz_items = []
    quiz_score = 0
    
    if QUIZ_MODELS_AVAILABLE:
        # Find quizzes created by this teacher
        teacher_quiz_ids = list(Quiz.objects.filter(created_by=user).values_list('id', flat=True))
        
        if teacher_quiz_ids:
            # Get all quiz answer events for teacher's quizzes
            answer_events = ActivityEvent.objects.filter(
                event_type='quiz_answer_submitted',
                metadata__quiz_id__in=teacher_quiz_ids
            ).exclude(user=user).select_related('user').order_by('-timestamp')
            
            # Track unique (user, question) pairs
            seen_user_questions = set()
            
            for event in answer_events:
                metadata = event.metadata or {}
                question_id = metadata.get('question_id')
                quiz_id = metadata.get('quiz_id')
                
                if not question_id or not quiz_id:
                    continue
                
                # Create unique key for this user+question combination
                user_question_key = (event.user_id, question_id)
                if user_question_key in seen_user_questions:
                    continue
                
                seen_user_questions.add(user_question_key)
                
                # Fetch quiz and question details
                try:
                    quiz = Quiz.objects.select_related('subject').get(id=quiz_id)
                    question = Question.objects.get(id=question_id)
                    
                    quiz_title = quiz.title
                    quiz_permalink = quiz.permalink
                    question_text = question.question_text[:200] if question.question_text else "Question"
                    subject_name = quiz.subject.name if quiz.subject else None
                except (Quiz.DoesNotExist, Question.DoesNotExist):
                    quiz_title = metadata.get('quiz_title', metadata.get('related_object_title', 'Quiz'))
                    quiz_permalink = None
                    question_text = "Question"
                    subject_name = None
                
                quiz_items.append({
                    'quiz_id': quiz_id,
                    'quiz_title': quiz_title,
                    'quiz_permalink': quiz_permalink,
                    'question_id': question_id,
                    'question_text': question_text,
                    'subject': subject_name,
                    'student_id': event.user.id if event.user else None,
                    'student_username': event.user.username if event.user else 'unknown',
                    'student_name': event.user.get_full_name() if event.user else 'Unknown',
                    'answered_at': event.timestamp.isoformat() if event.timestamp else None,
                    'points': 1
                })
                quiz_score += 1
    
    # === Return complete breakdown ===
    total_score = course_score + quiz_score
    
    return {
        'total_score': total_score,
        'course_items': course_items,
        'quiz_items': quiz_items,
        'breakdown': {
            'course_score': course_score,
            'quiz_score': quiz_score
        }
    }


def compute_learning_analytics(user):
    """
    Compute detailed learning analytics for a student.
    Provides insights into study patterns, strengths, and areas for improvement.
    
    Returns rich analytics including:
    - Most/least enrolled courses with lesson completion status
    - Quiz performance patterns (correct, wrong, repeated attempts)
    - Latest interactions and inactive courses
    - Recommendations for improvement
    """
    analytics = {
        'courses': {},
        'quizzes': {},
        'lessons': {},
        'recommendations': []
    }
    
    # === Course Analytics ===
    enrollments = Enrollment.objects.filter(user=user).select_related('content_type')
    course_content_type = ContentType.objects.get_for_model(Course)
    
    course_enrollments = enrollments.filter(
        content_type=course_content_type,
        enrollment_type='course'
    ).order_by('-enrollment_date')
    
    # Track course completion rates
    course_stats = []
    for enrollment in course_enrollments[:20]:  # Limit to recent 20
        try:
            course = Course.objects.select_related('subject').get(id=enrollment.object_id)
            total_lessons = course.lessons.count() if hasattr(course, 'lessons') else 0
            completed_lessons = LessonCompletion.objects.filter(
                user=user,
                lesson__course=course
            ).count()
            
            completion_rate = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
            
            course_stats.append({
                'id': course.id,
                'title': course.title,
                'permalink': course.permalink,
                'subject': course.subject.name if course.subject else None,
                'enrolled_date': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
                'total_lessons': total_lessons,
                'completed_lessons': completed_lessons,
                'completion_rate': round(completion_rate, 1)
            })
        except Course.DoesNotExist:
            continue
    
    # Sort by different criteria
    analytics['courses']['latest_enrolled'] = course_stats[:5]
    analytics['courses']['most_incomplete'] = sorted(
        [c for c in course_stats if c['completion_rate'] < 100 and c['total_lessons'] > 0],
        key=lambda x: (x['total_lessons'] - x['completed_lessons'], -x['completion_rate']),
        reverse=True
    )[:5]
    analytics['courses']['most_complete'] = sorted(
        [c for c in course_stats if c['completion_rate'] > 0],
        key=lambda x: x['completion_rate'],
        reverse=True
    )[:5]
    
    # === Quiz Analytics ===
    if QUIZ_MODELS_AVAILABLE:
        # Get all quiz answer events
        quiz_events = ActivityEvent.objects.filter(
            user=user,
            event_type='quiz_answer_submitted'
        ).order_by('-timestamp')
        
        # Track per-question statistics
        question_stats = {}
        quiz_stats = {}
        # Collect quiz metadata (title/permalink) from events to avoid DB lookups
        quiz_meta = {}
        
        for event in quiz_events:
            metadata = event.metadata or {}
            quiz_id = metadata.get('quiz_id')
            question_id = metadata.get('question_id')
            is_correct = metadata.get('is_correct', False)
            
            if not quiz_id or not question_id:
                continue
            # Prefer latest seen title/permalink for this quiz id
            q_title = metadata.get('quiz_title')
            q_permalink = metadata.get('quiz_permalink')
            if (q_title or q_permalink):
                quiz_meta[quiz_id] = {
                    'title': q_title or quiz_meta.get(quiz_id, {}).get('title'),
                    'permalink': q_permalink or quiz_meta.get(quiz_id, {}).get('permalink')
                }
            
            # Question-level stats
            if question_id not in question_stats:
                question_stats[question_id] = {
                    'quiz_id': quiz_id,
                    'total_attempts': 0,
                    'correct_attempts': 0,
                    'wrong_attempts': 0,
                    'first_try_correct': None,
                    'last_timestamp': None
                }
            
            stats = question_stats[question_id]
            stats['total_attempts'] += 1
            stats['last_timestamp'] = event.timestamp
            
            if stats['first_try_correct'] is None:
                stats['first_try_correct'] = is_correct
            
            if is_correct:
                stats['correct_attempts'] += 1
            else:
                stats['wrong_attempts'] += 1
            
            # Quiz-level stats
            if quiz_id not in quiz_stats:
                quiz_stats[quiz_id] = {
                    'total_questions': set(),
                    'correct_first_try': 0,
                    'wrong_attempts': 0,
                    'repeated_questions': 0
                }
            
            quiz_stats[quiz_id]['total_questions'].add(question_id)
            if stats['first_try_correct']:
                quiz_stats[quiz_id]['correct_first_try'] += 1
            if not is_correct:
                quiz_stats[quiz_id]['wrong_attempts'] += 1
            if stats['total_attempts'] > 1:
                quiz_stats[quiz_id]['repeated_questions'] += 1
        
        # Analyze patterns
        most_mistakes = sorted(
            [{'question_id': qid, **qstats} for qid, qstats in question_stats.items()],
            key=lambda x: x['wrong_attempts'],
            reverse=True
        )[:10]
        
        most_repeated = sorted(
            [{'question_id': qid, **qstats} for qid, qstats in question_stats.items()],
            key=lambda x: x['total_attempts'],
            reverse=True
        )[:10]
        
        fast_correct = [
            {'question_id': qid, **qstats}
            for qid, qstats in question_stats.items()
            if qstats['first_try_correct'] and qstats['total_attempts'] == 1
        ][:10]
        
        # Enrich with quiz and question titles
        try:
            quiz_cache = {}
            for item_list in [most_mistakes, most_repeated, fast_correct]:
                for item in item_list:
                    quiz_id = item.get('quiz_id')
                    question_id = item.get('question_id')

                    # Prefer metadata-derived info first
                    if quiz_id in quiz_meta:
                        item['quiz_title'] = quiz_meta[quiz_id].get('title') or item.get('quiz_title') or f'Quiz {quiz_id}'
                        item['quiz_permalink'] = quiz_meta[quiz_id].get('permalink') or item.get('quiz_permalink')
                    # Fall back to DB lookup if available
                    elif QUIZ_MODELS_AVAILABLE and quiz_id and quiz_id not in quiz_cache:
                        try:
                            quiz = Quiz.objects.get(id=quiz_id)
                            quiz_cache[quiz_id] = {
                                'title': quiz.title,
                                'permalink': quiz.permalink
                            }
                        except Exception:
                            quiz_cache[quiz_id] = {'title': f'Quiz {quiz_id}', 'permalink': None}
                    if quiz_id in quiz_cache and quiz_id not in quiz_meta:
                        item['quiz_title'] = quiz_cache[quiz_id]['title']
                        item['quiz_permalink'] = quiz_cache[quiz_id]['permalink']

                    # Fetch question title if model available, otherwise leave as fallback
                    if question_id and 'question_title' not in item:
                        try:
                            if QUIZ_MODELS_AVAILABLE:
                                question = Question.objects.get(id=question_id)
                                item['question_title'] = (getattr(question, 'text', None) or getattr(question, 'title', '') or '').strip()[:100] or f'Question {question_id}'
                        except Exception:
                            item['question_title'] = f'Question {question_id}'
        except Exception:
            # If enrichment fails, continue without titles
            pass
        
        analytics['quizzes']['most_mistakes'] = most_mistakes
        analytics['quizzes']['most_repeated'] = most_repeated
        analytics['quizzes']['fast_correct'] = fast_correct
        analytics['quizzes']['total_questions_attempted'] = len(question_stats)
        analytics['quizzes']['total_quizzes'] = len(quiz_stats)
    
    # === Lesson Analytics ===
    recent_completions = LessonCompletion.objects.filter(
        user=user
    ).select_related('lesson__course__subject').order_by('-completed_at')[:10]
    
    analytics['lessons']['recent_completed'] = []
    for lc in recent_completions:
        lesson_data = {
            'lesson_id': lc.lesson.id,
            'lesson_title': lc.lesson.title,
            'lesson_permalink': lc.lesson.permalink,
            'course_title': None,
            'subject': None,
            'completed_at': lc.completed_at.isoformat()
        }
        
        # Safely get course and subject
        if lc.lesson.course:
            lesson_data['course_title'] = lc.lesson.course.title
            if lc.lesson.course.subject:
                lesson_data['subject'] = lc.lesson.course.subject.name
        
        analytics['lessons']['recent_completed'].append(lesson_data)
    
    # === Recommendations ===
    if analytics['courses']['most_incomplete']:
        top_incomplete = analytics['courses']['most_incomplete'][0]
        analytics['recommendations'].append({
            'type': 'course_completion',
            'priority': 'high',
            'message': f"Complete '{top_incomplete['title']}' - {top_incomplete['completed_lessons']}/{top_incomplete['total_lessons']} lessons done ({top_incomplete['completion_rate']}%)",
            'course_id': top_incomplete['id'],
            'course_permalink': top_incomplete['permalink']
        })
    
    if analytics['quizzes'].get('most_mistakes'):
        analytics['recommendations'].append({
            'type': 'review_mistakes',
            'priority': 'medium',
            'message': f"Review {len(analytics['quizzes']['most_mistakes'])} questions you got wrong multiple times"
        })
    
    return analytics


def compute_impact_analytics(user):
    """
    Compute detailed impact analytics for a teacher.
    Provides insights into content performance and student engagement.
    
    Returns rich analytics including:
    - Most popular courses, quizzes, lessons
    - Engagement metrics and completion rates
    - Student performance on teacher's content
    - Recommendations for content improvement
    """
    analytics = {
        'courses': {},
        'quizzes': {},
        'lessons': {},
        'recommendations': []
    }
    
    # === Course Analytics ===
    teacher_courses = Course.objects.filter(created_by=user).select_related('subject')
    course_content_type = ContentType.objects.get_for_model(Course)
    
    course_stats = []
    for course in teacher_courses:
        # Count enrollments
        enrollment_count = Enrollment.objects.filter(
            content_type=course_content_type,
            object_id=course.id,
            enrollment_type='course'
        ).exclude(user=user).count()
        
        # Count lesson completions
        total_lessons = course.lessons.count() if hasattr(course, 'lessons') else 0
        lesson_completions = LessonCompletion.objects.filter(
            lesson__course=course
        ).exclude(user=user).count()
        
        avg_completion_rate = 0
        if enrollment_count > 0 and total_lessons > 0:
            avg_completion_rate = (lesson_completions / (enrollment_count * total_lessons)) * 100
        
        course_stats.append({
            'id': course.id,
            'title': course.title,
            'permalink': course.permalink,
            'subject': course.subject.name if course.subject else None,
            'enrollment_count': enrollment_count,
            'total_lessons': total_lessons,
            'lesson_completions': lesson_completions,
            'avg_completion_rate': round(avg_completion_rate, 1),
            'is_free': course.course_type == 'free' or (course.price is None or course.price == 0)
        })
    
    analytics['courses']['most_enrolled'] = sorted(
        course_stats,
        key=lambda x: x['enrollment_count'],
        reverse=True
    )[:5]
    
    analytics['courses']['highest_completion'] = sorted(
        [c for c in course_stats if c['avg_completion_rate'] > 0],
        key=lambda x: x['avg_completion_rate'],
        reverse=True
    )[:5]
    
    analytics['courses']['needs_attention'] = sorted(
        [c for c in course_stats if c['enrollment_count'] > 0 and c['avg_completion_rate'] < 50],
        key=lambda x: x['enrollment_count'],
        reverse=True
    )[:5]
    
    # === Quiz Analytics ===
    if QUIZ_MODELS_AVAILABLE:
        teacher_quizzes = Quiz.objects.filter(created_by=user).select_related('subject')
        
        quiz_stats = []
        for quiz in teacher_quizzes:
            # Count attempts
            attempt_count = ActivityEvent.objects.filter(
                event_type='quiz_answer_submitted',
                metadata__quiz_id=quiz.id
            ).exclude(user=user).values('user').distinct().count()
            
            # Count total answers
            total_answers = ActivityEvent.objects.filter(
                event_type='quiz_answer_submitted',
                metadata__quiz_id=quiz.id
            ).exclude(user=user).count()
            
            # Count correct answers
            correct_answers = ActivityEvent.objects.filter(
                event_type='quiz_answer_submitted',
                metadata__quiz_id=quiz.id,
                metadata__is_correct=True
            ).exclude(user=user).count()
            
            accuracy_rate = (correct_answers / total_answers * 100) if total_answers > 0 else 0
            
            quiz_stats.append({
                'id': quiz.id,
                'title': quiz.title,
                'permalink': quiz.permalink,
                'subject': quiz.subject.name if quiz.subject else None,
                'attempt_count': attempt_count,
                'total_answers': total_answers,
                'correct_answers': correct_answers,
                'accuracy_rate': round(accuracy_rate, 1)
            })
        
        analytics['quizzes']['most_attempted'] = sorted(
            quiz_stats,
            key=lambda x: x['attempt_count'],
            reverse=True
        )[:5]
        
        analytics['quizzes']['highest_accuracy'] = sorted(
            [q for q in quiz_stats if q['total_answers'] >= 10],  # Min 10 answers
            key=lambda x: x['accuracy_rate'],
            reverse=True
        )[:5]
        
        analytics['quizzes']['challenging'] = sorted(
            [q for q in quiz_stats if q['total_answers'] >= 10],
            key=lambda x: x['accuracy_rate']
        )[:5]
    
    # === Recommendations ===
    if analytics['courses'].get('needs_attention'):
        top_concern = analytics['courses']['needs_attention'][0]
        analytics['recommendations'].append({
            'type': 'improve_course',
            'priority': 'high',
            'message': f"Course '{top_concern['title']}' has low completion rate ({top_concern['avg_completion_rate']}%) with {top_concern['enrollment_count']} students",
            'course_id': top_concern['id'],
            'course_permalink': top_concern['permalink']
        })
    
    if analytics['quizzes'].get('challenging'):
        tough_quiz = analytics['quizzes']['challenging'][0]
        if tough_quiz['accuracy_rate'] < 40:
            analytics['recommendations'].append({
                'type': 'review_quiz',
                'priority': 'medium',
                'message': f"Quiz '{tough_quiz['title']}' is very challenging ({tough_quiz['accuracy_rate']}% accuracy) - consider reviewing difficulty",
                'quiz_id': tough_quiz['id'],
                'quiz_permalink': tough_quiz['permalink']
            })
    
    if analytics['courses']['most_enrolled']:
        popular = analytics['courses']['most_enrolled'][0]
        analytics['recommendations'].append({
            'type': 'success',
            'priority': 'low',
            'message': f"Great job! '{popular['title']}' has {popular['enrollment_count']} students enrolled",
            'course_id': popular['id'],
            'course_permalink': popular['permalink']
        })
    
    return analytics
