from rest_framework import generics, status, permissions
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from django.contrib.contenttypes.models import ContentType
from rest_framework.response import Response
from .serializers import LessonSerializer
from .models import Lesson, LessonCompletion
from enrollment.models import Enrollment
from courses.models import Course
from .serializers import SimpleLessonCompletionSerializer 
from quizzes.models import Quiz
from quizzes.serializers import QuizSerializer
from .models import LessonTemplate
from .serializers import LessonTemplateSerializer
from rest_framework import viewsets
from rest_framework import viewsets
from django.db.models import Count, Q
from django.utils import timezone
from django.db import transaction
from rest_framework.viewsets import ModelViewSet
from django.utils.cache import patch_cache_control
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator

class LessonViewSet(ModelViewSet):
    serializer_class = LessonSerializer

    def get_queryset(self):
        qs = Lesson.objects.all().annotate(
            completed_count=Count('completions', distinct=True)
        )
        user = self.request.user
        if user.is_authenticated:
            return qs.filter(Q(status=Lesson.PUBLISHED) | Q(created_by=user))
        return qs.filter(status=Lesson.PUBLISHED)

class EnrollmentLessonCompletionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, enrollment_id):
        # 1) verify that this enrollment belongs to the user
        enrollment = get_object_or_404(
            Enrollment, id=enrollment_id, user=request.user
        )
        # 2) pull all completions for lessons in that course
        completions = LessonCompletion.objects.filter(
            user=request.user,
            lesson__course=enrollment.content_object  # or lesson__course_id=enrollment.object_id
        )
        serializer = SimpleLessonCompletionSerializer(
            completions, many=True, context={"request": request}
        )
        return Response(serializer.data)

class RecentLessonCompletionsView(generics.ListAPIView):
    """
    Returns the 3 most recent lessons completed by the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SimpleLessonCompletionSerializer

    def get_queryset(self):
        return LessonCompletion.objects.filter(
            user=self.request.user
        ).select_related(
            'lesson', 'lesson__course' # Preload lesson and course data
        ).order_by('-completed_at')[:3] # Order by most recent, limit to 3
    

class LessonEnrollmentCompletionStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, permalink):
        lesson = get_object_or_404(Lesson, permalink=permalink)
        is_enrolled = False # Default to not enrolled
        is_completed = False # Default to not completed

        # Check if the lesson is actually part of a course before checking course enrollment
        if lesson.course: # <--- ADD THIS CHECK
            course_content_type = ContentType.objects.get_for_model(Course)
            is_enrolled = Enrollment.objects.filter(
                user=request.user,
                content_type=course_content_type,
                object_id=lesson.course.id, # Now safe to access .id
                enrollment_type="course"
            ).exists()

        # Check lesson completion status (independent of course enrollment)
        is_completed = LessonCompletion.objects.filter(
            user=request.user,
            lesson=lesson
        ).exists()

        return Response({
            "is_enrolled": is_enrolled,
            "is_completed": is_completed
        })

class LessonListCreateView(generics.ListCreateAPIView):
    """
    GET: List all lessons (public)
    POST: Create a new lesson (requires authentication; lesson is linked to request.user)
    """
    serializer_class = LessonSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Lesson.objects.all()
        username = self.request.query_params.get('created_by')

        if username:
            qs = qs.filter(created_by__username=username)
            # If looking at someone else’s lessons, only show published
            if not (user.is_authenticated and user.username == username):
                qs = qs.filter(status=Lesson.PUBLISHED)
            return qs

        # No username filter: show published to public; owner sees own drafts too
        if user.is_authenticated:
            return qs.filter(Q(status=Lesson.PUBLISHED) | Q(created_by=user))
        return qs.filter(status=Lesson.PUBLISHED)

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]  # Allow anyone to list lessons
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


@method_decorator(never_cache, name="dispatch")
class LessonRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or delete a lesson by its permalink.
    Only the lesson creator is allowed to update or delete.
    Locked lessons (after enrollment) cannot be edited or deleted.
    """
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "permalink"

    def get_object(self):
        lesson = get_object_or_404(Lesson, permalink=self.kwargs.get("permalink"))

        # Check if request method is modifying data
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            
            # Check lesson ownership explicitly
            if lesson.created_by != self.request.user:
                raise PermissionDenied("You are not allowed to modify or delete this lesson.")

            # Explicitly prevent editing/deletion if lesson is locked
            if lesson.is_locked:
                raise PermissionDenied("This lesson is locked after enrollment and cannot be modified or deleted.")

        return lesson


class DynamicLessonView(APIView):
    """
    Public detail view for a lesson (with SEO metadata).
    If the lesson is part of a premium course, enrollment is checked.
    """
    permission_classes = [AllowAny]

    def get(self, request, permalink):
        lesson = get_object_or_404(Lesson, permalink=permalink)
        # --- DRAFT PRIVACY: only creator (or staff) can see ---
        if lesson.status == Lesson.DRAFT:
            if not request.user.is_authenticated or (
                lesson.created_by != request.user and not request.user.is_staff
            ):
                # Hide existence of drafts from others
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
            
        seo = {
            "title": lesson.seo_title or lesson.title,
            "description": lesson.seo_description,
            "canonical_url": lesson.canonical_url or request.build_absolute_uri(),
            "og_title": lesson.og_title or lesson.title,
            "og_description": lesson.og_description,
            "og_image": lesson.og_image or "/static/default_lesson_image.jpg",
        }
         # Premium visibility is decided by the LESSON, not the course.
        if lesson.is_premium:
            attached_course = {
                "title": lesson.course.title if lesson.course else None,
                "permalink": lesson.course.permalink if lesson.course else None,

            }
            # Premium lessons should not be indexed (regardless of enrollment)
            seo["robots"] = "noindex,nofollow"
            # Allow creator and staff to always view/manage
            if request.user.is_authenticated and (lesson.created_by == request.user or request.user.is_staff):
                serializer = LessonSerializer(lesson, context={"request": request})
                resp = Response({"lesson": serializer.data, "seo": seo})
                patch_cache_control(resp, no_cache=True, no_store=True, must_revalidate=True, private=True, max_age=0, s_maxage=0)
                resp["Vary"] = "Accept, Cookie, Authorization, Origin"
                return resp

            # For everyone else, show a gated response (200), not 403, to avoid global logout.
            if not request.user.is_authenticated:
                return Response({
                    "lesson": None,
                    "seo": seo,
                    "access": "gated",
                    "message": f"Premium lesson\nThis lesson belongs to a premium course: {lesson.course.title if lesson.course else ''}. Log in and enroll to access.",
                    "course": attached_course,
                }, status=status.HTTP_200_OK)
                patch_cache_control(resp, no_cache=True, no_store=True, must_revalidate=True, private=True, max_age=0, s_maxage=0)
                resp["Vary"] = "Accept, Cookie, Authorization, Origin"
                return resp

            # If logged in: require enrollment (only when lesson is attached to a course)
            if not lesson.course:
                # No course to enroll into; keep premium lessons private
                resp = Response({
                    "lesson": None, "seo": seo, "access": "gated",
                    "message": "This premium lesson is not publicly accessible.",
                    "course": attached_course,
                }, status=status.HTTP_200_OK)
                patch_cache_control(resp, no_cache=True, no_store=True, must_revalidate=True, private=True, max_age=0, s_maxage=0)
                resp["Vary"] = "Accept, Cookie, Authorization, Origin"
                return resp

            course_ct = ContentType.objects.get_for_model(Course)
            enrollment_exists = Enrollment.objects.filter(
                user=request.user,
                object_id=lesson.course.id,
                content_type=course_ct,
                enrollment_type="course"
            ).exists()
            if not enrollment_exists:
                return Response({
                    "lesson": None,
                    "seo": seo,
                    "access": "gated",
                    "message": f"Premium lesson\nThis lesson belongs to a premium course: {lesson.course.title}. Enroll to access.",
                    "course": attached_course,
                }, status=status.HTTP_200_OK)
                patch_cache_control(resp, no_cache=True, no_store=True, must_revalidate=True, private=True, max_age=0, s_maxage=0)
                resp["Vary"] = "Accept, Cookie, Authorization, Origin"
                return resp

        serializer = LessonSerializer(lesson, context={"request": request})
        return Response({
            "lesson": serializer.data,
            "seo": seo
        })


class UserLessonsView(APIView):
    """
    Returns all lessons created by the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lessons = Lesson.objects.filter(created_by=request.user).order_by('-created_at')
        serializer = LessonSerializer(lessons, many=True, context={"request": request})
        return Response(serializer.data)

class UserUnattachedLessonsView(APIView):
    """
    Returns all lessons created by the authenticated user that are NOT attached to any course.
    Use this for the 'Add lesson to course' dropdown.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lessons = Lesson.objects.filter(
            created_by=request.user,
            course__isnull=True
        ).order_by('-created_at')
        serializer = LessonSerializer(lessons, many=True, context={"request": request})
        return Response(serializer.data)

class MarkLessonCompleteView(APIView):
    """
    Marks a specific lesson as completed by the authenticated user.
    If the lesson belongs to a premium course, user must be enrolled first.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        lesson = get_object_or_404(Lesson, permalink=permalink)

        # Premium-course guard
        if lesson.course and lesson.course.course_type == "premium":
            course_ct = ContentType.objects.get_for_model(Course)
            enrolled = Enrollment.objects.filter(
                user=request.user,
                content_type=course_ct,
                object_id=lesson.course.id,
                enrollment_type="course"
            ).exists()
            if not enrolled:
                return Response(
                    {"error": "You must be enrolled in the premium course to complete this lesson."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Create or fetch completion
        completion, created = LessonCompletion.objects.get_or_create(
            user=request.user,
            lesson=lesson
        )

        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        message     = "Lesson marked as complete." if created else "Lesson already completed."

        # Include the timestamp in the response if newly created
        payload = {
            "message":    message,
            "lesson_id":  lesson.id,
        }
        if created:
            # completed_at is auto-set by your model's auto_now_add
            payload["completed_at"] = completion.completed_at

        return Response(payload, status=status_code)

class PublishLessonView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        lesson = get_object_or_404(Lesson, permalink=permalink)
        if lesson.created_by != request.user and not request.user.is_staff:
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

        # Enforce premium publishing rules:
        # If the lesson is marked as premium, it must be attached to a premium course before it can be published.
        if lesson.is_premium:
            # Ensure an attached course exists
            if not lesson.course:
                return Response(
                    {"detail": "Premium lessons must be attached to a premium course before publishing."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Ensure the attached course is premium
            if getattr(lesson.course, "course_type", None) != "premium":
                return Response(
                    {"detail": "Premium lessons must be attached to a premium course before publishing."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Enforce course draft rule (for both free and premium)
        if lesson.course and getattr(lesson.course, "is_draft", False):
            return Response(
                {"detail": "Cannot publish a lesson while its course is in draft. Publish the course first or save the lesson as draft."},
                status=status.HTTP_400_BAD_REQUEST,
            )


        # After passing validations, publish the lesson.
        lesson.status = Lesson.PUBLISHED
        lesson.published_at = timezone.now()
        lesson.save(update_fields=["status", "published_at"])

        data = LessonSerializer(lesson, context={"request": request}).data
        return Response(data, status=status.HTTP_200_OK)


class AddQuizToLessonView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        # Only the lesson's creator can attach quizzes
        lesson = get_object_or_404(Lesson, permalink=permalink, created_by=request.user)
        quiz_id = request.data.get("quiz_id")
        if not quiz_id:
            return Response({"error": "Quiz ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        quiz = get_object_or_404(Quiz, id=quiz_id, created_by=request.user)
        if quiz.lesson is not None:
            return Response({"error": "This quiz is already attached to a lesson."},
                            status=status.HTTP_400_BAD_REQUEST)

        quiz.lesson = lesson
        quiz.save()
        serializer = QuizSerializer(quiz, context={"request": request})
        return Response({"message": "Quiz added successfully.", "quiz": serializer.data})


class DetachQuizFromLessonView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        lesson = get_object_or_404(Lesson, permalink=permalink, created_by=request.user)
        quiz_id = request.data.get("quiz_id")
        if not quiz_id:
            return Response({"error": "Quiz ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        quiz = get_object_or_404(Quiz, id=quiz_id, created_by=request.user)
        if quiz.lesson != lesson:
            return Response({"error": "This quiz is not attached to this lesson."},
                            status=status.HTTP_400_BAD_REQUEST)

        quiz.lesson = None
        quiz.save()
        serializer = QuizSerializer(quiz, context={"request": request})
        return Response({"message": "Quiz detached successfully.", "quiz": serializer.data})


class AttachCourseToLessonView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, permalink):
        # Only the lesson owner can attach a course
        lesson = get_object_or_404(Lesson, permalink=permalink, created_by=request.user)
        if lesson.is_locked:
            return Response({"error": "This lesson is locked and cannot be modified."}, status=status.HTTP_403_FORBIDDEN)

        course_id = request.data.get("course_id")
        if not course_id:
            return Response({"error": "course_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Allow attaching even to draft courses owned by the user
        course = get_object_or_404(Course.all_objects, id=course_id, created_by=request.user)

        if lesson.course is not None:
            return Response({"error": "This lesson is already attached to a course. Detach first."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Business rule: ensure that premium lessons only attach to premium courses
        if lesson.is_premium and getattr(course, "course_type", None) != "premium":
            return Response(
                {"error": "Premium lessons can only be attached to a premium course."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Free lessons can attach to any course (free or premium).
        lesson.course = course
        # If attaching to a draft course and lesson is published, revert to draft
        if getattr(course, "is_draft", False) and lesson.status == Lesson.PUBLISHED:
            lesson.status = Lesson.DRAFT
            lesson.published_at = None
            lesson.save(update_fields=["course", "status", "published_at"])
            msg = "Lesson attached to draft course. Lesson status reverted to draft."
        else:
            lesson.save(update_fields=["course"])
            msg = "Lesson attached to course."

        data = LessonSerializer(lesson, context={"request": request}).data
        return Response({"message": msg, "lesson": data}, status=status.HTTP_200_OK)


class DetachCourseFromLessonView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, permalink):
        # Only the lesson owner can detach its course
        lesson = get_object_or_404(Lesson, permalink=permalink, created_by=request.user)
        if lesson.is_locked:
            return Response({"error": "This lesson is locked and cannot be modified."}, status=status.HTTP_403_FORBIDDEN)

        if lesson.course is None:
            return Response({"error": "This lesson is not attached to any course."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Detach the course
        lesson.course = None
        # If the lesson is premium and currently published, revert to draft since it
        # no longer satisfies the premium publishing rules.
        message = "Lesson detached from course."
        if lesson.is_premium and lesson.status == Lesson.PUBLISHED:
            lesson.status = Lesson.DRAFT
            lesson.published_at = None
            message += " Status reverted to draft because premium lessons require a premium course."
            lesson.save(update_fields=["course", "status", "published_at"])
        else:
            lesson.save(update_fields=["course"])

        data = LessonSerializer(lesson, context={"request": request}).data
        return Response({"message": message, "lesson": data}, status=status.HTTP_200_OK)


class LessonTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LessonTemplate.objects.all()
    serializer_class = LessonTemplateSerializer