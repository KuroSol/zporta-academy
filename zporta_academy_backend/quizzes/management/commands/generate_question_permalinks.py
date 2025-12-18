# quizzes/management/commands/generate_question_permalinks.py
"""
Management command to generate permalinks for questions.
Safe to run multiple times - only processes questions without permalinks.

Usage:
    python manage.py generate_question_permalinks
    python manage.py generate_question_permalinks --force  # Regenerate all
    python manage.py generate_question_permalinks --quiz-id=123  # Specific quiz
"""

from django.core.management.base import BaseCommand
from django.utils.text import slugify
from bs4 import BeautifulSoup
from quizzes.models import Question, Quiz


def japanese_to_romaji(text):
    """Romanize Japanese/non-Latin text for URL-safe slugs"""
    try:
        from pykakasi import kakasi
        from unidecode import unidecode
        
        kks = kakasi()
        kks.setMode("H", "a")
        kks.setMode("K", "a")
        kks.setMode("J", "a")
        kks.setMode("r", "Hepburn")
        romaji = kks.getConverter().do(text)
        fallback = unidecode(text)
        return romaji if len(romaji) >= len(fallback) else fallback
    except ImportError:
        from unidecode import unidecode
        return unidecode(text)


class Command(BaseCommand):
    help = 'Generate SEO-friendly permalinks for questions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerate permalinks for ALL questions (even those with existing permalinks)',
        )
        parser.add_argument(
            '--quiz-id',
            type=int,
            help='Only process questions from a specific quiz',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without actually updating the database',
        )

    def handle(self, *args, **options):
        force = options['force']
        quiz_id = options.get('quiz_id')
        dry_run = options['dry_run']

        self.stdout.write(self.style.WARNING('\n' + '='*70))
        self.stdout.write(self.style.WARNING('🔗 QUESTION PERMALINK GENERATOR'))
        self.stdout.write(self.style.WARNING('='*70 + '\n'))

        # Build query
        queryset = Question.objects.all().select_related('quiz')
        
        if quiz_id:
            queryset = queryset.filter(quiz_id=quiz_id)
            quiz = Quiz.objects.filter(id=quiz_id).first()
            if not quiz:
                self.stdout.write(self.style.ERROR(f'❌ Quiz with ID {quiz_id} not found'))
                return
            self.stdout.write(self.style.SUCCESS(f'📌 Processing quiz: {quiz.title}\n'))
        
        if not force:
            queryset = queryset.filter(permalink__isnull=True)
        
        total = queryset.count()
        
        if total == 0:
            self.stdout.write(self.style.SUCCESS('✅ All questions already have permalinks!'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING(f'🔍 DRY RUN MODE - No changes will be made\n'))
        
        self.stdout.write(f'Found {total} question(s) to process...\n')

        processed = 0
        errors = 0
        skipped = 0

        for question in queryset:
            try:
                # Get question number in quiz
                question_count = Question.objects.filter(
                    quiz_id=question.quiz_id,
                    id__lt=question.id
                ).count() + 1
                
                # Extract clean text
                clean_text = BeautifulSoup(question.question_text or "", "html.parser").get_text().strip()
                
                # Generate multilingual slug
                question_slug = slugify(japanese_to_romaji(clean_text))[:60]
                
                if not question_slug:
                    question_slug = f"question-{question_count}"
                
                # Build permalink
                quiz_permalink = question.quiz.permalink if question.quiz.permalink else f"quiz-{question.quiz_id}"
                permalink = f"{quiz_permalink}/q-{question_count}-{question_slug}"
                
                # Handle duplicates
                base_permalink = permalink
                counter = 1
                while Question.objects.filter(permalink=permalink).exclude(id=question.id).exists():
                    permalink = f"{base_permalink}-{counter}"
                    counter += 1
                
                # Show what we're doing
                old_permalink = question.permalink or '(none)'
                action = 'UPDATE' if question.permalink else 'CREATE'
                
                if dry_run:
                    self.stdout.write(f'   [{action}] Q#{question.id}: {old_permalink} → {permalink}')
                else:
                    # Save the permalink
                    question.permalink = permalink
                    question.save(update_fields=['permalink'])
                    
                    self.stdout.write(
                        self.style.SUCCESS(f'   ✓ Q#{question.id}: {permalink}')
                    )
                
                processed += 1
                
                # Progress indicator
                if processed % 50 == 0:
                    self.stdout.write(self.style.WARNING(f'\n   📊 Progress: {processed}/{total}\n'))
                
            except Exception as e:
                errors += 1
                self.stdout.write(
                    self.style.ERROR(f'   ✗ Error processing Q#{question.id}: {str(e)}')
                )
                continue

        # Summary
        self.stdout.write(self.style.WARNING('\n' + '='*70))
        if dry_run:
            self.stdout.write(self.style.SUCCESS(f'🔍 DRY RUN COMPLETE'))
            self.stdout.write(f'   Would process: {processed} questions')
        else:
            self.stdout.write(self.style.SUCCESS(f'✅ COMPLETE!'))
            self.stdout.write(f'   Processed: {processed}')
        
        if errors > 0:
            self.stdout.write(self.style.ERROR(f'   Errors: {errors}'))
        if skipped > 0:
            self.stdout.write(f'   Skipped: {skipped}')
        
        self.stdout.write(self.style.WARNING('='*70 + '\n'))
