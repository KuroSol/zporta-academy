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
      - 'suggested_courses': personalized course recommendations
      - 'suggested_quizzes': personalized quiz recommendations
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user  = request.user
        limit = int(request.query_params.get('limit', 5))

        # 1) Enrolled courses
        enroll_qs = Enrollment.objects.filter(user=user, enrollment_type='course')
        enrolled  = EnrollmentSerializer(enroll_qs, many=True, context={'request': request}).data

        # 2) Course suggestions by subject interest
        lesson_ct = ContentType.objects.get_for_model(Lesson)
        quiz_ct   = ContentType.objects.get_for_model(Quiz)
        subject_ids = set()
        events = ActivityEvent.objects.filter(
            user=user,
            event_type__in=['lesson_clicked','quiz_started','quiz_submitted','quiz_answer_submitted']
        )
        for ev in events:
            if ev.content_type_id == lesson_ct.id:
                try:
                    subject_ids.add(Lesson.objects.get(pk=ev.object_id).course.subject_id)
                except:
                    pass
            elif ev.content_type_id == quiz_ct.id:
                try:
                    subject_ids.add(Quiz.objects.get(pk=ev.object_id).subject_id)
                except:
                    pass
        enrolled_ids = [e['course']['id'] for e in enrolled if e.get('course')]
        course_qs    = Course.objects.filter(is_draft=False)
        if subject_ids:
            course_qs = course_qs.filter(subject_id__in=subject_ids)
        if enrolled_ids:
            course_qs = course_qs.exclude(id__in=enrolled_ids)
        suggested_courses = CourseSerializer(course_qs.order_by('?')[:limit], many=True, context={'request': request}).data

        # 3) Quiz suggestions by activity
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
        if taken_quiz_ids:
            pool = Quiz.objects.exclude(id__in=taken_quiz_ids)
            related_subj = list(
                Quiz.objects.filter(id__in=taken_quiz_ids, subject__isnull=False)
                    .values_list('subject_id', flat=True).distinct()
            )
            if related_subj:
                pool = pool.filter(subject_id__in=related_subj)
            quiz_qs = pool.order_by('?')[:limit]
        else:
            quiz_qs = Quiz.objects.filter(is_public=True).order_by('-created_at')[:limit]
        suggested_quizzes = QuizSerializer(quiz_qs, many=True, context={'request': request}).data


        # 4) Lesson feed
        lesson_ct = ContentType.objects.get_for_model(Lesson)
        # IDs of lessons the user has already clicked or completed
        completed_ids = ActivityEvent.objects.filter(
            user=user,
            content_type=lesson_ct,
            event_type__in=['lesson_clicked','lesson_completed']
        ).values_list('object_id', flat=True).distinct()

        # All lessons in courses this user is enrolled in
        enrolled_course_ids = enroll_qs.values_list('object_id', flat=True)
        lessons_qs = Lesson.objects.filter(
            course_id__in=enrolled_course_ids,
        )

        # “Next lessons” = those not yet in completed_ids
        next_lessons_qs = lessons_qs.exclude(id__in=completed_ids).order_by('?')[:limit]
        # “Suggested lessons” = random picks (could be any in the enrolled courses)
        suggested_lessons_qs = lessons_qs.order_by('?')[:limit]

        # Serialize them
        next_lessons = NextLessonFeedItemSerializer(
            next_lessons_qs, many=True, context={'request': request}
        ).data
        suggested_lessons = SuggestedLessonFeedItemSerializer(
            suggested_lessons_qs, many=True, context={'request': request}
        ).data
        
        # 5) Return everything
        return Response({
            'enrolled':           enrolled,
            'suggested_courses':  suggested_courses,
            'suggested_quizzes':  suggested_quizzes,
            'next_lessons':       next_lessons,
            'suggested_lessons':  suggested_lessons,
        })