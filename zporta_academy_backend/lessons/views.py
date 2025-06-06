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
from rest_framework.viewsets import ModelViewSet


class LessonViewSet(ModelViewSet):
    serializer_class = LessonSerializer

    def get_queryset(self):
        return Lesson.objects.all().annotate(
            completed_count=Count(
                'learningrecord',
                filter=Q(learningrecord__is_completed=True),
                distinct=True
            )
        )

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
        queryset = Lesson.objects.all()
        username = self.request.query_params.get('created_by')
        if username:
            queryset = queryset.filter(created_by__username=username)
        return queryset

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]  # Allow anyone to list lessons
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


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
        seo = {
            "title": lesson.seo_title or lesson.title,
            "description": lesson.seo_description,
            "canonical_url": lesson.canonical_url or request.build_absolute_uri(),
            "og_title": lesson.og_title or lesson.title,
            "og_description": lesson.og_description,
            "og_image": lesson.og_image or "/static/default_lesson_image.jpg",
        }
        if lesson.course and lesson.course.course_type == "premium":
            attached_course = {
                "title": lesson.course.title,
                "permalink": lesson.course.permalink,
            }
            if not request.user.is_authenticated:
                return Response({
                    "lesson": None,
                    "seo": seo,
                    "message": f"This lesson is connected to a premium course: {lesson.course.title}. Please log in and enroll to access it.",
                    "course": attached_course,
                }, status=status.HTTP_403_FORBIDDEN)
            course_ct = ContentType.objects.get_for_model(lesson.course)
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
                    "message": f"This lesson is connected to a premium course: {lesson.course.title}. Please enroll in the course to access it.",
                    "course": attached_course,
                }, status=status.HTTP_403_FORBIDDEN)
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
        lessons = Lesson.objects.filter(created_by=request.user)
        serializer = LessonSerializer(lessons, many=True)
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
    
class LessonTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LessonTemplate.objects.all()
    serializer_class = LessonTemplateSerializer