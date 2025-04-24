# learning/views.py

from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.contenttypes.models import ContentType

from .models import LearningRecord
from .serializers import LearningRecordSerializer
from enrollment.models import Enrollment
from enrollment.serializers import EnrollmentSerializer
from courses.models import Course
from courses.serializers import CourseSerializer
from lessons.models import Lesson
from quizzes.models import Quiz
from quizzes.serializers import QuizSerializer
from analytics.models import ActivityEvent

from lessons.models import Lesson
from .serializers import NextLessonFeedItemSerializer, SuggestedLessonFeedItemSerializer
from django.contrib.contenttypes.models import ContentType
from analytics.models import ActivityEvent
from django.utils import timezone
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

class LearningRecordListView(generics.ListAPIView):
    """
    Raw list of LearningRecords for the current user.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = LearningRecordSerializer

    def get_queryset(self):
        return LearningRecord.objects.filter(
            enrollment__user=self.request.user
        ).select_related('enrollment', 'subject')

class StudyDashboardView(APIView):
    """
    Returns:
      - 'enrolled': courses the user has started
      - 'suggested_courses': personalized course recommendations (with fallback)
      - 'suggested_quizzes': personalized quiz recommendations (with fallback)
      - 'next_lessons': lessons next in sequence for enrolled courses
      - 'suggested_lessons': suggested lessons (with fallback)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user  = request.user
        limit = int(request.query_params.get('limit', 5))

        # 1) Enrolled courses (Needed for filtering suggestions and finding lessons)
        enroll_qs = Enrollment.objects.filter(user=user, enrollment_type='course')
        enrolled_course_ids = enroll_qs.values_list('object_id', flat=True)
        enrolled_serialized = EnrollmentSerializer(enroll_qs, many=True, context={'request': request}).data

        # --- Content Type Lookups ---
        lesson_ct = ContentType.objects.get_for_model(Lesson)
        quiz_ct   = ContentType.objects.get_for_model(Quiz)

        # --- Determine Subject Interests from Activity ---
        subject_ids = set()
        events = ActivityEvent.objects.filter(
            user=user,
            event_type__in=['lesson_clicked','quiz_started','quiz_submitted','quiz_answer_submitted']
        ).select_related('content_type') # Optimize content type lookup

        for ev in events:
            try:
                if ev.content_type_id == lesson_ct.id:
                    # Fetch lesson and related course/subject efficiently
                    lesson = Lesson.objects.select_related('course__subject').only('course__subject_id').get(pk=ev.object_id)
                    if lesson.course and lesson.course.subject_id:
                        subject_ids.add(lesson.course.subject_id)
                elif ev.content_type_id == quiz_ct.id:
                    # Fetch quiz and related subject efficiently
                    quiz = Quiz.objects.only('subject_id').get(pk=ev.object_id)
                    if quiz.subject_id:
                        subject_ids.add(quiz.subject_id)
            except (Lesson.DoesNotExist, Quiz.DoesNotExist):
                pass # Ignore events for deleted objects

        # --- 2) Course Suggestions ---
        # Base query for non-draft courses
        course_qs = Course.objects.filter(is_draft=False) # Assuming Course has 'is_draft'

        # Try personalized suggestions first
        personalized_course_qs = course_qs
        if subject_ids:
            personalized_course_qs = personalized_course_qs.filter(subject_id__in=subject_ids)
        if enrolled_course_ids:
            personalized_course_qs = personalized_course_qs.exclude(id__in=enrolled_course_ids)

        # Check if personalized suggestions exist
        if personalized_course_qs.exists():
            final_course_qs = personalized_course_qs.order_by('?')[:limit]
        else:
            # Fallback 1: Newest public courses, excluding enrolled
            fallback_course_qs = course_qs.exclude(id__in=enrolled_course_ids).order_by('-created_at')[:limit]
            if fallback_course_qs.exists():
                final_course_qs = fallback_course_qs
            else:
                # Fallback 2: Any newest public courses if fallback 1 is empty
                final_course_qs = course_qs.order_by('-created_at')[:limit]

        suggested_courses = CourseSerializer(final_course_qs, many=True, context={'request': request}).data

        # --- 3) Quiz Suggestions ---
        taken_quiz_ids = list(
            ActivityEvent.objects.filter(
                user=user,
                content_type=quiz_ct,
                event_type__in=['quiz_started','quiz_submitted','quiz_answer_submitted']
            )
            .order_by('-timestamp')
            .values_list('object_id', flat=True)
            .distinct()[:20]
        )

        # Base query for quizzes (consider adding filters like is_locked=False if applicable)
        base_quiz_qs = Quiz.objects.all() # Start with all quizzes

        if taken_quiz_ids:
            # Try personalized based on related subjects
            related_subj_ids = list(
                Quiz.objects.filter(id__in=taken_quiz_ids, subject__isnull=False)
                    .values_list('subject_id', flat=True).distinct()
            )
            personalized_quiz_qs = base_quiz_qs.exclude(id__in=taken_quiz_ids)
            if related_subj_ids:
                 personalized_quiz_qs = personalized_quiz_qs.filter(subject_id__in=related_subj_ids)

            if personalized_quiz_qs.exists():
                final_quiz_qs = personalized_quiz_qs.order_by('?')[:limit]
            else:
                # Fallback if personalized (excluding taken) yields nothing: suggest unrelated free quizzes
                final_quiz_qs = base_quiz_qs.filter(quiz_type='free').exclude(id__in=taken_quiz_ids).order_by('?')[:limit]
        else:
            # Fallback for users with no quiz activity: Newest free quizzes
            final_quiz_qs = base_quiz_qs.filter(quiz_type='free').order_by('-created_at')[:limit]

        # Final Fallback: If still no quizzes found, get *any* newest quiz
        if not final_quiz_qs.exists():
             final_quiz_qs = Quiz.objects.all().order_by('-created_at')[:limit] # Use Quiz.objects directly here

        suggested_quizzes = QuizSerializer(final_quiz_qs, many=True, context={'request': request}).data


        # --- 4) Lesson Feed ---
        # Base query for lessons in enrolled courses
        lessons_qs = Lesson.objects.filter(
            course_id__in=enrolled_course_ids,
            # is_draft=False # Add if Lesson model has 'is_draft'
        )

        # 4a) Next Lessons (Specific to enrollment, no global fallback)
        completed_lesson_ids = ActivityEvent.objects.filter(
            user=user,
            content_type=lesson_ct,
            event_type__in=['lesson_clicked','lesson_completed']
        ).values_list('object_id', flat=True).distinct()

        next_lessons_qs = lessons_qs.exclude(id__in=completed_lesson_ids).order_by('course__title', 'id')[:limit] # Ordered by course/lesson ID

        next_lessons = NextLessonFeedItemSerializer(
            next_lessons_qs, many=True, context={'request': request}
        ).data

        # 4b) Suggested Lessons (Random from enrolled courses, with global fallback)
        suggested_lessons_enrolled_qs = lessons_qs.order_by('?')[:limit]

        if suggested_lessons_enrolled_qs.exists():
             final_suggested_lessons_qs = suggested_lessons_enrolled_qs
        else:
             # Fallback: Newest public lessons globally if no suggestions from enrolled courses
             # Assuming Lesson has a relation 'course' with 'is_draft' field
             final_suggested_lessons_qs = Lesson.objects.filter(course__is_draft=False).order_by('-created_at')[:limit]

        suggested_lessons = SuggestedLessonFeedItemSerializer(
            final_suggested_lessons_qs, many=True, context={'request': request}
        ).data

        # --- 5) Return everything ---
        return Response({
            'enrolled':           enrolled_serialized, # Use the serialized variable
            'suggested_courses':  suggested_courses,
            'suggested_quizzes':  suggested_quizzes,
            'next_lessons':       next_lessons,
            'suggested_lessons':  suggested_lessons,
        })
