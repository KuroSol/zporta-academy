from django.db import transaction
from django.utils import timezone
from courses.models import Course
from lessons.models import Lesson
from quizzes.models import Quiz, Question
from subjects.models import Subject
from tags.models import Tag
import logging

logger = logging.getLogger(__name__)


class BulkImportHandler:
    """Handle the actual import logic"""
    
    def __init__(self, user, job, dry_run=False):
        self.user = user
        self.job = job
        self.dry_run = dry_run
        self.errors = []
        self.warnings = []
    
    def process(self, data):
        """Process the entire import"""
        courses_data = data.get('courses', [])
        
        # Count totals
        self.job.total_courses = len(courses_data)
        for course_data in courses_data:
            self.job.total_lessons += len(course_data.get('lessons', []))
            for lesson_data in course_data.get('lessons', []):
                self.job.total_quizzes += len(lesson_data.get('quizzes', []))
                for quiz_data in lesson_data.get('quizzes', []):
                    self.job.total_questions += len(quiz_data.get('questions', []))
        
        self.job.save()
        
        # Process each course
        if self.dry_run:
            # Dry run - validate without saving
            self._validate_courses(courses_data)
        else:
            # Real run - save to database
            with transaction.atomic():
                for course_data in courses_data:
                    self._process_course(course_data)
        
        # Update job status
        self.job.status = 'completed'
        self.job.completed_at = timezone.now()
        self.job.errors = self.errors
        self.job.warnings = self.warnings
        self.job.summary = self._generate_summary()
        self.job.save()
    
    def _validate_courses(self, courses_data):
        """Validate courses without saving"""
        for idx, course_data in enumerate(courses_data):
            try:
                self._validate_course(course_data, idx)
            except Exception as e:
                self.errors.append(f'Course {idx}: {str(e)}')
    
    def _validate_course(self, course_data, idx):
        """Validate single course data"""
        # Check required fields
        if not course_data.get('title'):
            raise ValueError('Course title is required')
        if not course_data.get('description'):
            raise ValueError('Course description is required')
        if not course_data.get('subject_name'):
            raise ValueError('Subject name is required')
        
        # Check subject exists
        try:
            Subject.objects.get(name=course_data['subject_name'])
        except Subject.DoesNotExist:
            raise ValueError(f'Subject "{course_data["subject_name"]}" does not exist')
        
        # Validate lessons
        for lesson_idx, lesson_data in enumerate(course_data.get('lessons', [])):
            try:
                self._validate_lesson(lesson_data, course_data['title'], lesson_idx)
            except Exception as e:
                raise ValueError(f'Lesson {lesson_idx}: {str(e)}')
    
    def _validate_lesson(self, lesson_data, course_title, idx):
        """Validate single lesson data"""
        if not lesson_data.get('title'):
            raise ValueError('Lesson title is required')
        if not lesson_data.get('content'):
            raise ValueError('Lesson content is required')
        
        # Validate quizzes
        for quiz_idx, quiz_data in enumerate(lesson_data.get('quizzes', [])):
            try:
                self._validate_quiz(quiz_data, lesson_data['title'], quiz_idx)
            except Exception as e:
                raise ValueError(f'Quiz {quiz_idx}: {str(e)}')
    
    def _validate_quiz(self, quiz_data, lesson_title, idx):
        """Validate single quiz data"""
        if not quiz_data.get('title'):
            raise ValueError('Quiz title is required')
        
        # Validate questions
        for q_idx, question_data in enumerate(quiz_data.get('questions', [])):
            try:
                self._validate_question(question_data, quiz_data['title'], q_idx)
            except Exception as e:
                raise ValueError(f'Question {q_idx}: {str(e)}')
    
    def _validate_question(self, question_data, quiz_title, idx):
        """Validate single question data"""
        if not question_data.get('question_text'):
            raise ValueError('Question text is required')
        
        question_type = question_data.get('question_type', 'mcq')
        
        if question_type in ['mcq', 'multi']:
            required_options = 2
            has_options = sum(1 for i in range(1, 5) if question_data.get(f'option{i}'))
            if has_options < required_options:
                raise ValueError(f'MCQ requires at least {required_options} options')
        
        if question_type == 'short':
            if not question_data.get('correct_answer'):
                raise ValueError('Short answer questions need a correct_answer')
    
    def _process_course(self, course_data):
        """Create course and related lessons/quizzes"""
        try:
            # Get or create subject
            subject_name = course_data.get('subject_name')
            subject, _ = Subject.objects.get_or_create(name=subject_name)
            
            # Create course
            course = Course.objects.create(
                title=course_data.get('title'),
                description=course_data.get('description'),
                subject=subject,
                created_by=self.user,
                course_type=course_data.get('course_type', 'free'),
                price=course_data.get('price', 0),
                is_premium=course_data.get('is_premium', False),
                seo_title=course_data.get('seo_title'),
                seo_description=course_data.get('seo_description'),
                focus_keyword=course_data.get('focus_keyword'),
                og_title=course_data.get('og_title'),
                og_description=course_data.get('og_description'),
                selling_points=course_data.get('selling_points', []),
            )
            
            # Add tags
            tag_names = course_data.get('tag_names', [])
            for tag_name in tag_names:
                tag, _ = Tag.objects.get_or_create(name=tag_name)
                course.tags.add(tag)
            
            self.job.processed_courses += 1
            self.job.save()
            
            # Process lessons
            for lesson_idx, lesson_data in enumerate(course_data.get('lessons', [])):
                self._process_lesson(lesson_data, course, lesson_idx)
        
        except Exception as e:
            self.errors.append(f'Course "{course_data.get("title")}": {str(e)}')
            logger.error(f'Error processing course: {str(e)}', exc_info=True)
    
    def _process_lesson(self, lesson_data, course, position):
        """Create lesson and related quizzes"""
        try:
            lesson = Lesson.objects.create(
                title=lesson_data.get('title'),
                content=lesson_data.get('content'),
                course=course,
                created_by=self.user,
                position=lesson_data.get('position', position),
                is_premium=lesson_data.get('is_premium', False),
                content_type=lesson_data.get('content_type', 'text'),
                video_url=lesson_data.get('video_url', ''),
                template=lesson_data.get('template', 'modern'),
                accent_color=lesson_data.get('accent_color', '#3498db'),
                seo_title=lesson_data.get('seo_title'),
                seo_description=lesson_data.get('seo_description'),
            )
            
            # Add tags
            tag_names = lesson_data.get('tag_names', [])
            for tag_name in tag_names:
                tag, _ = Tag.objects.get_or_create(name=tag_name)
                lesson.tags.add(tag)
            
            self.job.processed_lessons += 1
            self.job.save()
            
            # Process quizzes
            for quiz_data in lesson_data.get('quizzes', []):
                self._process_quiz(quiz_data, lesson, course)
        
        except Exception as e:
            self.errors.append(f'Lesson "{lesson_data.get("title")}": {str(e)}')
            logger.error(f'Error processing lesson: {str(e)}', exc_info=True)
    
    def _process_quiz(self, quiz_data, lesson, course):
        """Create quiz and related questions"""
        try:
            # Get subject from course
            subject = course.subject
            
            quiz = Quiz.objects.create(
                title=quiz_data.get('title'),
                content=quiz_data.get('content', ''),
                lesson=lesson,
                course=course,
                subject=subject,
                created_by=self.user,
                quiz_type=quiz_data.get('quiz_type', 'free'),
                difficulty_level=quiz_data.get('difficulty_level', 'medium'),
                seo_title=quiz_data.get('seo_title'),
                seo_description=quiz_data.get('seo_description'),
            )
            
            # Add tags
            tag_names = quiz_data.get('tag_names', [])
            for tag_name in tag_names:
                tag, _ = Tag.objects.get_or_create(name=tag_name)
                quiz.tags.add(tag)
            
            self.job.processed_quizzes += 1
            self.job.save()
            
            # Process questions
            for question_data in quiz_data.get('questions', []):
                self._process_question(question_data, quiz)
        
        except Exception as e:
            self.errors.append(f'Quiz "{quiz_data.get("title")}": {str(e)}')
            logger.error(f'Error processing quiz: {str(e)}', exc_info=True)
    
    def _process_question(self, question_data, quiz):
        """Create question"""
        try:
            question = Question.objects.create(
                quiz=quiz,
                question_text=question_data.get('question_text'),
                question_type=question_data.get('question_type', 'mcq'),
                option1=question_data.get('option1'),
                option2=question_data.get('option2'),
                option3=question_data.get('option3'),
                option4=question_data.get('option4'),
                correct_answer=question_data.get('correct_answer'),
                correct_options=question_data.get('correct_options'),
                question_data=question_data.get('question_data'),
                hint1=question_data.get('hint1'),
                hint2=question_data.get('hint2'),
            )
            
            self.job.processed_questions += 1
            self.job.save()
        
        except Exception as e:
            self.errors.append(f'Question in "{quiz.title}": {str(e)}')
            logger.error(f'Error processing question: {str(e)}', exc_info=True)
    
    def _generate_summary(self):
        """Generate human-readable summary"""
        return (
            f'Processed: {self.job.processed_courses}/{self.job.total_courses} courses, '
            f'{self.job.processed_lessons}/{self.job.total_lessons} lessons, '
            f'{self.job.processed_quizzes}/{self.job.total_quizzes} quizzes, '
            f'{self.job.processed_questions}/{self.job.total_questions} questions. '
            f'Errors: {len(self.errors)}, Warnings: {len(self.warnings)}'
        )
