from rest_framework import generics, status, permissions
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from .permissions import FreeLessonOrAuthenticated
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
from django.db.models import Count, Q, Prefetch
from django.utils import timezone
from django.db import transaction
from rest_framework.viewsets import ModelViewSet
from django.utils.cache import patch_cache_control
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
from django.core.cache import cache
import hashlib
from .content_filters import mask_restricted_sections as _mask_restricted_sections
import zipfile
import io
from django.http import FileResponse
from user_media.models import UserMedia
import os
from bs4 import BeautifulSoup
from django.conf import settings
from urllib.parse import unquote, urlparse
import requests
from seo.utils import canonical_url

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
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "permalink"

    def get_queryset(self):
        """Optimize edit fetch to avoid loading heavy quiz data."""
        quiz_prefetch = Prefetch(
            'quizzes',
            queryset=Quiz.objects.only(
                'id', 'title', 'permalink', 'quiz_type', 'status',
                'lesson_id', 'course_id', 'subject_id', 'created_by_id'
            ).select_related('subject', 'created_by')
        )

        return (
            Lesson.objects
            .select_related('subject', 'course', 'created_by', 'template_ref')
            .prefetch_related('tags', quiz_prefetch)
        )

    def get_serializer_context(self):
        """Add is_edit_context flag to enable full quiz data in edit views"""
        context = super().get_serializer_context()
        context['is_edit_context'] = True
        return context

    def get_object(self):
        lesson = get_object_or_404(self.get_queryset(), permalink=self.kwargs.get("permalink"))

        # Only creator (or staff) may view this detail via the update endpoint
        if self.request.method in ['GET', 'HEAD', 'OPTIONS']:
            if lesson.created_by != self.request.user and not self.request.user.is_staff:
                raise PermissionDenied("You are not allowed to view this edit resource.")

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
    OPTIMIZED: Uses select_related, prefetch_related, and caching to minimize database queries.
    """
    permission_classes = [FreeLessonOrAuthenticated]

    def get(self, request, permalink):
        # Generate cache key based on permalink and user authentication status
        user_id = request.user.id if request.user.is_authenticated else 'anon'
        cache_key = f'lesson:{permalink}:user:{user_id}'
        
        # Try to get cached response (skip cache for lesson owners to see latest changes)
        cached_response = cache.get(cache_key)
        if cached_response and not self._is_owner(request, cached_response.get('lesson')):
            return Response(cached_response)
        # Optimize query with select_related for ForeignKeys and prefetch_related for Many-to-Many
        # OPTIMIZATION: Use only() to fetch only needed fields for better performance
        lesson = get_object_or_404(
            Lesson.objects.select_related(
                'course',          # Prefetch course data
                'subject',         # Prefetch subject data
                'created_by',      # Prefetch creator data (for username)
                'created_by__profile',  # Prefetch creator profile if needed
                'template_ref'     # Prefetch template data
            ).prefetch_related(
                'tags',            # Prefetch tags
                'quizzes__created_by',  # Prefetch quizzes with their creators
                'quizzes__subject'      # Prefetch quiz subjects for full details
            ).only(
                # Only fetch fields we actually need
                'id', 'title', 'content', 'video_url', 'content_type',
                'permalink', 'created_at', 'status', 'is_premium', 'is_locked',
                'accent_color', 'custom_css', 'custom_js',
                'seo_title', 'seo_description', 'og_title', 'og_description', 'og_image', 'canonical_url',
                'published_at',
                # Foreign key IDs (automatically included with select_related)
                'course_id', 'subject_id', 'created_by_id', 'template_ref_id'
            ),
            permalink=permalink
        )
        # --- DRAFT PRIVACY: only creator (or staff) can see ---
        if lesson.status == Lesson.DRAFT:
            if not request.user.is_authenticated or (
                lesson.created_by != request.user and not request.user.is_staff
            ):
                # Hide existence of drafts from others
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
            # Drafts visible to owner/staff must not be indexed
            # Ensure robots noindex for any draft visibility
            # Note: header applied on response objects below
            
        canonical = canonical_url(f"/lessons/{lesson.permalink}/")
        seo = {
            "title": lesson.seo_title or lesson.title,
            "description": lesson.seo_description,
            "canonical_url": canonical,
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
                resp["X-Robots-Tag"] = "noindex, nofollow"
                return resp

            # For everyone else, show a gated response (200), not 403, to avoid global logout.
            if not request.user.is_authenticated:
                preview_html = (lesson.content or "")
                try:
                    total_len = len(preview_html)
                    cut = max(0, min(total_len, int(total_len * 0.2)))
                    preview_html = preview_html[:cut]
                except Exception:
                    preview_html = (lesson.content or "")[:500]
                resp = Response({
                    "lesson": {
                        "id": lesson.id,
                        "title": lesson.title,
                        "permalink": lesson.permalink,
                        "content": preview_html,
                        "accent_color": lesson.accent_color,
                        "custom_css": lesson.custom_css,
                        "custom_js": "",
                        "seo_title": lesson.seo_title,
                        "seo_description": lesson.seo_description,
                        "canonical_url": canonical,
                    },
                    "seo": seo,
                    "access": "gated",
                    "message": f"Premium lesson\nThis lesson belongs to a premium course: {lesson.course.title if lesson.course else ''}. Log in and enroll to access.",
                    "course": attached_course,
                    "preview": True,
                }, status=status.HTTP_200_OK)
                resp["X-Robots-Tag"] = "noindex, nofollow"
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
                resp["X-Robots-Tag"] = "noindex, nofollow"
                return resp

            course_ct = ContentType.objects.get_for_model(Course)
            enrollment_exists = Enrollment.objects.filter(
                user=request.user,
                object_id=lesson.course.id,
                content_type=course_ct,
                enrollment_type="course"
            ).exists()
            if not enrollment_exists:
                # Provide free preview to authenticated but not enrolled users as well
                preview_html = (lesson.content or "")
                try:
                    total_len = len(preview_html)
                    cut = max(0, min(total_len, int(total_len * 0.2)))
                    preview_html = preview_html[:cut]
                except Exception:
                    preview_html = (lesson.content or "")[:500]
                resp = Response({
                    "lesson": {
                        "id": lesson.id,
                        "title": lesson.title,
                        "permalink": lesson.permalink,
                        "content": preview_html,
                        "accent_color": lesson.accent_color,
                        "custom_css": lesson.custom_css,
                        "custom_js": "",
                        "seo_title": lesson.seo_title,
                        "seo_description": lesson.seo_description,
                        "canonical_url": canonical,
                    },
                    "seo": seo,
                    "access": "gated",
                    "message": f"Premium lesson\nThis lesson belongs to a premium course: {lesson.course.title}. Enroll to access.",
                    "course": attached_course,
                    "preview": True,
                }, status=status.HTTP_200_OK)
                resp["X-Robots-Tag"] = "noindex, nofollow"
                patch_cache_control(resp, no_cache=True, no_store=True, must_revalidate=True, private=True, max_age=0, s_maxage=0)
                resp["Vary"] = "Accept, Cookie, Authorization, Origin"
                return resp

        # OPTIMIZATION: Include enrollment status in the same response to avoid second API call
        is_enrolled = False
        is_completed = False
        
        if request.user.is_authenticated and lesson.course:
            course_ct = ContentType.objects.get_for_model(Course)
            is_enrolled = Enrollment.objects.filter(
                user=request.user,
                content_type=course_ct,
                object_id=lesson.course.id,
                enrollment_type="course"
            ).exists()
            
            is_completed = LessonCompletion.objects.filter(
                user=request.user,
                lesson=lesson
            ).exists()

        serializer = LessonSerializer(lesson, context={"request": request})
        serialized = serializer.data
        serialized["canonical_url"] = canonical

        response_data = {
            "lesson": serialized,
            "seo": seo,
            "is_enrolled": is_enrolled,
            "is_completed": is_completed
        }

        # Inline-gate premium sections inside otherwise visible lessons
        try:
            # Do not mask for owner/staff
            is_owner_or_staff = request.user.is_authenticated and (
                lesson.created_by == request.user or request.user.is_staff
            )
            if not is_owner_or_staff and response_data.get("lesson", {}).get("content"):
                # Enforce course-bound gating when lesson is attached to a course
                filtered = _mask_restricted_sections(
                    response_data["lesson"]["content"],
                    request.user,
                    bound_course=lesson.course if getattr(lesson, 'course', None) else None,
                )
                response_data["lesson"]["content"] = filtered
        except Exception:
            pass

        # Cache the response for 5 minutes (300 seconds)
        if not (request.user.is_authenticated and (lesson.created_by == request.user or request.user.is_staff)):
            cache.set(cache_key, response_data, timeout=300)
        
        resp = Response(response_data)
        # Only block indexing for premium or draft lessons
        if lesson.is_premium or lesson.status == Lesson.DRAFT:
            resp["X-Robots-Tag"] = "noindex, nofollow"
            # Also reflect in seo block for clients rendering meta tags
            try:
                if isinstance(response_data.get("seo"), dict):
                    response_data["seo"]["robots"] = "noindex,nofollow"
            except Exception:
                pass
        else:
            # Ensure published free lessons are indexable
            try:
                if isinstance(response_data.get("seo"), dict):
                    response_data["seo"].pop("robots", None)
            except Exception:
                pass
        # Add conservative cache headers for anonymous/public access
        if not request.user.is_authenticated and lesson.status == Lesson.PUBLISHED and not lesson.is_premium:
            patch_cache_control(resp, public=True, max_age=300, s_maxage=300)
        return resp

    def _is_owner(self, request, lesson_data):
        """Helper to check if user is the lesson owner"""
        if not request.user.is_authenticated or not lesson_data:
            return False
        return lesson_data.get('created_by') == request.user.username


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


class LessonExportPDFView(APIView):
    """
    Export lesson content as PDF (text-first, no media).
    GET /api/lessons/<lesson_id>/export-pdf/
    
    Returns PDF file for download. Caches generated PDFs.
    """
    permission_classes = [IsAuthenticated]
    throttle_scope = 'lesson_export'
    
    def get(self, request, pk):
        from django.http import HttpResponse
        from .pdf_utils import get_or_generate_lesson_pdf
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Get lesson
        lesson = get_object_or_404(Lesson, pk=pk)
        
        # Authorization checks
        # 1. If premium lesson, check enrollment
        if lesson.is_premium:
            # Allow creator and staff
            if lesson.created_by == request.user or request.user.is_staff:
                pass  # Allowed
            # Otherwise check enrollment
            elif lesson.course:
                course_ct = ContentType.objects.get_for_model(Course)
                has_enrollment = Enrollment.objects.filter(
                    user=request.user,
                    content_type=course_ct,
                    object_id=lesson.course.id,
                    enrollment_type="course"
                ).exists()
                
                if not has_enrollment:
                    return Response(
                        {"detail": "Enrollment required to export this lesson."},
                        status=status.HTTP_403_FORBIDDEN
                    )
            else:
                # Premium lesson without course - only creator/staff can access
                return Response(
                    {"detail": "You do not have access to this lesson."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # 2. If draft, only creator and staff can export
        if lesson.status == Lesson.DRAFT:
            if lesson.created_by != request.user and not request.user.is_staff:
                return Response(
                    {"detail": "Not found."},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Generate or retrieve cached PDF
        try:
            pdf_bytes = get_or_generate_lesson_pdf(lesson)
            
            # Return PDF response
            filename = f"lesson-{lesson.id}.pdf"
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response['Content-Length'] = len(pdf_bytes)
            
            return response
            
        except Exception as e:
            logger.error(
                f"PDF generation failed for lesson {lesson.id} "
                f"(user: {request.user.id}): {str(e)}",
                exc_info=True
            )
            return Response(
                {"detail": "PDF generation failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LessonExportAudioView(APIView):
    """
    Export all audio files in a lesson as a ZIP archive.
    GET /api/lessons/<lesson_id>/export-audio/
    """
    permission_classes = [IsAuthenticated]
    throttle_scope = 'lesson_export'

    def get(self, request, pk):
        # Get lesson
        lesson = get_object_or_404(Lesson, pk=pk)

        # Authorization checks (same as PDF)
        if lesson.is_premium:
            # Allow creator and staff
            if lesson.created_by == request.user or request.user.is_staff:
                pass
            # Otherwise check enrollment
            elif lesson.course:
                course_ct = ContentType.objects.get_for_model(Course)
                has_enrollment = Enrollment.objects.filter(
                    user=request.user,
                    content_type=course_ct,
                    object_id=lesson.course.id,
                    enrollment_type="course"
                ).exists()
                
                if not has_enrollment:
                    return Response(
                        {"detail": "Enrollment required to export audio."},
                        status=status.HTTP_403_FORBIDDEN
                    )
            else:
                # Premium lesson without course - only creator/staff can access
                return Response(
                    {"detail": "You do not have access to this lesson."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # If draft, only creator and staff can export
        if lesson.status == Lesson.DRAFT:
            if lesson.created_by != request.user and not request.user.is_staff:
                return Response(
                    {"detail": "Not found."},
                    status=status.HTTP_404_NOT_FOUND
                )

        # Fetch audio files
        # Strategy 1: Explicitly linked media
        audio_files = list(UserMedia.objects.filter(lesson=lesson, media_type='audio'))
        # Will store (filename, bytes) for direct URL-fetched audio
        remote_entries = []

        # Strategy 2/3: Scan content for audio tags
        if lesson.content:
            try:
                soup = BeautifulSoup(lesson.content, "html.parser")
                for audio_tag in soup.find_all("audio"):
                    src = audio_tag.get("src")
                    if not src:
                        continue

                    decoded_src = unquote(src)
                    filename = os.path.basename(decoded_src.split('?')[0])
                    if not filename:
                        continue

                    # Avoid duplicates if already found
                    if any(os.path.basename(af.file.name) == filename for af in audio_files):
                        continue
                    if any(name == filename for name, _ in remote_entries):
                        continue

                    # Strategy 2: Find in DB by filename (handles unlinked media)
                    media_match = UserMedia.objects.filter(
                        file__icontains=filename,
                        media_type='audio'
                    ).first()
                    if media_match:
                        audio_files.append(media_match)
                        continue

                    # Strategy 3: Directly fetch from same-domain MEDIA URLs as a last resort
                    try:
                        # Build absolute URL
                        if decoded_src.startswith('http://') or decoded_src.startswith('https://'):
                            abs_url = decoded_src
                        else:
                            abs_url = request.build_absolute_uri(decoded_src)

                        parsed = urlparse(abs_url)
                        current_host = request.get_host().split(':')[0].lower()
                        allowed_hosts = {
                            current_host, '127.0.0.1', 'localhost',
                            'zportaacademy.com', 'www.zportaacademy.com'
                        }
                        media_url_prefix = (settings.MEDIA_URL or '/media/').rstrip('/')

                        # Only fetch if URL is same-domain and under MEDIA_URL path
                        if parsed.netloc.lower() in allowed_hosts and parsed.path.startswith(media_url_prefix):
                            try:
                                resp = requests.get(abs_url, timeout=10)
                                if resp.status_code == 200 and resp.content:
                                    remote_entries.append((filename, resp.content))
                            except Exception as fetch_err:
                                print(f"Error fetching audio from URL {abs_url}: {fetch_err}")
                    except Exception as e:
                        print(f"Error processing audio src {src}: {e}")
            except Exception as e:
                print(f"Error parsing lesson content for audio: {e}")

        if not audio_files and not remote_entries:
            return Response(
                {"detail": "No audio files found for this lesson."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create ZIP in memory
        buffer = io.BytesIO()
        try:
            with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                used_names = set()

                def unique_name(name: str) -> str:
                    if name not in used_names:
                        used_names.add(name)
                        return name
                    base, ext = os.path.splitext(name)
                    i = 2
                    while True:
                        candidate = f"{base}_{i}{ext}"
                        if candidate not in used_names:
                            used_names.add(candidate)
                            return candidate
                        i += 1

                # Add DB-backed files
                for audio in audio_files:
                    try:
                        file_name = unique_name(os.path.basename(audio.file.name))
                        with audio.file.open('rb') as f:
                            file_content = f.read()
                            zip_file.writestr(file_name, file_content)
                    except Exception as e:
                        print(f"Error adding file {audio.id} to zip: {e}")

                # Add URL-fetched files
                for name, content in remote_entries:
                    try:
                        file_name = unique_name(name)
                        zip_file.writestr(file_name, content)
                    except Exception as e:
                        print(f"Error adding remote file {name} to zip: {e}")
        except Exception as e:
             return Response(
                {"detail": f"Failed to create audio archive: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        buffer.seek(0)
        filename = f"lesson-{lesson.id}-audio.zip"
        response = FileResponse(buffer, as_attachment=True, filename=filename)
        return response