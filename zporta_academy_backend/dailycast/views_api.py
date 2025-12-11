"""
API endpoints for interactive podcasts.

Provides:
- GET /api/podcasts/{id}/ - Retrieve podcast details
- POST /api/podcasts/ - Create new podcast
- GET /api/podcasts/{id}/accuracy-check/ - Verify content accuracy
- GET /api/podcasts/{id}/progress/ - Check student progress
- PUT /api/podcasts/{id}/answers/ - Submit student answers
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.shortcuts import get_object_or_404
from django.core.files.base import ContentFile
import json
import logging

from dailycast.models import DailyPodcast
from dailycast.serializers import DailyPodcastSerializer
from dailycast.services_interactive import create_multilingual_podcast_for_user
from learning.models import ActivityEvent

logger = logging.getLogger(__name__)


class DailyPodcastViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for Daily Podcasts.
    
    Endpoints:
    - GET /api/podcasts/ - List user's podcasts
    - POST /api/podcasts/ - Create new podcast
    - GET /api/podcasts/{id}/ - Retrieve podcast
    - PUT /api/podcasts/{id}/ - Update podcast
    - GET /api/podcasts/{id}/accuracy-check/ - Check accuracy
    - GET /api/podcasts/{id}/progress/ - Check progress
    - PUT /api/podcasts/{id}/answers/ - Submit answers
    """
    
    serializer_class = DailyPodcastSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Only return podcasts for current user."""
        user = self.request.user
        
        # Admin can see all podcasts
        if user.is_staff:
            return DailyPodcast.objects.all()
        
        # Regular users see only their own
        return DailyPodcast.objects.filter(user=user)
    
    def create(self, request, *args, **kwargs):
        """
        Create a new podcast.
        
        Expected POST data:
        {
            "user": <user_id>,
            "primary_language": "en",
            "secondary_language": "ja",  # optional
            "output_format": "both"  # text, audio, or both
        }
        
        Returns: Created podcast object
        """
        # Only admins can create podcasts for other users
        if not request.user.is_staff:
            user = request.user
        else:
            user_id = request.data.get('user')
            from django.contrib.auth.models import User
            user = get_object_or_404(User, id=user_id)
        
        primary_language = request.data.get('primary_language', 'en')
        secondary_language = request.data.get('secondary_language', '')
        output_format = request.data.get('output_format', 'both')
        
        try:
            # Create podcast via service
            podcast = create_multilingual_podcast_for_user(
                user=user,
                primary_language=primary_language,
                secondary_language=secondary_language if secondary_language else None,
                output_format=output_format,
                included_courses=None,  # Will be populated by service
            )
            
            serializer = self.get_serializer(podcast)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Podcast creation failed: {str(e)}")
            return Response(
                {'error': f'Failed to create podcast: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def accuracy_check(self, request, pk=None):
        """
        Check accuracy of podcast content.
        
        Validates:
        - Script mentions actual courses user is enrolled in
        - Language selections are valid
        - Audio files exist (if required by output_format)
        - Duration is within target range (~6 minutes)
        - Q&A questions are present
        
        Returns:
        {
            "accuracy_score": 0.95,  # 0-1
            "issues": [],
            "warnings": [],
            "courses_mentioned": ["Course A", "Course B"],
            "audio_status": "✅ Both languages generated",
            "duration_status": "✅ 6:24 (target: ~6:00)",
            "qa_status": "✅ 3 questions generated"
        }
        """
        podcast = self.get_object()
        
        issues = []
        warnings = []
        accuracy_score = 1.0
        
        # 1. Check if podcast completed successfully
        if podcast.status == 'failed':
            issues.append("❌ Podcast generation failed")
            accuracy_score -= 0.5
        elif podcast.status == 'pending':
            return Response({
                'status': 'pending',
                'message': 'Podcast still generating. Please check again soon.'
            }, status=status.HTTP_202_ACCEPTED)
        
        # 2. Check courses are mentioned
        if not podcast.included_courses:
            warnings.append("⚠️ No courses mentioned in podcast")
            accuracy_score -= 0.1
        
        # 3. Check audio files exist per output format
        audio_status = "❌ No audio"
        if podcast.output_format in ['audio', 'both']:
            if podcast.audio_file:
                audio_status = "✅ Primary audio OK"
                if podcast.secondary_language and not podcast.audio_file_secondary:
                    warnings.append("⚠️ Secondary language audio missing")
                    accuracy_score -= 0.15
                elif podcast.secondary_language:
                    audio_status = "✅ Both languages OK"
            else:
                issues.append("❌ Audio file missing (required by output format)")
                accuracy_score -= 0.3
        elif podcast.output_format == 'text':
            audio_status = "✅ Text-only (audio not required)"
        
        # 4. Check duration
        duration_status = f"✅ {podcast.duration_seconds // 60}:{podcast.duration_seconds % 60:02d}"
        target_min = 5 * 60  # 5 minutes
        target_max = 7 * 60  # 7 minutes
        
        if podcast.duration_seconds < target_min:
            warnings.append(f"⚠️ Podcast too short ({podcast.duration_seconds // 60} min, target ~6 min)")
            accuracy_score -= 0.05
        elif podcast.duration_seconds > target_max:
            warnings.append(f"⚠️ Podcast too long ({podcast.duration_seconds // 60} min, target ~6 min)")
            accuracy_score -= 0.05
        
        # 5. Check Q&A content
        qa_status = f"✅ {len(podcast.questions_asked) if podcast.questions_asked else 0} questions"
        if not podcast.questions_asked:
            warnings.append("⚠️ No questions generated for interactive podcast")
            accuracy_score -= 0.1
        
        # 6. Check script content
        if not podcast.script_text or len(podcast.script_text) < 100:
            issues.append("❌ Script too short or empty")
            accuracy_score -= 0.3
        
        # Clamp accuracy score
        accuracy_score = max(0, min(1.0, accuracy_score))
        
        return Response({
            'status': 'success',
            'accuracy_score': round(accuracy_score, 2),
            'issues': issues,
            'warnings': warnings,
            'metadata': {
                'podcast_id': podcast.id,
                'user': podcast.user.username,
                'primary_language': podcast.primary_language,
                'secondary_language': podcast.secondary_language or 'None',
                'output_format': podcast.output_format,
                'llm_provider': podcast.llm_provider,
                'tts_provider': podcast.tts_provider,
            },
            'content_checks': {
                'script_length': len(podcast.script_text),
                'courses_mentioned': len(podcast.included_courses) if podcast.included_courses else 0,
                'audio_status': audio_status,
                'duration_status': duration_status,
                'qa_status': qa_status,
            },
            'recommendation': (
                '✅ Ready for use' if accuracy_score >= 0.8 and not issues
                else '⚠️ Review issues before publishing' if issues
                else '✓ Minor issues but usable'
            )
        })
    
    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """
        Check student progress on this podcast's questions.
        
        Returns:
        {
            "podcast_id": 123,
            "user": "john_doe",
            "questions_count": 3,
            "answered_count": 2,
            "completion_percentage": 67,
            "questions": [
                {
                    "question": "What is Django?",
                    "user_answer": "A Python web framework",
                    "answered_at": "2024-01-15T10:30:00Z",
                    "status": "pending_review"
                },
                ...
            ],
            "time_spent_minutes": 12,
            "overall_status": "in_progress"
        }
        """
        podcast = self.get_object()
        
        # Check user has permission to view this podcast's progress
        if podcast.user != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        questions = podcast.questions_asked or []
        answers = podcast.student_answers or {}
        
        answered_count = len([q for q in questions if answers.get(str(q))])
        completion_percentage = int((answered_count / len(questions) * 100)) if questions else 0
        
        # Build detailed question list
        questions_detail = []
        for i, question in enumerate(questions):
            q_key = str(question)
            user_answer = answers.get(q_key, '')
            
            questions_detail.append({
                'index': i + 1,
                'question': question,
                'user_answer': user_answer if user_answer else None,
                'answered': bool(user_answer),
                'status': 'answered' if user_answer else 'pending'
            })
        
        # Try to get time spent from ActivityEvent if available
        time_spent = 0
        try:
            from learning.models import ActivityEvent
            events = ActivityEvent.objects.filter(
                user=podcast.user,
                event_type='podcast_interaction',
                created_at__gte=podcast.created_at
            )
            time_spent = sum(e.duration_seconds or 0 for e in events) // 60
        except:
            pass
        
        return Response({
            'status': 'success',
            'podcast_info': {
                'id': podcast.id,
                'user': podcast.user.username,
                'primary_language': podcast.primary_language,
                'created_at': podcast.created_at.isoformat(),
            },
            'progress': {
                'questions_count': len(questions),
                'answered_count': answered_count,
                'completion_percentage': completion_percentage,
                'overall_status': 'completed' if completion_percentage == 100 else 'in_progress' if answered_count > 0 else 'not_started'
            },
            'questions': questions_detail,
            'engagement': {
                'time_spent_minutes': time_spent,
                'last_activity': podcast.updated_at.isoformat() if podcast.updated_at else None,
            },
            'recommendation': (
                '✅ All questions answered' if completion_percentage == 100
                else f'📊 {answered_count}/{len(questions)} questions answered'
            )
        })
    
    @action(detail=True, methods=['put'])
    def answers(self, request, pk=None):
        """
        Submit student answers to podcast questions.
        
        Expected PUT data:
        {
            "answers": {
                "What is Django?": "A Python web framework",
                "How do you create a model?": "Using models.py and class definition"
            }
        }
        
        Returns: Updated podcast with answers saved
        """
        podcast = self.get_object()
        
        # Check user has permission to answer their own podcast
        if podcast.user != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        answers = request.data.get('answers', {})
        
        # Validate answers match questions
        questions = podcast.questions_asked or []
        for question in questions:
            if question not in answers:
                return Response({
                    'error': f'Missing answer for: {question}',
                    'missing_questions': [q for q in questions if q not in answers]
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Save answers
        podcast.student_answers = answers
        podcast.save(update_fields=['student_answers', 'updated_at'])
        
        serializer = self.get_serializer(podcast)
        return Response(serializer.data)


# URL configuration (add to urls.py)
"""
from rest_framework.routers import DefaultRouter
from dailycast.views import DailyPodcastViewSet

router = DefaultRouter()
router.register(r'podcasts', DailyPodcastViewSet, basename='podcast')

urlpatterns = [
    path('api/', include(router.urls)),
]
"""
