"""
AJAX views for admin forms - Course Information lookup.

Provides endpoints for dynamically loading user's courses/lessons/quizzes
when admin selects a user in the podcast form.
"""
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth import get_user_model
from django.conf import settings
from courses.models import Course
from lessons.models import Lesson
from quizzes.models import Quiz
from enrollment.models import Enrollment
from dailycast.models import DailyPodcast
from dailycast.services import _generate_with_openai, _generate_with_gemini
import logging
import requests

logger = logging.getLogger(__name__)
User = get_user_model()


def is_admin_or_staff(user):
    """Check if user is admin or staff."""
    return user.is_staff or user.is_superuser


@require_GET
@login_required
@user_passes_test(is_admin_or_staff)
def get_user_courses_ajax(request):
    """
    AJAX endpoint: Get courses, lessons, and quizzes for a user.
    
    Query params:
    - user_id: User ID to fetch data for
    
    Returns JSON:
    {
        "success": true,
        "courses": [
            {
                "id": 1,
                "title": "English Mastery",
                "lessons_count": 5,
                "quizzes_count": 3
            }
        ],
        "lessons": [
            {
                "id": 1,
                "title": "Lesson 1",
                "course_title": "English Mastery"
            }
        ],
        "quizzes": [
            {
                "id": 1,
                "title": "Quiz 1",
                "course_title": "English Mastery"
            }
        ]
    }
    """
    try:
        user_id = request.GET.get('user_id')
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'user_id parameter required'
            }, status=400)
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': f'User with ID {user_id} not found'
            }, status=404)
        
        # Get user's enrolled courses
        enrolled_course_ids = Enrollment.objects.filter(
            user=user,
            enrollment_type='course'
        ).values_list('object_id', flat=True)
        
        courses = Course.objects.filter(
            id__in=enrolled_course_ids
        ).values('id', 'title')
        
        course_list = list(courses)
        
        # Get lessons from enrolled courses
        lessons = Lesson.objects.filter(
            course__id__in=enrolled_course_ids
        ).select_related('course').values('id', 'title', 'course__title')
        
        lesson_list = [
            {
                'id': lesson['id'],
                'title': lesson['title'],
                'course_title': lesson['course__title']
            }
            for lesson in lessons
        ]
        
        # Get quizzes from enrolled courses
        quizzes = Quiz.objects.filter(
            course__id__in=enrolled_course_ids
        ).select_related('course').values('id', 'title', 'course__title')
        
        quiz_list = [
            {
                'id': quiz['id'],
                'title': quiz['title'],
                'course_title': quiz['course__title']
            }
            for quiz in quizzes
        ]
        
        logger.info(f"AJAX: Fetched {len(course_list)} courses, {len(lesson_list)} lessons, {len(quiz_list)} quizzes for user {user.username}")
        
        return JsonResponse({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email
            },
            'courses': course_list,
            'lessons': lesson_list,
            'quizzes': quiz_list,
            'summary': {
                'total_courses': len(course_list),
                'total_lessons': len(lesson_list),
                'total_quizzes': len(quiz_list)
            }
        })
        
    except Exception as e:
        logger.exception(f"Error in get_user_courses_ajax: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_GET
@login_required
@user_passes_test(is_admin_or_staff)
def get_course_details_ajax(request):
    """
    AJAX endpoint: Get course content with lessons and quizzes.
    
    Query params:
    - course_id: Course ID
    
    Returns detailed course structure for podcast personalization.
    """
    try:
        course_id = request.GET.get('course_id')
        if not course_id:
            return JsonResponse({
                'success': False,
                'error': 'course_id parameter required'
            }, status=400)
        
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': f'Course with ID {course_id} not found'
            }, status=404)
        
        # Get course details
        lessons = Lesson.objects.filter(course=course).values(
            'id', 'title', 'position'
        ).order_by('position')
        
        quizzes = Quiz.objects.filter(course=course).values(
            'id', 'title', 'quiz_type'
        )
        
        return JsonResponse({
            'success': True,
            'course': {
                'id': course.id,
                'title': course.title,
                'subject': course.subject.name if course.subject else None,
                'description': course.description[:200] if course.description else None
            },
            'lessons': list(lessons),
            'quizzes': list(quizzes),
            'structure': {
                'total_lessons': len(list(lessons)),
                'total_quizzes': len(list(quizzes))
            }
        })
        
    except Exception as e:
        logger.exception(f"Error in get_course_details_ajax: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


from django.views.decorators.http import require_POST
import json
import time
from django.core.files.base import ContentFile


@require_POST
@login_required
@user_passes_test(is_admin_or_staff)
def regenerate_audio_ajax(request):
    """
    AJAX endpoint to regenerate audio for a specific podcast.
    ALWAYS uses synthesize_audio_for_language which prioritizes ElevenLabs TTS.
    
    POST params (JSON):
    - podcast_id: ID of podcast to regenerate audio for
    
    Returns JSON:
    {
        "success": true,
        "message": "Audio regenerated successfully"
    }
    """
    try:
        # Parse request JSON
        data = json.loads(request.body)
        podcast_id = data.get('podcast_id')
        tts_provider_req = data.get('tts_provider')
        script_override = data.get('script_text')  # Optional: use current textarea content
        
        if not podcast_id:
            return JsonResponse({
                'success': False,
                'error': 'podcast_id is required'
            }, status=400)
        
        # Get the podcast
        try:
            podcast = DailyPodcast.objects.get(id=podcast_id)
        except DailyPodcast.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': f'Podcast with ID {podcast_id} not found'
            }, status=404)
        
        # Choose script source: prefer current user-edited text if provided
        script_text = script_override if script_override and script_override.strip() else podcast.script_text

        # Check if podcast has a script
        if not script_text:
            return JsonResponse({
                'success': False,
                'error': 'This podcast has no script text to regenerate from'
            }, status=400)
        
        # Import the TTS service - MUST USE synthesize_audio_for_language which prioritizes ElevenLabs
        from dailycast.services_interactive import synthesize_audio_for_language
        
        success = False
        error_msg = None
        provider_used = None
        
        try:
            logger.info(f"🎵 ADMIN_REGEN: Starting audio regeneration for podcast {podcast.id}")
            logger.info(f"🎵 ADMIN_REGEN: Primary language: {podcast.primary_language}, has script: {bool(script_text)} (override provided: {bool(script_override)})")
            
            # Regenerate primary language audio
            if podcast.primary_language and script_text:
                logger.info(f"🎵 ADMIN_REGEN: Calling synthesize_audio_for_language for {podcast.primary_language} (pref: {tts_provider_req})")
                
                audio_bytes, tts_provider = synthesize_audio_for_language(
                    script_text,
                    podcast.primary_language,
                    preferred_provider=tts_provider_req
                )
                
                logger.info(f"🎵 ADMIN_REGEN: synthesize_audio_for_language returned: provider={tts_provider}, bytes={len(audio_bytes) if audio_bytes else 0}")
                provider_used = tts_provider
                
                if audio_bytes:
                    filename = f"podcast_{podcast.id}_{podcast.primary_language}_{int(time.time())}.mp3"
                    podcast.audio_file.save(filename, ContentFile(audio_bytes), save=False)
                    podcast.tts_provider = tts_provider
                    logger.info(f"✅ ADMIN_REGEN: Regenerated primary audio for podcast {podcast.id} with provider={tts_provider}")
                else:
                    error_msg = 'Audio generation returned no data'
                    logger.error(f"❌ ADMIN_REGEN: Audio generation returned no data")
            
            # Regenerate secondary language audio if applicable
            if podcast.secondary_language and script_text:
                try:
                    logger.info(f"🎵 ADMIN_REGEN: Calling synthesize_audio_for_language for secondary language {podcast.secondary_language}")
                    
                    audio_bytes_sec, provider_sec = synthesize_audio_for_language(
                        script_text,
                        podcast.secondary_language,
                        preferred_provider=tts_provider_req
                    )
                    
                    logger.info(f"🎵 ADMIN_REGEN: Secondary synthesize_audio_for_language returned: provider={provider_sec}, bytes={len(audio_bytes_sec) if audio_bytes_sec else 0}")
                    
                    if audio_bytes_sec:
                        filename_sec = f"podcast_{podcast.id}_{podcast.secondary_language}_{int(time.time())}.mp3"
                        podcast.audio_file_secondary.save(
                            filename_sec, 
                            ContentFile(audio_bytes_sec), 
                            save=False
                        )
                        logger.info(f"✅ ADMIN_REGEN: Regenerated secondary audio for podcast {podcast.id} with provider={provider_sec}")
                except Exception as e:
                    logger.warning(f"⚠️ ADMIN_REGEN: Could not regenerate secondary audio: {e}")
            
            # Persist any edited script text so DB matches the latest textarea content
            if script_override and script_override.strip():
                podcast.script_text = script_override

            # Save the podcast with updated audio files
            podcast.save()
            success = True
            
            logger.info(f"✅ ADMIN_REGEN: Successfully regenerated audio for podcast {podcast.id} with provider={provider_used}")
            
        except Exception as e:
            logger.exception(f"❌ ADMIN_REGEN: Error regenerating audio for podcast {podcast.id}: {e}")
            error_msg = str(e)
        
        if success:
            return JsonResponse({
                'success': True,
                'message': f'✅ Audio regenerated successfully for podcast {podcast.id} using {provider_used}'
            })
        else:
            return JsonResponse({
                'success': False,
                'error': f'Error regenerating audio: {error_msg}'
            }, status=500)
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON in regenerate_audio_ajax request")
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON in request'
        }, status=400)
    
    except Exception as e:
        logger.exception(f"Unexpected error in regenerate_audio_ajax: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_POST
@login_required
@user_passes_test(is_admin_or_staff)
def generate_script_ajax(request):
    """
    AJAX endpoint to generate podcast script based on user customization.
    
    Supports both single item (legacy) and multiple items (new multi-select format).
    
    POST params (JSON):
    
    NEW FORMAT (Multi-select):
    - items: [{type, id, name, course}, ...]  # Array of selected items
    - category: Category/Subject (e.g., "Business English")
    - topic: Specific topic (optional)
    - profession: Profession/context (optional, e.g., "Hair stylist in Germany")
    - language: Language code (en, ja, es, etc.)
    - notes: Additional notes/style guide (optional)
    
    LEGACY FORMAT (Single item):
    - item_type: 'course', 'lesson', or 'quiz'
    - item_id: ID of the selected item
    - item_name: Name of the selected item
    - course_name: Name of the course (for lessons/quizzes)
    - category: Category/Subject
    - topic: Specific topic (optional)
    - profession: Profession/context (optional)
    - language: Language code
    - notes: Additional notes/style guide (optional)
    
    Returns JSON:
    {
        "success": true,
        "script": "Generated script text...",
        "message": "Script generated successfully"
    }
    """
    try:
        # Parse request JSON
        data = json.loads(request.body)
        
        # Get user context if user_id provided
        user_context = ""
        user_id = data.get('user_id')
        if user_id:
            try:
                from dailycast.ai_analyzer import UserLearningAnalyzer
                user = User.objects.get(id=user_id)
                analyzer = UserLearningAnalyzer(user)
                analysis = analyzer.collect_user_learning_data()
                recommendations = analyzer.generate_recommendations()
                
                # Build context to inject into prompt
                user_context = f"""

🎯 USER LEARNING CONTEXT (personalize the content based on this):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Student: {user.username}
Progress: {analysis['lessons_completed']} lessons, {analysis['quizzes_completed']} quizzes completed
Quiz Accuracy: {analysis['quiz_accuracy']:.1f}%
Study Streak: {analysis['study_streak']} days
Active Learning Days (last 30d): {analysis['active_days']} days

📚 ENROLLED COURSES:
{chr(10).join([f"  • {c['title']}" for c in analysis['enrolled_courses'][:5]])}

💪 STRONG AREAS (build on these):
{chr(10).join([f"  • {s['topic']} - {s['avg_score']}% mastery" for s in analysis.get('strong_topics', [])[:3]]) if analysis.get('strong_topics') else "  • Still building foundation"}

⚠️ NEEDS IMPROVEMENT (address these):
{chr(10).join([f"  • {w['topic']} - {w['avg_score']}% (needs practice)" for w in analysis.get('weak_topics', [])[:3]]) if analysis.get('weak_topics') else "  • Doing great across all areas!"}

🎯 AI RECOMMENDATIONS FOR THIS USER:
{chr(10).join([f"  • {step}" for step in recommendations.get('next_steps', [])[:3]])}

IMPORTANT: Use this context to make the podcast highly relevant to {user.username}'s current learning journey!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
                logger.info(f"✅ Added personalized learning context for user {user.username}")
            except Exception as e:
                logger.warning(f"Could not add user context: {e}")
        
        category = data.get('category', '')
        topic = data.get('topic', '')
        profession = data.get('profession', '')
        language = data.get('language', 'en')
        language_secondary = data.get('language_secondary', '')
        notes = data.get('notes', '')
        llm_model = data.get('llm_model', 'gpt-4o-mini')
        
        # Validate required fields
        if not category:
            return JsonResponse({
                'success': False,
                'error': 'Category/Subject is required'
            }, status=400)
        
        # Check if this is new multi-select format or legacy single-item format
        items = data.get('items')
        
        # Treat as multi-item format if items is a list (even if empty, as long as category exists)
        if items is not None and isinstance(items, list):
            # NEW FORMAT: Multiple items (or Topic-only if empty)
            prompt = _build_multi_item_prompt(
                items=items,
                category=category,
                topic=topic,
                profession=profession,
                language=language,
                language_secondary=language_secondary,
                notes=notes
            )
            # Inject user context at the beginning
            if user_context:
                prompt = user_context + "\n\n" + prompt
            
            item_count = len(items)
            if item_count > 0:
                item_desc = f"{item_count} item(s)" if item_count > 1 else items[0].get('name', 'item')
            else:
                item_desc = "Topic/Category only"
        else:
            # LEGACY FORMAT: Single item
            item_type = data.get('item_type')
            item_id = data.get('item_id')
            item_name = data.get('item_name')
            course_name = data.get('course_name')
            
            prompt = _build_script_prompt(
                item_type=item_type,
                item_name=item_name,
                course_name=course_name,
                category=category,
                topic=topic,
                profession=profession,
                language=language,
                language_secondary=language_secondary,
                notes=notes
            )
            # Inject user context
            if user_context:
                prompt = user_context + "\n\n" + prompt
            
            item_desc = item_name or item_type
        
        # Call the LLM to generate script
        script_text = _generate_script_with_llm(prompt, language, llm_model)
        
        if not script_text:
            return JsonResponse({
                'success': False,
                'error': 'Failed to generate script from LLM'
            }, status=500)
        
        logger.info(f"✅ Generated script for {item_desc} via AJAX")
        
        return JsonResponse({
            'success': True,
            'script': script_text,
            'message': f'✅ Script generated successfully for {category}'
        })
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON in generate_script_ajax request")
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON in request'
        }, status=400)
    
    except Exception as e:
        logger.exception(f"Error in generate_script_ajax: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)




def _build_multi_item_prompt(items, category, topic, profession, language, language_secondary='', notes=''):
    """
    Build a detailed prompt for the LLM to generate a podcast script for multiple items.
    Prioritizes user's custom topic and notes over course material.
    
    Args:
        items: List of dicts with {type, id, name, course}
        category: Category/Subject
        topic: Specific topic (optional)
        profession: Professional context (optional)
        language: Primary language code
        language_secondary: Secondary language code (optional)
        notes: Style notes (optional)
    """
    # Build item descriptions
    items_list = ""
    course_count = 0
    lesson_count = 0
    quiz_count = 0
    
    for item in items:
        item_type = item.get('type', 'unknown').capitalize()
        item_name = item.get('name', 'unknown')
        items_list += f"  • {item_type}: {item_name}\n"
        
        # Count by type
        if item.get('type') == 'course':
            course_count += 1
        elif item.get('type') == 'lesson':
            lesson_count += 1
        elif item.get('type') == 'quiz':
            quiz_count += 1
    
    # Build summary
    summary = f"({course_count} course(s), {lesson_count} lesson(s), {quiz_count} quiz(zes))"
    
    # If user specified a topic and notes, prioritize those
    if topic or notes:
        prompt = f"""Generate a professional podcast script based on the USER'S REQUEST:

**PRIMARY FOCUS - User's Request**:
{'**Topic**: ' + topic if topic else ''}
{'**Additional Details**: ' + notes if notes else ''}
{'**Professional Context**: ' + profession if profession else ''}

**Background Context** (use as reference material only):
{items_list}
- Category: {category}

**Language**: {language}
{'**Secondary Language**: ' + language_secondary if language_secondary else ''}

CRITICAL REQUIREMENTS:
1. The podcast MUST BE ABOUT the user's topic: "{topic}"
2. Use the course material ONLY as background reference - don't make it the main subject
3. Focus on what the user requested in their topic and notes
4. Create a casual, conversational style (especially if user requested "casual conversation")
5. Keep it SHORT and punchy (120-180 words by default; if notes mention "short" or "small", keep it under 120 words)
6. Include 1-2 practical examples related to the user's topic (no long lists)
{'7. Tailor specifically for: ' + profession if profession else ''}
{'8. Include bilingual elements in ' + language + ' and ' + language_secondary if language_secondary else ''}
9. Make it suitable for text-to-speech narration with brief sentences

REMEMBER: The user wants to learn about "{topic}" - NOT a generic lesson about the course materials.

Generate the script now:"""
    else:
        # Fallback to course-focused script if no custom topic
        prompt = f"""Generate a comprehensive podcast script that integrates the following learning content:

**Selected Learning Items** {summary}:
{items_list}

**Category/Subject**: {category}
{'**Professional Context**: ' + profession if profession else ''}
**Language**: {language}
{'**Secondary Language (for comparison/bilingual content)**: ' + language_secondary if language_secondary else ''}

Requirements:
1. Create a cohesive podcast script that weaves together all the selected items
2. Start with an engaging introduction that sets context for all topics
3. Structure the main content to flow logically between different items
4. Include connections and relationships between the topics covered
5. Keep it concise (150-220 words by default; if notes mention "short" or "small", keep it under 140 words)
6. Use conversational tone suitable for daily learning
7. Include 1-2 practical examples or tips (no long lists)
8. Add a brief conclusion that ties everything together
{'9. Tailor content specifically for: ' + profession if profession else ''}
{'10. Include bilingual content in both ' + language + ' and ' + language_secondary + ' to help with language learning' if language_secondary else ''}
11. Ensure content is suitable for text-to-speech narration with short sentences
12. Make it engaging and keep the listener's attention throughout

Generate the integrated podcast script now:"""
    
    return prompt


def _build_script_prompt(item_type, item_name, course_name, category, topic, profession, language, language_secondary='', notes=''):
    """
    Build a detailed prompt for the LLM to generate a podcast script.
    Prioritizes user's custom topic and notes over course material.
    """
    # If user specified a topic and notes, prioritize those
    if topic or notes:
        prompt = f"""Generate a professional podcast script based on the USER'S REQUEST:

**PRIMARY FOCUS - User's Request**:
{'**Topic**: ' + topic if topic else ''}
{'**Additional Details**: ' + notes if notes else ''}

**Background Context** (use as reference material only, don't make this the main focus):
- Base Material: {item_name} (from course: {course_name})
- Category: {category}
{'- Professional Context: ' + profession if profession else ''}

**Language**: {language}
{'**Secondary Language**: ' + language_secondary if language_secondary else ''}

CRITICAL REQUIREMENTS:
1. The podcast MUST BE ABOUT the user's topic: "{topic}"
2. Use the course material ({item_name}) ONLY as background reference - don't make it the main subject
3. Focus on what the user requested in their topic and notes
4. Create a casual, conversational style (especially if user requested "casual conversation")
5. Keep it SHORT and punchy (120-180 words by default; if notes mention "short" or "small", keep it under 120 words)
6. Include 1-2 practical examples related to the user's topic (no long lists)
{'7. Tailor specifically for: ' + profession if profession else ''}
{'8. Include bilingual elements in ' + language + ' and ' + language_secondary if language_secondary else ''}

REMEMBER: The user wants to learn about "{topic}" - NOT a generic lesson about {item_name}.

Generate the script now:"""
    else:
        # Fallback to course-focused script if no custom topic
        prompt = f"""Generate a professional podcast script for the following:

**Content Type**: {item_type.capitalize()} - {item_name}
**Course**: {course_name}
**Category/Subject**: {category}
{'**Professional Context**: ' + profession if profession else ''}
**Language**: {language}
{'**Secondary Language (for comparison/bilingual content)**: ' + language_secondary if language_secondary else ''}

Requirements:
1. Create an engaging podcast script suitable for daily learning
2. Include a brief introduction, main content, and short conclusion
3. Keep it concise (150-220 words by default; if notes mention "short" or "small", keep it under 140 words)
4. Use conversational tone
5. Include 1-2 practical examples or tips where applicable (no long lists)
{'6. Tailor content specifically for: ' + profession if profession else ''}
{'7. Include bilingual content in both ' + language + ' and ' + language_secondary + ' to help with language learning' if language_secondary else ''}
8. Make it suitable for text-to-speech narration with short sentences

Generate the script now:"""
    
    return prompt


def _generate_script_with_llm(prompt, language='en', llm_model='gpt-4o-mini'):
    """
    Generate script using the LLM service.
    Uses OpenAI if configured, otherwise falls back to the template.
    """
    openai_key = getattr(settings, "OPENAI_API_KEY", None)
    gemini_key = getattr(settings, "GEMINI_API_KEY", None)

    # Determine provider from model name
    provider = 'openai'
    if 'gemini' in llm_model.lower():
        provider = 'gemini'

    # Try requested provider first
    if provider == 'gemini' and gemini_key:
        try:
            text, _ = _generate_with_gemini(gemini_key, prompt, llm_model)
            return text
        except Exception as exc:
            logger.warning("LLM generation failed (Gemini): %s", exc)
    
    if provider == 'openai' and openai_key:
        try:
            text, _ = _generate_with_openai(openai_key, prompt, llm_model)
            return text
        except Exception as exc:
            logger.warning("LLM generation failed (OpenAI): %s", exc)

    # Fallback chain if specific provider failed or wasn't requested
    if openai_key and provider != 'openai': # Don't retry if we just failed
        try:
            text, _ = _generate_with_openai(openai_key, prompt, 'gpt-4o-mini')
            return text
        except Exception as exc:
            logger.warning("LLM generation failed (OpenAI fallback): %s", exc)

    if gemini_key and provider != 'gemini': # Don't retry if we just failed
        try:
            text, _ = _generate_with_gemini(gemini_key, prompt, 'gemini-2.0-flash')
            return text
        except Exception as exc:
            logger.warning("LLM generation failed (Gemini fallback): %s", exc)

    # Fallback: generate a basic script template
    return _generate_fallback_script(prompt)


def _generate_fallback_script(prompt):
    """
    Fallback script generation if LLM is unavailable.
    Generates a basic template script.
    """
    return """[PODCAST SCRIPT - GENERATED TEMPLATE]

INTRODUCTION:
Good day, and welcome to today's podcast. Today we're exploring an important topic that will help you in your learning journey.

MAIN CONTENT:
Let's dive into the key concepts:

1. Key Point 1
   - Explanation and context
   - Real-world application
   
2. Key Point 2
   - Explanation and context
   - Real-world application

3. Key Point 3
   - Explanation and context
   - Real-world application

PRACTICAL TIPS:
Here are some actionable insights you can apply immediately:
- Tip 1: Practice and implementation
- Tip 2: Common mistakes to avoid
- Tip 3: Resources for further learning

CONCLUSION:
Remember, consistency is key to mastery. Review these concepts regularly and apply them in your daily work.

Thank you for listening, and we'll catch you in the next episode!

---
[Note: This is a template script. Edit it to customize with specific examples and details from your course material.]
"""


@require_GET
@login_required
@user_passes_test(is_admin_or_staff)
def get_llm_models_ajax(request):
    """
    AJAX endpoint: Get available LLM models for a provider.
    
    Query params:
    - provider: One of 'openai', 'gemini', 'claude', 'template'
    
    Returns JSON:
    {
        "models": [
            {"value": "gpt-4o-mini", "label": "GPT-4o Mini - Fast & Cheap"},
            ...
        ],
        "tooltip": "Provider description..."
    }
    """
    from dailycast.admin import LLM_PROVIDER_MODELS, LLM_PROVIDER_TOOLTIPS
    
    provider = request.GET.get('provider', 'template')
    
    # Get models for the provider
    models = LLM_PROVIDER_MODELS.get(provider, LLM_PROVIDER_MODELS['template'])
    
    # Format for AJAX response
    response_data = {
        'models': [{'value': m[0], 'label': m[1]} for m in models],
        'tooltip': LLM_PROVIDER_TOOLTIPS.get(provider, 'Choose a provider')
    }
    
    return JsonResponse(response_data)


@require_GET
@login_required
@user_passes_test(is_admin_or_staff)
def get_field_help_text_ajax(request):
    """
    AJAX endpoint: Get field help text and descriptions from model.
    
    Query params:
    - model: Model name (e.g., 'TeacherContentConfig', 'UserCategoryConfig')
    - field: Field name (e.g., 'voice_map_json', 'tts_fallback_chain')
    
    Returns JSON:
    {
        "field": "voice_map_json",
        "help_text": "Map languages to voice IDs: ...",
        "description": "Configure which voice to use for each language"
    }
    """
    from dailycast.models import TeacherContentConfig, UserCategoryConfig
    
    model_name = request.GET.get('model', 'TeacherContentConfig')
    field_name = request.GET.get('field', '')
    
    # Get the model class
    models = {
        'TeacherContentConfig': TeacherContentConfig,
        'UserCategoryConfig': UserCategoryConfig,
    }
    
    model_class = models.get(model_name)
    if not model_class or not field_name:
        return JsonResponse({
            'error': 'Invalid model or field',
            'field': field_name,
            'help_text': '',
            'description': ''
        })
    
    # Get field from model
    try:
        field = model_class._meta.get_field(field_name)
        help_text = field.help_text if hasattr(field, 'help_text') else ''
        
        return JsonResponse({
            'field': field_name,
            'help_text': str(help_text),
            'description': field.verbose_name if hasattr(field, 'verbose_name') else field_name
        })
    except Exception as e:
        return JsonResponse({
            'error': str(e),
            'field': field_name,
            'help_text': '',
            'description': ''
        })


@require_GET
@login_required
@user_passes_test(is_admin_or_staff)
def get_tts_voices_ajax(request):
    """
    AJAX endpoint: Fetch available voices from TTS provider APIs.
    
    Query Params:
    - provider: TTS provider (elevenlabs, google, openai, polly)
    - language: Optional language code to filter voices (e.g., 'en', 'ja')
    
    Example:
    GET /api/admin/ajax/tts-voices/?provider=elevenlabs&language=en
    
    Response:
    {
        "voices": [
            {
                "voice_id": "pFZP5JQG7iQjIQuC4Bku",
                "name": "Lily",
                "gender": "female",
                "accent": "american",
                "languages": ["en", "ja", "es"],
                "description": "Professional, educational tone"
            }
        ],
        "provider": "elevenlabs",
        "count": 1
    }
    """
    import requests
    from django.conf import settings
    
    provider = request.GET.get('provider', 'elevenlabs')
    language_filter = request.GET.get('language', '')
    
    voices = []
    
    try:
        if provider == 'elevenlabs':
            # ElevenLabs API: https://api.elevenlabs.io/v1/voices
            api_key = getattr(settings, 'ELEVENLABS_API_KEY', None)
            if not api_key:
                return JsonResponse({'error': 'ElevenLabs API key not configured'}, status=500)
            
            response = requests.get(
                'https://api.elevenlabs.io/v1/voices',
                headers={'xi-api-key': api_key},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                for voice in data.get('voices', []):
                    # Extract voice metadata
                    labels = voice.get('labels', {})
                    voice_info = {
                        'voice_id': voice.get('voice_id', ''),
                        'name': voice.get('name', 'Unknown'),
                        'gender': labels.get('gender', 'unknown'),
                        'accent': labels.get('accent', 'neutral'),
                        'age': labels.get('age', 'adult'),
                        'use_case': labels.get('use_case', 'general'),
                        'languages': ['multilingual'] if voice.get('category') == 'premade' else [],
                        'description': voice.get('description', f"{voice.get('name', 'Voice')} - ElevenLabs voice"),
                        'category': voice.get('category', 'premade')
                    }
                    
                    # Filter by language if specified (ElevenLabs multilingual voices support all languages)
                    if not language_filter or voice_info['category'] == 'premade':
                        voices.append(voice_info)
            else:
                return JsonResponse({'error': f'ElevenLabs API error: {response.status_code}'}, status=500)
        
        elif provider == 'google':
            # Google TTS: Use predefined voices (API requires cloud setup)
            google_voices = [
                {'voice_id': 'en-US-Wavenet-A', 'name': 'US English Wavenet A', 'gender': 'male', 'accent': 'american', 'languages': ['en'], 'description': 'Male US English - Natural Wavenet'},
                {'voice_id': 'en-US-Wavenet-B', 'name': 'US English Wavenet B', 'gender': 'male', 'accent': 'american', 'languages': ['en'], 'description': 'Male US English - Deep voice'},
                {'voice_id': 'en-US-Wavenet-C', 'name': 'US English Wavenet C', 'gender': 'female', 'accent': 'american', 'languages': ['en'], 'description': 'Female US English - Warm voice'},
                {'voice_id': 'en-US-Wavenet-D', 'name': 'US English Wavenet D', 'gender': 'male', 'accent': 'american', 'languages': ['en'], 'description': 'Male US English - Professional'},
                {'voice_id': 'en-US-Neural2-A', 'name': 'US English Neural2 A', 'gender': 'male', 'accent': 'american', 'languages': ['en'], 'description': 'Male US English - Latest Neural'},
                {'voice_id': 'en-US-Neural2-C', 'name': 'US English Neural2 C', 'gender': 'female', 'accent': 'american', 'languages': ['en'], 'description': 'Female US English - Latest Neural'},
                {'voice_id': 'en-GB-Wavenet-A', 'name': 'UK English Wavenet A', 'gender': 'female', 'accent': 'british', 'languages': ['en'], 'description': 'Female UK English'},
                {'voice_id': 'en-GB-Wavenet-B', 'name': 'UK English Wavenet B', 'gender': 'male', 'accent': 'british', 'languages': ['en'], 'description': 'Male UK English'},
                {'voice_id': 'ja-JP-Wavenet-A', 'name': 'Japanese Wavenet A', 'gender': 'female', 'accent': 'tokyo', 'languages': ['ja'], 'description': 'Female Japanese - Standard'},
                {'voice_id': 'ja-JP-Wavenet-B', 'name': 'Japanese Wavenet B', 'gender': 'female', 'accent': 'tokyo', 'languages': ['ja'], 'description': 'Female Japanese - Soft'},
                {'voice_id': 'ja-JP-Wavenet-C', 'name': 'Japanese Wavenet C', 'gender': 'male', 'accent': 'tokyo', 'languages': ['ja'], 'description': 'Male Japanese - Standard'},
                {'voice_id': 'ja-JP-Wavenet-D', 'name': 'Japanese Wavenet D', 'gender': 'male', 'accent': 'tokyo', 'languages': ['ja'], 'description': 'Male Japanese - Deep'},
                {'voice_id': 'es-ES-Wavenet-B', 'name': 'Spanish Wavenet B', 'gender': 'male', 'accent': 'spain', 'languages': ['es'], 'description': 'Male Spanish'},
                {'voice_id': 'es-ES-Wavenet-C', 'name': 'Spanish Wavenet C', 'gender': 'female', 'accent': 'spain', 'languages': ['es'], 'description': 'Female Spanish'},
                {'voice_id': 'fr-FR-Wavenet-A', 'name': 'French Wavenet A', 'gender': 'female', 'accent': 'paris', 'languages': ['fr'], 'description': 'Female French'},
                {'voice_id': 'fr-FR-Wavenet-B', 'name': 'French Wavenet B', 'gender': 'male', 'accent': 'paris', 'languages': ['fr'], 'description': 'Male French'},
                {'voice_id': 'de-DE-Wavenet-A', 'name': 'German Wavenet A', 'gender': 'female', 'accent': 'standard', 'languages': ['de'], 'description': 'Female German'},
                {'voice_id': 'de-DE-Wavenet-B', 'name': 'German Wavenet B', 'gender': 'male', 'accent': 'standard', 'languages': ['de'], 'description': 'Male German'},
            ]
            
            for voice in google_voices:
                if language_filter:
                    if language_filter in voice['languages']:
                        voices.append(voice)
                else:
                    voices.append(voice)
        
        elif provider == 'gemini':
            # Google Gemini-based speech synthesis voices
            # Uses Gemini 2.0's native audio capabilities
            gemini_voices = [
                {'voice_id': 'en-US-1', 'name': 'US English 1', 'gender': 'male', 'accent': 'american', 'languages': ['en'], 'description': 'Male US English - Professional tone'},
                {'voice_id': 'en-US-2', 'name': 'US English 2', 'gender': 'female', 'accent': 'american', 'languages': ['en'], 'description': 'Female US English - Friendly tone'},
                {'voice_id': 'en-GB-1', 'name': 'UK English 1', 'gender': 'male', 'accent': 'british', 'languages': ['en'], 'description': 'Male UK English'},
                {'voice_id': 'en-GB-2', 'name': 'UK English 2', 'gender': 'female', 'accent': 'british', 'languages': ['en'], 'description': 'Female UK English'},
                {'voice_id': 'es-ES-1', 'name': 'Spanish 1', 'gender': 'male', 'accent': 'spain', 'languages': ['es'], 'description': 'Male Spanish (Spain)'},
                {'voice_id': 'es-ES-2', 'name': 'Spanish 2', 'gender': 'female', 'accent': 'spain', 'languages': ['es'], 'description': 'Female Spanish (Spain)'},
                {'voice_id': 'fr-FR-1', 'name': 'French 1', 'gender': 'male', 'accent': 'paris', 'languages': ['fr'], 'description': 'Male French'},
                {'voice_id': 'fr-FR-2', 'name': 'French 2', 'gender': 'female', 'accent': 'paris', 'languages': ['fr'], 'description': 'Female French'},
                {'voice_id': 'de-DE-1', 'name': 'German 1', 'gender': 'male', 'accent': 'standard', 'languages': ['de'], 'description': 'Male German'},
                {'voice_id': 'de-DE-2', 'name': 'German 2', 'gender': 'female', 'accent': 'standard', 'languages': ['de'], 'description': 'Female German'},
                {'voice_id': 'ja-JP-1', 'name': 'Japanese 1', 'gender': 'male', 'accent': 'tokyo', 'languages': ['ja'], 'description': 'Male Japanese'},
                {'voice_id': 'ja-JP-2', 'name': 'Japanese 2', 'gender': 'female', 'accent': 'tokyo', 'languages': ['ja'], 'description': 'Female Japanese'},
            ]
            
            for voice in gemini_voices:
                if language_filter:
                    if language_filter in voice['languages']:
                        voices.append(voice)
                else:
                    voices.append(voice)
        
        elif provider == 'google_chirp':
            # Google AI Studio Chirp voices (Google's latest speech synthesis)
            # Supports multilingual voices with high quality output
            google_chirp_voices = [
                {'voice_id': 'en', 'name': 'English', 'gender': 'neutral', 'accent': 'american', 'languages': ['en'], 'description': 'English - Natural multilingual voice'},
                {'voice_id': 'es', 'name': 'Spanish', 'gender': 'neutral', 'accent': 'spain', 'languages': ['es'], 'description': 'Spanish - Natural multilingual voice'},
                {'voice_id': 'fr', 'name': 'French', 'gender': 'neutral', 'accent': 'paris', 'languages': ['fr'], 'description': 'French - Natural multilingual voice'},
                {'voice_id': 'de', 'name': 'German', 'gender': 'neutral', 'accent': 'standard', 'languages': ['de'], 'description': 'German - Natural multilingual voice'},
                {'voice_id': 'ja', 'name': 'Japanese', 'gender': 'neutral', 'accent': 'tokyo', 'languages': ['ja'], 'description': 'Japanese - Natural multilingual voice'},
                {'voice_id': 'ko', 'name': 'Korean', 'gender': 'neutral', 'accent': 'seoul', 'languages': ['ko'], 'description': 'Korean - Natural multilingual voice'},
                {'voice_id': 'pt-br', 'name': 'Portuguese (Brazil)', 'gender': 'neutral', 'accent': 'brazilian', 'languages': ['pt'], 'description': 'Portuguese - Natural multilingual voice'},
                {'voice_id': 'ru', 'name': 'Russian', 'gender': 'neutral', 'accent': 'moscow', 'languages': ['ru'], 'description': 'Russian - Natural multilingual voice'},
                {'voice_id': 'it', 'name': 'Italian', 'gender': 'neutral', 'accent': 'rome', 'languages': ['it'], 'description': 'Italian - Natural multilingual voice'},
                {'voice_id': 'pl', 'name': 'Polish', 'gender': 'neutral', 'accent': 'warsaw', 'languages': ['pl'], 'description': 'Polish - Natural multilingual voice'},
            ]
            
            for voice in google_chirp_voices:
                if language_filter:
                    # Convert language filter to match voice_id format if needed
                    if language_filter in voice['languages'] or language_filter == voice['voice_id']:
                        voices.append(voice)
                else:
                    voices.append(voice)
        
        elif provider == 'openai':
            # OpenAI TTS voices (hardcoded - API doesn't provide list endpoint)
            openai_voices = [
                {'voice_id': 'alloy', 'name': 'Alloy', 'gender': 'neutral', 'accent': 'neutral', 'languages': ['multilingual'], 'description': 'Neutral versatile voice - works for all languages'},
                {'voice_id': 'echo', 'name': 'Echo', 'gender': 'male', 'accent': 'neutral', 'languages': ['multilingual'], 'description': 'Male clear voice - professional tone'},
                {'voice_id': 'fable', 'name': 'Fable', 'gender': 'neutral', 'accent': 'expressive', 'languages': ['multilingual'], 'description': 'Expressive storytelling voice'},
                {'voice_id': 'onyx', 'name': 'Onyx', 'gender': 'male', 'accent': 'deep', 'languages': ['multilingual'], 'description': 'Deep authoritative voice'},
                {'voice_id': 'nova', 'name': 'Nova', 'gender': 'female', 'accent': 'young', 'languages': ['multilingual'], 'description': 'Young energetic female voice'},
                {'voice_id': 'shimmer', 'name': 'Shimmer', 'gender': 'female', 'accent': 'bright', 'languages': ['multilingual'], 'description': 'Bright friendly female voice'},
            ]
            voices = openai_voices
        
        elif provider == 'polly':
            # Amazon Polly voices (common subset)
            polly_voices = [
                {'voice_id': 'Joanna', 'name': 'Joanna', 'gender': 'female', 'accent': 'american', 'languages': ['en'], 'description': 'Female US English - warm tone'},
                {'voice_id': 'Matthew', 'name': 'Matthew', 'gender': 'male', 'accent': 'american', 'languages': ['en'], 'description': 'Male US English - professional'},
                {'voice_id': 'Ivy', 'name': 'Ivy', 'gender': 'female', 'accent': 'american', 'languages': ['en'], 'description': 'Female US English - child voice'},
                {'voice_id': 'Justin', 'name': 'Justin', 'gender': 'male', 'accent': 'american', 'languages': ['en'], 'description': 'Male US English - young adult'},
                {'voice_id': 'Kendra', 'name': 'Kendra', 'gender': 'female', 'accent': 'american', 'languages': ['en'], 'description': 'Female US English - professional'},
                {'voice_id': 'Amy', 'name': 'Amy', 'gender': 'female', 'accent': 'british', 'languages': ['en'], 'description': 'Female UK English'},
                {'voice_id': 'Brian', 'name': 'Brian', 'gender': 'male', 'accent': 'british', 'languages': ['en'], 'description': 'Male UK English'},
                {'voice_id': 'Emma', 'name': 'Emma', 'gender': 'female', 'accent': 'british', 'languages': ['en'], 'description': 'Female UK English - soft'},
                {'voice_id': 'Mizuki', 'name': 'Mizuki', 'gender': 'female', 'accent': 'japanese', 'languages': ['ja'], 'description': 'Female Japanese'},
                {'voice_id': 'Takumi', 'name': 'Takumi', 'gender': 'male', 'accent': 'japanese', 'languages': ['ja'], 'description': 'Male Japanese'},
                {'voice_id': 'Conchita', 'name': 'Conchita', 'gender': 'female', 'accent': 'spanish', 'languages': ['es'], 'description': 'Female Spanish (Spain)'},
                {'voice_id': 'Enrique', 'name': 'Enrique', 'gender': 'male', 'accent': 'spanish', 'languages': ['es'], 'description': 'Male Spanish (Spain)'},
                {'voice_id': 'Celine', 'name': 'Celine', 'gender': 'female', 'accent': 'french', 'languages': ['fr'], 'description': 'Female French'},
                {'voice_id': 'Mathieu', 'name': 'Mathieu', 'gender': 'male', 'accent': 'french', 'languages': ['fr'], 'description': 'Male French'},
                {'voice_id': 'Marlene', 'name': 'Marlene', 'gender': 'female', 'accent': 'german', 'languages': ['de'], 'description': 'Female German'},
                {'voice_id': 'Hans', 'name': 'Hans', 'gender': 'male', 'accent': 'german', 'languages': ['de'], 'description': 'Male German'},
            ]
            
            for voice in polly_voices:
                if language_filter:
                    if language_filter in voice['languages']:
                        voices.append(voice)
                else:
                    voices.append(voice)
        
        else:
            return JsonResponse({'error': f'Unknown provider: {provider}'}, status=400)
        
        return JsonResponse({
            'voices': voices,
            'provider': provider,
            'count': len(voices),
            'language_filter': language_filter or 'all'
        })
    
    except Exception as e:
        import traceback
        return JsonResponse({
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)


@require_GET
@login_required
@user_passes_test(is_admin_or_staff)
def analyze_user_ai_ajax(request):
    """
    AJAX endpoint: Analyze user's learning data and generate AI recommendations.
    Uses local Python analytics to minimize API costs.
    
    Query params:
    - user_id: User ID to analyze
    
    Returns JSON:
    {
        "success": true,
        "analysis": {...},
        "recommendations": {...},
        "report_path": "/path/to/report.json",
        "message": "..."
    }
    """
    try:
        from dailycast.ai_analyzer import analyze_user_and_generate_feedback
        
        user_id = request.GET.get('user_id')
        
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'user_id parameter is required'
            }, status=400)
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': f'User with ID {user_id} not found'
            }, status=404)
        
        # Run analysis (uses local Python libraries, minimal API calls)
        logger.info(f"🔍 Starting AI analysis for user {user.username}")
        result = analyze_user_and_generate_feedback(user)
        
        # Format response for frontend
        return JsonResponse(result)
    
    except Exception as e:
        logger.exception(f"Error in analyze_user_ai_ajax: {e}")
        import traceback
        return JsonResponse({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)


@require_GET
@login_required
@user_passes_test(is_admin_or_staff)
def list_ai_reports_ajax(request):
    """
    AJAX endpoint: List all saved AI analysis reports.
    
    Query params:
    - user_id: Optional - filter by user
    
    Returns JSON:
    {
        "success": true,
        "reports": [
            {
                "filename": "user_1_alex_20251210_143022.json",
                "filepath": "/path/to/report.json",
                "user_id": 1,
                "username": "alex",
                "generated_at": "2025-12-10T14:30:22",
                "file_size": 12345
            }
        ]
    }
    """
    try:
        from dailycast.ai_analyzer import get_all_user_reports
        
        user_id = request.GET.get('user_id')
        user_filter = None
        
        if user_id:
            try:
                user_filter = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': f'User with ID {user_id} not found'
                }, status=404)
        
        reports = get_all_user_reports(user=user_filter)
        
        return JsonResponse({
            'success': True,
            'reports': reports,
            'count': len(reports)
        })
    
    except Exception as e:
        logger.exception(f"Error in list_ai_reports_ajax: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
