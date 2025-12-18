"""URL configuration for dailycast AJAX endpoints."""
from django.urls import path
from dailycast.views_admin_ajax import (
    get_user_courses_ajax,
    get_course_details_ajax,
    regenerate_audio_ajax,
    generate_script_ajax,
    get_llm_models_ajax,
    get_field_help_text_ajax,
    get_tts_voices_ajax,
    analyze_user_ai_ajax,
    list_ai_reports_ajax,
    analyze_english_level_ajax,
)

app_name = 'dailycast_ajax'

urlpatterns = [
    # User courses/lessons/quizzes lookup
    path('user-courses/', get_user_courses_ajax, name='user-courses'),
    path('course-details/', get_course_details_ajax, name='course-details'),
    # Audio regeneration (single podcast from edit form)
    path('regenerate-audio/', regenerate_audio_ajax, name='regenerate-audio'),
    # Script generation (from customization form)
    path('generate-script/', generate_script_ajax, name='generate-script'),
    # LLM model selection dropdown
    path('llm-models/', get_llm_models_ajax, name='llm-models'),
    # Field help text and descriptions
    path('field-help/', get_field_help_text_ajax, name='field-help'),
    # TTS voice selection by provider
    path('tts-voices/', get_tts_voices_ajax, name='tts-voices'),
    # AI-powered user analysis and recommendations
    path('analyze-user/', analyze_user_ai_ajax, name='analyze-user'),
    path('ai-reports/', list_ai_reports_ajax, name='ai-reports'),
    # English level analyzer from student notes
    path('analyze-english-level/', analyze_english_level_ajax, name='analyze-english-level'),
]
