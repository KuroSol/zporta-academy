from django.conf import settings
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils import timezone


class ActivityType:
    CORRECT_ANSWER = "correct_answer"
    LESSON_COMPLETED = "lesson_completed"
    STANDALONE_LESSON = "standalone_lesson"
    COURSE_COMPLETED = "course_completed"
    ENROLLMENT_PREMIUM = "enrollment_premium"
    ENROLLMENT_FREE = "enrollment_free"
    COURSE_ENROLLED = "course_enrolled"  # student side
    QUIZ_FIRST_ATTEMPT = "quiz_first_attempt"

    CHOICES = [
        (CORRECT_ANSWER, "Correct Answer"),
        (LESSON_COMPLETED, "Lesson Completed"),
        (STANDALONE_LESSON, "Standalone Lesson"),
        (COURSE_COMPLETED, "Course Completed"),
        (ENROLLMENT_PREMIUM, "Premium Enrollment"),
        (ENROLLMENT_FREE, "Free Enrollment"),
        (COURSE_ENROLLED, "Course Enrolled"),
        (QUIZ_FIRST_ATTEMPT, "Quiz First Attempt"),
    ]

    POINTS = {
        CORRECT_ANSWER: 1,
        LESSON_COMPLETED: 5,
        STANDALONE_LESSON: 3,
        COURSE_COMPLETED: 25,
        ENROLLMENT_PREMIUM: 8,
        ENROLLMENT_FREE: 4,
        COURSE_ENROLLED: 2,
        QUIZ_FIRST_ATTEMPT: 4,
    }


class Activity(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activities")
    activity_type = models.CharField(max_length=64, choices=ActivityType.CHOICES)
    points = models.IntegerField(default=0)

    # Generic relation to source object
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")

    unique_key = models.CharField(max_length=255, unique=True)
    is_mistake = models.BooleanField(default=False)

    metadata = models.JSONField(default=dict, blank=True)
    time_spent_seconds = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "activity_type"]),
            models.Index(fields=["created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} {self.activity_type} {self.points}pts"

    @staticmethod
    def get_points_for_activity(activity_type: str) -> int:
        return ActivityType.POINTS.get(activity_type, 0)


class UserScore(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="score")
    total_points = models.IntegerField(default=0)
    last_calculated = models.DateTimeField(null=True, blank=True)

    # Optional breakdown caches
    lessons_completed = models.IntegerField(default=0)
    courses_completed = models.IntegerField(default=0)
    correct_answers = models.IntegerField(default=0)

    def __str__(self):
        return f"Score({self.user}: {self.total_points})"

    def recalculate(self):
        qs = Activity.objects.filter(user=self.user)
        self.total_points = qs.aggregate(models.Sum("points"))["points__sum"] or 0
        self.lessons_completed = qs.filter(activity_type=ActivityType.LESSON_COMPLETED).count()
        self.courses_completed = qs.filter(activity_type=ActivityType.COURSE_COMPLETED).count()
        self.correct_answers = qs.filter(activity_type=ActivityType.CORRECT_ANSWER).count()
        self.last_calculated = timezone.now()
        self.save(update_fields=[
            "total_points", "lessons_completed", "courses_completed", "correct_answers", "last_calculated"
        ])
