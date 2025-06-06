from rest_framework import status, generics
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db.models import Case, When, Value, IntegerField
from .models import Course
from lessons.models import Lesson
from .serializers import CourseSerializer, LessonSerializer
from enrollment.models import Enrollment
from django.http import Http404
from quizzes.models import Quiz
from quizzes.serializers import QuizSerializer
from django.db.models import Count, Q
from rest_framework.viewsets import ModelViewSet

class CourseViewSet(ModelViewSet):
    serializer_class = CourseSerializer

    def get_queryset(self):
        return Course.objects.all().annotate(
            enrolled_count=Count('enrollment', distinct=True),
            completed_count=Count(
                'coursecompletion',
                filter=Q(coursecompletion__user__isnull=False),
                distinct=True
            )
        )
    
    
class DetachQuizFromCourseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        course = get_object_or_404(Course.all_objects, permalink=permalink, created_by=request.user)
        quiz_id = request.data.get("quiz_id")

        if not quiz_id:
            return Response({"error": "Quiz ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        quiz = get_object_or_404(Quiz, id=quiz_id, created_by=request.user)

        if quiz.course != course:
            return Response({"error": "This quiz is not attached to this course."},
                            status=status.HTTP_400_BAD_REQUEST)

        quiz.course = None
        quiz.save()

        serializer = QuizSerializer(quiz, context={"request": request})

        return Response({"message": "Quiz detached successfully.", "quiz": serializer.data})



class PublishCourseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        course = get_object_or_404(Course.all_objects, permalink=permalink, created_by=request.user)
        course.is_draft = False
        course.save()
        return Response({"message": "Course published successfully."})

class SuggestedCoursesView(generics.ListAPIView):
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        subject_id = self.request.query_params.get('subject', None)
        user = self.request.user
        enrolled_courses_ids = Enrollment.objects.filter(
            user=user, 
            enrollment_type="course"
        ).values_list('object_id', flat=True)
        # Use the published manager (Course.objects) to get only published courses.
        qs = Course.objects.all()
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        qs = qs.exclude(id__in=enrolled_courses_ids)
        return qs.order_by('?')

class DraftCourseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, permalink):
        # Use all_objects to access drafts.
        course = get_object_or_404(Course.all_objects, permalink=permalink, is_draft=True)
        if course.created_by != request.user and request.user not in course.allowed_testers.all():
            return Response({"error": "You don't have permission to view this draft."}, status=403)
        lessons = Lesson.objects.filter(course=course)
        return Response({
            "course": CourseSerializer(course, context={"request": request}).data,
            "lessons": LessonSerializer(lessons, many=True).data
        })

class DetachLessonFromCourseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        course = get_object_or_404(Course.all_objects, permalink=permalink, created_by=request.user)
        lesson_id = request.data.get("lesson_id")
        if not lesson_id:
            return Response({"error": "Lesson ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        lesson = get_object_or_404(Lesson, id=lesson_id, created_by=request.user)
        if lesson.course != course:
            return Response({"error": "This lesson is not attached to this course."}, status=status.HTTP_400_BAD_REQUEST)
        lesson.course = None
        lesson.save()
        serializer = LessonSerializer(lesson)
        return Response({"message": "Lesson detached successfully.", "lesson": serializer.data})

class AddLessonToCourseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        course = get_object_or_404(Course.all_objects, permalink=permalink, created_by=request.user)
        lesson_id = request.data.get("lesson_id")
        if not lesson_id:
            return Response({"error": "Lesson ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        lesson = get_object_or_404(Lesson, id=lesson_id, created_by=request.user)
        if lesson.course is not None:
            return Response({"error": "This lesson is already attached to a course."}, status=status.HTTP_400_BAD_REQUEST)
        lesson.course = course
        lesson.save()
        serializer = LessonSerializer(lesson)
        return Response({"message": "Lesson added successfully.", "lesson": serializer.data})

class MyCoursesView(generics.ListAPIView):
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Show all courses (draft or published) created by the user
        return Course.all_objects.filter(created_by=self.request.user).order_by('-created_at')

class CourseListCreateView(generics.ListCreateAPIView):
    serializer_class = CourseSerializer

    def get_queryset(self):
        queryset = Course.objects.all()
        username = self.request.query_params.get('created_by')
        if username:
            queryset = queryset.filter(created_by__username=username)
        return queryset
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class CourseRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.all_objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "permalink"

    def get_object(self):
        obj = get_object_or_404(Course.all_objects, permalink=self.kwargs.get("permalink"))
        
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            if obj.created_by != self.request.user:
                self.permission_denied(self.request, message="Not allowed to modify this course")
            if obj.is_locked:
                self.permission_denied(self.request, message="This course is locked and cannot be modified.")
        
        return obj
    

class CourseDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, permalink):
        course = get_object_or_404(Course.all_objects, permalink=permalink)
        # If the course is a draft, only allow access to the creator or allowed testers.
        if course.is_draft:
            if not request.user.is_authenticated or (request.user != course.created_by and request.user not in course.allowed_testers.all()):
                raise Http404("Course not found.")
        lessons = Lesson.objects.filter(course=course).order_by(
            Case(When(course__isnull=True, then=Value(0)), default=Value(1), output_field=IntegerField()),
            'title'
        )
        is_owner = request.user.is_authenticated and request.user == course.created_by
        return Response({
            "course": CourseSerializer(course, context={"request": request}).data,
            "lessons": LessonSerializer(lessons, many=True).data,
            "seo": {
                "title": course.seo_title or course.title,
                "description": course.seo_description or "Learn more about this course.",
                "canonical_url": request.build_absolute_uri(),
                "og_title": course.og_title or course.title,
                "og_description": course.og_description or course.seo_description,
                "og_image": course.og_image if course.og_image else "/static/default-image.jpg",
            },
            "is_owner": is_owner
        })
    

class DynamicCourseView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, permalink):
        course = get_object_or_404(Course.all_objects, permalink=permalink)
        
        # If the course is a draft, only allow access to the creator or allowed testers.
        if course.is_draft:
            if not request.user.is_authenticated or (request.user != course.created_by and request.user not in course.allowed_testers.all()):
                raise Http404("Course not found.")
                
        lessons = Lesson.objects.filter(course=course).order_by('title')
        is_owner = request.user.is_authenticated and request.user == course.created_by
        progress_percentage = 0
        if request.user.is_authenticated:
            from lessons.models import LessonCompletion
            completed_count = LessonCompletion.objects.filter(
                user=request.user,
                lesson__course=course
            ).count()
            total_lessons = lessons.count()
            if total_lessons > 0:
                progress_percentage = int((completed_count / total_lessons) * 100)
                
        return Response({
            "course": CourseSerializer(course, context={"request": request}).data,
            "lessons": LessonSerializer(lessons, many=True).data,
            "seo": {
                "title": course.seo_title or course.title,
                "description": course.seo_description or "Learn more about this course.",
                "canonical_url": request.build_absolute_uri(),
                "og_title": course.og_title or course.title,
                "og_description": course.og_description or course.seo_description,
                "og_image": course.og_image if course.og_image else "/static/default-image.jpg",
            },
            "is_owner": is_owner,
            "progress": progress_percentage,
        })
    
class AddQuizToCourseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        # Get the course by its permalink and check that the request user is the creator.
        course = get_object_or_404(Course.all_objects, permalink=permalink, created_by=request.user)
        
        # Get quiz_id from the request data.
        quiz_id = request.data.get("quiz_id")
        if not quiz_id:
            return Response({"error": "Quiz ID is required."}, status=400)
        
        # Get the quiz and verify ownership.
        quiz = get_object_or_404(Quiz, id=quiz_id, created_by=request.user)
        if quiz.course is not None:
            return Response({"error": "This quiz is already attached to a course."}, status=400)
        
        # Attach the quiz to the course.
        quiz.course = course
        quiz.save()
        
        serializer = QuizSerializer(quiz, context={"request": request})
        return Response({"message": "Quiz added successfully.", "quiz": serializer.data})