"""
Simplified quiz-only bulk import handler
Allows uploading quizzes with questions without requiring courses/lessons
"""
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from quizzes.models import Quiz, Question, japanese_to_romaji
from subjects.models import Subject
from tags.models import Tag
import logging

logger = logging.getLogger(__name__)


class QuizBulkImportHandler:
    """Handle quiz-only bulk import"""
    
    def __init__(self, user, dry_run=False):
        self.user = user
        self.dry_run = dry_run
        self.errors = []
        self.warnings = []
        self.created_quizzes = []
        self.created_questions = []
    
    def process(self, data):
        """Process quiz-only import"""
        quizzes_data = data.get('quizzes', [])
        
        if not quizzes_data:
            raise ValueError('No quizzes found in JSON. Use {"quizzes": [...]} format')
        
        # Process each quiz
        if self.dry_run:
            # Dry run - validate without saving
            for idx, quiz_data in enumerate(quizzes_data):
                try:
                    self._validate_quiz(quiz_data, idx)
                except Exception as e:
                    self.errors.append(f'Quiz {idx}: {str(e)}')
        else:
            # Real run - save to database
            with transaction.atomic():
                for idx, quiz_data in enumerate(quizzes_data):
                    try:
                        self._process_quiz(quiz_data, idx)
                    except Exception as e:
                        self.errors.append(f'Quiz {idx} "{quiz_data.get("title", "Untitled")}": {str(e)}')
                        logger.error(f'Error processing quiz: {str(e)}', exc_info=True)
        
        return {
            'success': len(self.errors) == 0,
            'created_quizzes': len(self.created_quizzes),
            'created_questions': len(self.created_questions),
            'errors': self.errors,
            'warnings': self.warnings,
            'quiz_ids': self.created_quizzes,
            'question_ids': self.created_questions,
        }
    
    def _validate_quiz(self, quiz_data, idx):
        """Validate single quiz data"""
        # Check required fields
        if not quiz_data.get('title'):
            raise ValueError('Quiz title is required')
        
        # Check subject exists if provided
        subject_name = quiz_data.get('subject_name')
        if subject_name:
            try:
                Subject.objects.get(name=subject_name)
            except Subject.DoesNotExist:
                raise ValueError(f'Subject "{subject_name}" does not exist')
        
        # Validate questions
        questions = quiz_data.get('questions', [])
        if not questions:
            self.warnings.append(f'Quiz {idx} "{quiz_data.get("title")}" has no questions')
        
        for q_idx, question_data in enumerate(questions):
            try:
                self._validate_question(question_data, q_idx)
            except Exception as e:
                raise ValueError(f'Question {q_idx}: {str(e)}')
    
    def _validate_question(self, question_data, idx):
        """Validate single question data"""
        if not question_data.get('question_text'):
            raise ValueError('Question text is required')
        
        # Normalize aliases
        qt_raw = (question_data.get('question_type') or 'mcq').lower()
        question_type = 'short' if qt_raw in ['short', 'short_answer'] else qt_raw
        
        # Validate MCQ/Multi questions have options
        if question_type in ['mcq', 'multi']:
            has_options = sum(1 for i in range(1, 5) if question_data.get(f'option{i}'))
            if has_options < 2:
                raise ValueError('MCQ/Multi questions require at least 2 options')
            
            # Check correct_option for MCQ
            if question_type == 'mcq':
                correct_opt = question_data.get('correct_option')
                if not correct_opt or correct_opt not in [1, 2, 3, 4]:
                    raise ValueError('MCQ questions need correct_option (1-4)')
        
        # Validate short answer questions
        if question_type == 'short':
            if not question_data.get('correct_answer'):
                raise ValueError('Short answer questions need correct_answer')

    def _build_unique_permalink(self, title, subject):
        """Build a unique permalink, appending -2, -3 if needed."""
        date_str = timezone.now().strftime('%Y-%m-%d')
        title_slug = slugify(japanese_to_romaji(title or 'untitled'))
        user_slug = slugify(self.user.username) if self.user else 'unknown-user'
        subject_slug = slugify(subject.name) if subject else 'no-subject'
        base = f"{user_slug}/{subject_slug}/{date_str}/{title_slug}"
        permalink = base
        counter = 2
        while Quiz.objects.filter(permalink=permalink).exists():
            permalink = f"{base}-{counter}"
            counter += 1
        return permalink
    
    def _process_quiz(self, quiz_data, idx):
        """Create quiz and questions"""
        # Get or create subject
        subject = None
        subject_name = quiz_data.get('subject_name')
        if subject_name:
            subject, _ = Subject.objects.get_or_create(name=subject_name)
        
        # Auto-generate SEO fields from title/content if not provided
        title = quiz_data.get('title')
        content = quiz_data.get('content', '')
        seo_title = quiz_data.get('seo_title') or title[:60]  # Max 60 chars for SEO
        seo_description = quiz_data.get('seo_description') or content[:160] if content else f"Practice {title}"

        # Ensure unique permalink to avoid IntegrityError
        permalink = self._build_unique_permalink(title, subject)
        
        # Create quiz (explicit permalink to avoid duplicate key)
        quiz = Quiz.objects.create(
            title=title,
            content=content,
            subject=subject,
            created_by=self.user,
            quiz_type=quiz_data.get('quiz_type', 'free'),
            difficulty_level=quiz_data.get('difficulty_level', 'medium'),
            status=quiz_data.get('status', 'published'),
            seo_title=seo_title,
            seo_description=seo_description,
            permalink=permalink,
        )
        
        # Add tags - properly validate and parse
        tag_names = quiz_data.get('tag_names', [])
        clean_tags = self._parse_and_validate_tags(tag_names)
        for tag_name in clean_tags:
            try:
                tag, _ = Tag.objects.get_or_create(name=tag_name)
                quiz.tags.add(tag)
            except Exception as e:
                logger.warning(f'Could not create tag "{tag_name}" for quiz: {e}')
        
        self.created_quizzes.append(quiz.id)
        
        # Process questions
        for question_data in quiz_data.get('questions', []):
            self._process_question(question_data, quiz)
    
    def _parse_and_validate_tags(self, tag_names):
        """
        Parse tag names which may be strings or arrays.
        Handle cases where tag_names might be a JSON string representation.
        """
        import re
        import json
        
        cleaned = []
        for item in tag_names or []:
            if not item:
                continue
            
            # If it's a string that looks like JSON, try to parse it
            if isinstance(item, str) and item.strip().startswith(('[', '{')):
                try:
                    parsed = json.loads(item)
                    if isinstance(parsed, list):
                        cleaned.extend([str(t).strip() for t in parsed if str(t).strip()])
                    elif isinstance(parsed, dict):
                        # If it's a dict, skip it as invalid tag format
                        logger.warning(f'Skipping dict-like tag: {item}')
                    else:
                        cleaned.append(str(parsed).strip())
                except json.JSONDecodeError:
                    # If parsing fails, use as-is and let validation handle it
                    cleaned.append(str(item).strip())
            else:
                # Regular string tag
                cleaned.append(str(item).strip())
        
        # Remove duplicates while preserving order
        seen = set()
        final = []
        for tag in cleaned:
            if tag and tag not in seen:
                seen.add(tag)
                final.append(tag)
        
        return final
    
    def _process_question(self, question_data, quiz):
        """Create question - skip dragdrop questions if they lack fill_blank data"""
        # Normalize type and clean empty option fields
        qt_raw = (question_data.get('question_type') or 'mcq').lower()
        question_type = 'short' if qt_raw in ['short', 'short_answer'] else qt_raw
        
        # Skip dragdrop questions that don't have fill_blank data
        if question_type == 'dragdrop':
            fill_blank_data = question_data.get('fill_blank')
            if not fill_blank_data or not fill_blank_data.get('sentence') or not fill_blank_data.get('words'):
                logger.warning(f'Skipping dragdrop question - missing fill_blank data: {question_data.get("question_text", "")[:50]}')
                return
        
        def clean(v):
            return None if v in ['', ' ', None] else v
        # Normalize hint2 to empty string to avoid NULL constraint issues
        hint2_val = question_data.get('hint2') or ''
        question = Question.objects.create(
            quiz=quiz,
            question_text=question_data.get('question_text'),
            question_type=question_type,
            option1=clean(question_data.get('option1')),
            option2=clean(question_data.get('option2')),
            option3=clean(question_data.get('option3')),
            option4=clean(question_data.get('option4')),
            correct_option=question_data.get('correct_option'),
            correct_answer=question_data.get('correct_answer'),
            hint1=question_data.get('hint1'),
            hint2=hint2_val,
            question_image=question_data.get('question_image_file') or question_data.get('question_image'),
            question_audio=question_data.get('question_audio_file') or question_data.get('question_audio'),
            allow_speech_to_text=question_data.get('allow_speech_to_text', False),
        )
        
        self.created_questions.append(question.id)


# Example JSON format for quiz-only import
QUIZ_ONLY_EXAMPLE = {
    "quizzes": [
        {
            "title": "English Grammar Basics",
            "content": "Test your understanding of basic English grammar",
            "subject_name": "English",
            "quiz_type": "free",
            "difficulty_level": "easy",
            "status": "published",
            "tag_names": ["Grammar", "Beginner", "English"],
            "seo_title": "English Grammar Quiz",
            "seo_description": "Practice basic English grammar with this beginner-friendly quiz",
            "questions": [
                {
                    "question_text": "She ___ to school every day.",
                    "question_type": "mcq",
                    "option1": "go",
                    "option2": "goes",
                    "option3": "going",
                    "option4": "gone",
                    "correct_option": 2,
                    "hint1": "Use present simple tense with third person singular",
                    "difficulty_level": "easy"
                },
                {
                    "question_text": "I ___ studying English for 3 years.",
                    "question_type": "mcq",
                    "option1": "am",
                    "option2": "is",
                    "option3": "have been",
                    "option4": "was",
                    "correct_option": 3,
                    "hint1": "Use present perfect continuous for ongoing actions",
                    "difficulty_level": "medium"
                },
                {
                    "question_text": "What is the past tense of 'go'?",
                    "question_type": "short",
                    "correct_answer": "went",
                    "hint1": "Irregular verb",
                    "difficulty_level": "easy"
                }
            ]
        },
        {
            "title": "TOEIC Vocabulary Test",
            "content": "Essential business vocabulary for TOEIC exam",
            "subject_name": "English",
            "quiz_type": "free",
            "difficulty_level": "medium",
            "tag_names": ["TOEIC", "Vocabulary", "Business English"],
            "questions": [
                {
                    "question_text": "The company will ___ new employees next month.",
                    "question_type": "mcq",
                    "option1": "hire",
                    "option2": "higher",
                    "option3": "hires",
                    "option4": "hiring",
                    "correct_option": 1,
                    "difficulty_level": "medium"
                },
                {
                    "question_text": "Please ___ to the meeting on time.",
                    "question_type": "mcq",
                    "option1": "arrive",
                    "option2": "arrival",
                    "option3": "arriving",
                    "option4": "arrived",
                    "correct_option": 1,
                    "difficulty_level": "easy"
                }
            ]
        }
    ]
}
