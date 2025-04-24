import os
import random
from django.utils import timezone
from django.utils.text import slugify
from django.db import models
from django.contrib.auth.models import User
from lessons.models import Lesson
from courses.models import Course
# For posts, use a string reference to avoid circular imports.
# (Make sure your posts app is installed and named "posts")
 
def user_media_path(instance, filename):
    """
    Determines the file path for a media upload.
    
    - If the media is linked to a Lesson, use the Lesson's title and store it in the "lesson" folder.
    - Else if linked to a Course, use the Course's title (and subject) and store it in the "course" folder.
    - Otherwise, use the media_category value.
    """
    ext = filename.split('.')[-1]  # File extension
    category = instance.media_category if instance.media_category else 'misc'
    
    # Check if media is linked to a Lesson.
    if hasattr(instance, 'lesson') and instance.lesson is not None:
        title_text = instance.lesson.title
        folder = 'lesson'
    # Next, if it's linked to a Course.
    elif instance.course:
        title_text = instance.course.title
        subject_text = instance.course.subject.name if instance.course.subject else 'no-subject'
        title_text = f"{title_text}-{subject_text}"
        folder = 'course'
    # Next, if it's linked to a Post.
    elif hasattr(instance, 'post') and instance.post is not None:
        title_text = instance.post.title
        folder = 'post'
    else:
        title_text = category
        folder = category
    
    # Create a base name using the uploader's username, the slugified title, and the current date.
    date_str = timezone.now().strftime('%Y%m%d')
    base_name = f"{instance.uploaded_by.username}-{slugify(title_text)}-{date_str}"
    rand_num = random.randint(1000, 9999)
    new_filename = f"{base_name}-{rand_num}.{ext}"
    # Files are stored under: user_<username>/<folder>/<new_filename>
    return os.path.join(f"user_{instance.uploaded_by.username}", folder, new_filename)
 
MEDIA_TYPE_CHOICES = (
    ('image', 'Image'),
    ('audio', 'Audio'),
    ('video', 'Video'),
)
 
MEDIA_CATEGORY_CHOICES = (
    ('course', 'Course'),
    ('post', 'Post'),
    ('quiz', 'Quiz'),
    ('lesson', 'Lesson'),
)
 
class UserMedia(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True, related_name='media')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, null=True, blank=True, related_name='media')
    # NEW: Add a ForeignKey to Post. Use a string reference for the Post model.
    post = models.ForeignKey('posts.Post', on_delete=models.CASCADE, null=True, blank=True, related_name='media')
    file = models.FileField(upload_to=user_media_path)
    media_type = models.CharField(max_length=20, choices=MEDIA_TYPE_CHOICES)
    media_category = models.CharField(max_length=20, choices=MEDIA_CATEGORY_CHOICES, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploaded_media', null=True, blank=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.media_category or 'misc'} - {self.media_type} - {self.file.name}"
