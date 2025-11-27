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
from django.utils import timezone

class CourseViewSet(ModelViewSet):
    serializer_class = CourseSerializer

    def get_queryset(self):
        return Course.objects.select_related(
            'created_by', 'subject'
        ).prefetch_related(
            'allowed_testers'
        ).annotate(
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
        course = get_object_or_404(Course.all_objects, permalink=permalink)
        if not (request.user == course.created_by or request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
 
        course.is_draft = False
        course.save()
        return Response({"message": "Course published successfully."})

class UnpublishCourseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        course = get_object_or_404(Course.all_objects, permalink=permalink)
        # only owner, staff, or superuser can unpublish
        if not (request.user == course.created_by or request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # cannot change locked courses
        if getattr(course, "is_locked", False):
            return Response({"error": "This course is locked and cannot be modified."},
                            status=status.HTTP_400_BAD_REQUEST)

        # only allow unpublish when no one enrolled
        has_enrollments = Enrollment.objects.filter(
            enrollment_type="course",
            object_id=course.id
        ).exists()
        if has_enrollments:
            return Response({"error": "Cannot set to draft because enrollments exist."},
                            status=status.HTTP_400_BAD_REQUEST)

        course.is_draft = True
        course.save(update_fields=["is_draft"])
        return Response({"message": "Course set to draft successfully."})


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
        if not (
            request.user == course.created_by
            or request.user in course.allowed_testers.all()
            or request.user.is_staff
            or request.user.is_superuser
        ):
            return Response({"error": "You don't have permission to view this draft."}, status=403)
        lessons = Lesson.objects.filter(course=course).order_by('position', 'created_at')
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
        # Assign next position at the end of current list
        last = Lesson.objects.filter(course=course).order_by('-position').first()
        next_pos = (last.position + 1) if last and last.position is not None else 1
        lesson.course = course
        lesson.position = next_pos
        lesson.save(update_fields=["course", "position"])
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
        # serializer.create already respects 'publish' flag
        serializer.save(created_by=self.request.user)

class CourseRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.all_objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "permalink"

    def get_object(self):
        obj = get_object_or_404(Course.all_objects, permalink=self.kwargs.get("permalink"))
        
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            # Debug logging
            print(f"\n{'='*60}")
            print(f"=== Course Update Permission Check ===")
            print(f"Method: {self.request.method}")
            print(f"User authenticated: {self.request.user.is_authenticated}")
            print(f"User: {self.request.user}")
            if self.request.user.is_authenticated:
                print(f"User ID: {self.request.user.id}")
                print(f"User username: {self.request.user.username}")
            print(f"Course: {obj.title}")
            print(f"Course creator: {obj.created_by}")
            if obj.created_by:
                print(f"Creator ID: {obj.created_by.id}")
                print(f"Creator username: {obj.created_by.username}")
            print(f"User == Creator: {obj.created_by == self.request.user}")
            print(f"User ID == Creator ID: {self.request.user.id == obj.created_by.id if self.request.user.is_authenticated and obj.created_by else 'N/A'}")
            print(f"Is locked: {obj.is_locked}")
            print('='*60 + '\n')
            
            # Check ownership for all modification operations
            if obj.created_by != self.request.user:
                print(f"PERMISSION DENIED: User {self.request.user} is not the creator {obj.created_by}")
                self.permission_denied(self.request, message="Not allowed to modify this course")
            
            # Only check lock status for DELETE operations
            if self.request.method == 'DELETE' and obj.is_locked:
                print(f"PERMISSION DENIED: Course is locked - cannot delete")
                self.permission_denied(self.request, message="This course is locked and cannot be deleted.")
        
        return obj
    

class CourseDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, permalink):
        course = get_object_or_404(Course.all_objects, permalink=permalink)
        # optional public preview flag
        as_public = str(request.query_params.get("as_public", "")).lower() in ("1", "true", "yes")
        # If the course is a draft, only allow access to the creator or allowed testers.
        if course.is_draft:
            if not request.user.is_authenticated or not (
                request.user == course.created_by
                or request.user in course.allowed_testers.all()
                or request.user.is_staff
                or request.user.is_superuser
            ):
                raise Http404("Course not found.")
        # For public view, hide draft lessons unless the requester is owner/staff/tester
        base_lessons = Lesson.objects.filter(course=course)
        is_privileged = request.user.is_authenticated and (
            request.user == course.created_by or request.user.is_staff or request.user.is_superuser
        )
        lessons_qs = base_lessons if is_privileged else base_lessons.filter(status=Lesson.PUBLISHED)
        lessons = lessons_qs.order_by('position', 'created_at')
        is_owner = request.user.is_authenticated and request.user == course.created_by
        return Response({
            "course": CourseSerializer(course, context={"request": request}).data,
            "lessons": LessonSerializer(lessons, many=True).data,
            "view_mode": "public" if as_public else "default",
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
        course = get_object_or_404(
            Course.all_objects.select_related('created_by', 'subject').prefetch_related('allowed_testers'),
            permalink=permalink
        )
        
        # If the course is a draft, only allow access to the creator or allowed testers.
        if course.is_draft:
            if not request.user.is_authenticated or not (
                request.user == course.created_by
                or request.user in course.allowed_testers.all()
                or request.user.is_staff
                or request.user.is_superuser
            ):
                raise Http404("Course not found.")
                
        # Public dynamic view should also hide drafts for non-owners
        base_lessons = Lesson.objects.filter(course=course).select_related('created_by', 'course', 'subject')
        is_privileged = request.user.is_authenticated and (
            request.user == course.created_by or request.user.is_staff or request.user.is_superuser
        )
        lessons = (base_lessons if is_privileged else base_lessons.filter(status=Lesson.PUBLISHED)).order_by('position', 'created_at')
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
                
        response_data = {
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
        }
        resp = Response(response_data)
        # Cache public course views for anonymous users only
        if not request.user.is_authenticated and not course.is_draft:
            from django.utils.cache import patch_cache_control
            patch_cache_control(resp, public=True, max_age=300, s_maxage=300)
        return resp
    
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


class BulkPublishLessonsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        course = get_object_or_404(Course.all_objects, permalink=permalink)
        # only owner, staff, or superuser
        if not (request.user == course.created_by or request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # cannot publish lessons while course is draft
        if course.is_draft:
            return Response({"error": "Publish the course first before publishing its lessons."}, status=status.HTTP_400_BAD_REQUEST)

        # select draft lessons attached to this course
        draft_lessons = Lesson.objects.filter(course=course, status=Lesson.DRAFT)
        if not draft_lessons.exists():
            return Response({"message": "No draft lessons to publish.", "published_count": 0})

        published_count = 0
        for lesson in draft_lessons:
            # For premium lessons, ensure course is premium
            if lesson.is_premium and getattr(course, "course_type", None) != "premium":
                # skip invalid premium lessons; keep them draft
                continue
            lesson.status = Lesson.PUBLISHED
            lesson.published_at = timezone.now()
            lesson.save(update_fields=["status", "published_at"])
            published_count += 1

        return Response({"message": "Lessons published.", "published_count": published_count})

class ReorderLessonsInCourseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permalink):
        """
        Reorder lessons within a course. Body: {"order": [lesson_id, ...]}
        Only the course owner (or staff/superuser) can reorder.
        Lessons not included will be appended after, preserving current order.
        """
        course = get_object_or_404(Course.all_objects, permalink=permalink)
        if not (request.user == course.created_by or request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        order = request.data.get("order")
        if not isinstance(order, list) or not all(isinstance(i, int) for i in order):
            return Response({"error": "Provide 'order' as a list of lesson IDs."}, status=status.HTTP_400_BAD_REQUEST)

        course_lessons = list(Lesson.objects.filter(course=course).values_list('id', flat=True))
        filtered_ids = [lid for lid in order if lid in course_lessons]
        missing_ids = [lid for lid in course_lessons if lid not in filtered_ids]
        final_order = filtered_ids + missing_ids

        from django.db import transaction
        with transaction.atomic():
            for idx, lesson_id in enumerate(final_order, start=1):
                Lesson.objects.filter(id=lesson_id, course=course).update(position=idx)

        lessons = Lesson.objects.filter(course=course).order_by('position', 'created_at')
        return Response({
            "message": "Lesson order updated.",
            "lessons": LessonSerializer(lessons, many=True).data
        })