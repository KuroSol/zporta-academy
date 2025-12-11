import logging

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail

from dailycast.services import create_podcast_for_user

logger = logging.getLogger(__name__)


@shared_task(name="dailycast.generate_podcast_for_test_user")
def generate_podcast_for_test_user(language: str | None = None) -> int:
    """Celery task to generate a podcast for the configured test user."""
    User = get_user_model()
    test_user_id = getattr(settings, "DAILYCAST_TEST_USER_ID", None)
    if not test_user_id:
        raise ValueError("DAILYCAST_TEST_USER_ID is not configured")

    try:
        user = User.objects.get(id=test_user_id)
    except User.DoesNotExist as exc:
        logger.error("Dailycast: test user %s not found", test_user_id)
        raise exc

    podcast = create_podcast_for_user(
        user,
        language=language or getattr(settings, "DAILYCAST_DEFAULT_LANGUAGE", "en"),
    )
    logger.info("Dailycast: generated podcast %s for user %s", podcast.id, user.id)
    return podcast.id


# ============================================================================
# INTERACTIVE PODCAST TASKS
# ============================================================================

@shared_task(bind=True, max_retries=3)
def generate_podcast_async(self, user_id, primary_language='en', 
                          secondary_language=None, output_format='both'):
    """
    Generate a podcast asynchronously for interactive system.
    
    Args:
        user_id (int): Django User ID
        primary_language (str): Primary language code (en, ja, es, etc.)
        secondary_language (str): Secondary language code (optional)
        output_format (str): Output format (text, audio, or both)
    
    Returns:
        dict: {'success': True, 'podcast_id': 123}
    """
    try:
        from dailycast.services_interactive import create_multilingual_podcast_for_user
        
        User = get_user_model()
        logger.info(f"[Task {self.request.id}] Starting podcast generation for user {user_id}")
        
        # Get user
        user = User.objects.get(id=user_id)
        logger.info(f"[Task {self.request.id}] User: {user.username}")
        
        # Generate podcast
        podcast = create_multilingual_podcast_for_user(
            user=user,
            primary_language=primary_language,
            secondary_language=secondary_language,
            output_format=output_format,
            included_courses=None,  # Service will populate this
        )
        
        logger.info(f"[Task {self.request.id}] ✅ Podcast generated: {podcast.id}")
        
        # Send notification email if enabled
        if getattr(settings, 'SEND_PODCAST_NOTIFICATION', True):
            send_podcast_notification_email.delay(podcast.id)
        
        return {
            'success': True,
            'podcast_id': podcast.id,
            'status': podcast.status,
            'duration': f"{podcast.duration_seconds // 60}:{podcast.duration_seconds % 60:02d}",
        }
    
    except User.DoesNotExist:
        logger.error(f"[Task {self.request.id}] User {user_id} not found")
        return {'success': False, 'error': f'User {user_id} not found'}
    
    except Exception as exc:
        logger.error(f"[Task {self.request.id}] Error: {str(exc)}", exc_info=True)
        
        # Retry after 60 seconds with exponential backoff
        retry_count = self.request.retries
        countdown = 60 * (2 ** retry_count)
        
        try:
            raise self.retry(exc=exc, countdown=countdown)
        except self.MaxRetriesExceededError:
            logger.error(f"[Task {self.request.id}] Max retries exceeded")
            return {'success': False, 'error': f'Max retries exceeded: {str(exc)}'}


@shared_task
def send_podcast_notification_email(podcast_id):
    """
    Send email notification when podcast is ready.
    
    Args:
        podcast_id (int): Podcast ID
    """
    try:
        from dailycast.models import DailyPodcast
        
        podcast = DailyPodcast.objects.get(id=podcast_id)
        
        if podcast.status != 'completed':
            logger.info(f"Podcast {podcast_id} not completed yet (status: {podcast.status})")
            return
        
        subject = f"🎧 Your Daily Podcast is Ready! ({podcast.primary_language.upper()})"
        
        languages = podcast.primary_language.upper()
        if podcast.secondary_language:
            languages += f" + {podcast.secondary_language.upper()}"
        
        format_text = {
            'text': 'as a text script',
            'audio': 'as audio',
            'both': 'as text & audio',
        }.get(podcast.output_format, podcast.output_format)
        
        message = f"""
        Hi {podcast.user.first_name or podcast.user.username},

        Your personalized daily podcast is ready!

        📊 Details:
        - Languages: {languages}
        - Format: {format_text}
        - Duration: {podcast.duration_seconds // 60}:{podcast.duration_seconds % 60:02d}
        - Questions: {len(podcast.questions_asked) if podcast.questions_asked else 0} interactive questions

        🎯 Your podcast mentions courses you're studying:
        """
        
        if podcast.included_courses:
            for course in podcast.included_courses:
                message += f"\n        - {course}"
        else:
            message += "\n        (General content)"
        
        message += f"""

        📚 Next Steps:
        1. Listen/read your personalized content
        2. Answer the interactive questions
        3. Review feedback on your understanding

        You can access your podcast at:
        {settings.FRONTEND_URL}/podcasts/{podcast.id}

        Happy learning! 🚀

        ---
        Daily Podcast System
        """
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [podcast.user.email],
            fail_silently=True,
        )
        
        logger.info(f"Notification email sent for podcast {podcast_id}")
        
    except Exception as e:
        logger.error(f"Failed to send notification email: {str(e)}")


@shared_task
def cleanup_old_podcasts(days=30):
    """
    Delete old podcasts older than specified days.
    
    Args:
        days (int): Delete podcasts older than this many days
    """
    from django.utils import timezone
    from datetime import timedelta
    from dailycast.models import DailyPodcast
    
    try:
        cutoff_date = timezone.now() - timedelta(days=days)
        old_podcasts = DailyPodcast.objects.filter(created_at__lt=cutoff_date)
        count = old_podcasts.count()
        
        if count > 0:
            # Delete associated audio files
            for podcast in old_podcasts:
                if podcast.audio_file:
                    podcast.audio_file.delete()
                if podcast.audio_file_secondary:
                    podcast.audio_file_secondary.delete()
            
            # Delete podcasts
            old_podcasts.delete()
            logger.info(f"Cleaned up {count} podcasts older than {days} days")
        
        return {'cleaned': count}
    
    except Exception as e:
        logger.error(f"Cleanup task failed: {str(e)}")
        return {'error': str(e)}
