"""
Management command to display AI rankings and difficulty scores.

Usage:
    python manage.py show_rankings
    python manage.py show_rankings --type users
    python manage.py show_rankings --type quizzes
    python manage.py show_rankings --type questions
    python manage.py show_rankings --type courses
    python manage.py show_rankings --type lessons

Shows:
- User ability rankings and scores
- Quiz difficulty rankings
- Question difficulty rankings
- Course difficulty rankings (if available)
- Lesson difficulty rankings (if available)
"""

from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Avg

from intelligence.models import UserAbilityProfile, ContentDifficultyProfile
from users.models import Profile
from quizzes.models import Quiz as QuizzesQuiz, Question as QuizzesQuestion
from courses.models import Course
from lessons.models import Lesson


class Command(BaseCommand):
    help = 'Display AI rankings and difficulty scores'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--type',
            type=str,
            choices=['users', 'quizzes', 'questions', 'courses', 'lessons', 'all'],
            default='all',
            help='Type of rankings to show (default: all)'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=20,
            help='Number of items to show per category (default: 20)'
        )
    
    def handle(self, *args, **options):
        ranking_type = options['type']
        limit = options['limit']
        
        self.stdout.write("=" * 100)
        self.stdout.write(self.style.SUCCESS("🏆 AI RANKINGS & DIFFICULTY SCORES"))
        self.stdout.write("=" * 100)
        
        if ranking_type in ['users', 'all']:
            self.show_user_rankings(limit)
        
        if ranking_type in ['quizzes', 'all']:
            self.show_quiz_rankings(limit)
        
        if ranking_type in ['questions', 'all']:
            self.show_question_rankings(limit)
        
        if ranking_type in ['courses', 'all']:
            self.show_course_rankings(limit)
        
        if ranking_type in ['lessons', 'all']:
            self.show_lesson_rankings(limit)
        
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write(self.style.SUCCESS("✓ Rankings display complete"))
        self.stdout.write("=" * 100 + "\n")
    
    def show_user_rankings(self, limit):
        """Display user ability rankings."""
        self.stdout.write("\n" + "─" * 100)
        self.stdout.write(self.style.HTTP_INFO("👥 USER ABILITY RANKINGS"))
        self.stdout.write("─" * 100)
        
        profiles = UserAbilityProfile.objects.select_related('user').order_by('-overall_ability_score')[:limit]
        
        if not profiles.exists():
            self.stdout.write(self.style.WARNING("  No user rankings computed yet. Run: python manage.py compute_user_abilities"))
            return
        
        self.stdout.write(f"\n{'Rank':>6} {'User':25} {'Ability Score':>15} {'Percentile':>12} {'Quizzes':>10} {'Correct':>10} {'Trend':>10}")
        self.stdout.write("─" * 100)
        
        for profile in profiles:
            username = profile.user.username[:23]
            ability = f"{profile.overall_ability_score:.1f}"
            percentile = f"{profile.percentile:.1f}%" if profile.percentile else "N/A"
            quizzes = profile.total_quizzes_attempted or 0
            correct = profile.total_correct_answers or 0
            trend = f"{profile.recent_performance_trend:+.1f}%" if profile.recent_performance_trend else "0.0%"
            
            # Color code by ability
            if profile.overall_ability_score >= 500:
                rank_color = self.style.SUCCESS
            elif profile.overall_ability_score >= 400:
                rank_color = self.style.HTTP_INFO
            else:
                rank_color = self.style.WARNING
            
            self.stdout.write(rank_color(
                f"{profile.global_rank:>6} {username:25} {ability:>15} {percentile:>12} {quizzes:>10} {correct:>10} {trend:>10}"
            ))
        
        # Summary stats
        total_users = UserAbilityProfile.objects.count()
        avg_score = UserAbilityProfile.objects.aggregate(Avg('overall_ability_score'))['overall_ability_score__avg']
        
        self.stdout.write("─" * 100)
        self.stdout.write(f"  Total Users Ranked: {total_users}")
        self.stdout.write(f"  Average Ability Score: {avg_score:.1f}" if avg_score else "  Average Ability Score: N/A")
    
    def show_quiz_rankings(self, limit):
        """Display quiz difficulty rankings."""
        self.stdout.write("\n" + "─" * 100)
        self.stdout.write(self.style.HTTP_INFO("📝 QUIZ DIFFICULTY RANKINGS"))
        self.stdout.write("─" * 100)
        
        quiz_ct = ContentType.objects.get_for_model(QuizzesQuiz)
        profiles = ContentDifficultyProfile.objects.filter(
            content_type=quiz_ct
        ).select_related('content_type').order_by('-computed_difficulty_score')[:limit]
        
        if not profiles.exists():
            self.stdout.write(self.style.WARNING("  No quiz difficulty computed yet. Run: python manage.py compute_content_difficulty"))
            return
        
        self.stdout.write(f"\n{'ID':>6} {'Quiz Title':50} {'Difficulty':>12} {'Category':>15} {'Attempts':>10} {'Success %':>12}")
        self.stdout.write("─" * 100)
        
        for profile in profiles:
            try:
                quiz = QuizzesQuiz.objects.get(id=profile.object_id)
                title = quiz.title[:48] if len(quiz.title) > 48 else quiz.title
                difficulty = f"{profile.computed_difficulty_score:.1f}"
                
                # Determine difficulty category
                if profile.computed_difficulty_score >= 500:
                    category = "Very Hard"
                    color = self.style.ERROR
                elif profile.computed_difficulty_score >= 450:
                    category = "Hard"
                    color = self.style.WARNING
                elif profile.computed_difficulty_score >= 400:
                    category = "Medium"
                    color = self.style.HTTP_INFO
                elif profile.computed_difficulty_score >= 350:
                    category = "Easy"
                    color = self.style.SUCCESS
                else:
                    category = "Very Easy"
                    color = self.style.SUCCESS
                
                attempts = profile.attempt_count or 0
                success_rate = f"{profile.success_rate:.1f}%" if profile.success_rate else "N/A"
                
                self.stdout.write(color(
                    f"{quiz.id:>6} {title:50} {difficulty:>12} {category:>15} {attempts:>10} {success_rate:>12}"
                ))
            except QuizzesQuiz.DoesNotExist:
                continue
        
        # Summary stats
        total_quizzes = ContentDifficultyProfile.objects.filter(content_type=quiz_ct).count()
        avg_difficulty = ContentDifficultyProfile.objects.filter(content_type=quiz_ct).aggregate(
            Avg('computed_difficulty_score'))['computed_difficulty_score__avg']
        
        self.stdout.write("─" * 100)
        self.stdout.write(f"  Total Quizzes Analyzed: {total_quizzes}")
        self.stdout.write(f"  Average Difficulty: {avg_difficulty:.1f}" if avg_difficulty else "  Average Difficulty: N/A")
    
    def show_question_rankings(self, limit):
        """Display question difficulty rankings."""
        self.stdout.write("\n" + "─" * 100)
        self.stdout.write(self.style.HTTP_INFO("❓ QUESTION DIFFICULTY RANKINGS"))
        self.stdout.write("─" * 100)
        
        question_ct = ContentType.objects.get_for_model(QuizzesQuestion)
        profiles = ContentDifficultyProfile.objects.filter(
            content_type=question_ct
        ).select_related('content_type').order_by('-computed_difficulty_score')[:limit]
        
        if not profiles.exists():
            self.stdout.write(self.style.WARNING("  No question difficulty computed yet. Run: python manage.py compute_content_difficulty"))
            return
        
        self.stdout.write(f"\n{'ID':>6} {'Question Text':60} {'Difficulty':>12} {'Category':>12} {'Attempts':>10}")
        self.stdout.write("─" * 100)
        
        for profile in profiles:
            try:
                question = QuizzesQuestion.objects.get(id=profile.object_id)
                text = str(question.question_text)[:58] if len(str(question.question_text)) > 58 else str(question.question_text)
                difficulty = f"{profile.computed_difficulty_score:.1f}"
                
                # Determine difficulty category
                if profile.computed_difficulty_score >= 500:
                    category = "Very Hard"
                    color = self.style.ERROR
                elif profile.computed_difficulty_score >= 450:
                    category = "Hard"
                    color = self.style.WARNING
                elif profile.computed_difficulty_score >= 400:
                    category = "Medium"
                    color = self.style.HTTP_INFO
                elif profile.computed_difficulty_score >= 350:
                    category = "Easy"
                    color = self.style.SUCCESS
                else:
                    category = "Very Easy"
                    color = self.style.SUCCESS
                
                attempts = profile.attempt_count or 0
                
                self.stdout.write(color(
                    f"{question.id:>6} {text:60} {difficulty:>12} {category:>12} {attempts:>10}"
                ))
            except QuizzesQuestion.DoesNotExist:
                continue
        
        # Summary stats
        total_questions = ContentDifficultyProfile.objects.filter(content_type=question_ct).count()
        avg_difficulty = ContentDifficultyProfile.objects.filter(content_type=question_ct).aggregate(
            Avg('computed_difficulty_score'))['computed_difficulty_score__avg']
        
        self.stdout.write("─" * 100)
        self.stdout.write(f"  Total Questions Analyzed: {total_questions}")
        self.stdout.write(f"  Average Difficulty: {avg_difficulty:.1f}" if avg_difficulty else "  Average Difficulty: N/A")
    
    def show_course_rankings(self, limit):
        """Display course difficulty rankings."""
        self.stdout.write("\n" + "─" * 100)
        self.stdout.write(self.style.HTTP_INFO("📚 COURSE DIFFICULTY RANKINGS"))
        self.stdout.write("─" * 100)
        
        course_ct = ContentType.objects.get_for_model(Course)
        profiles = ContentDifficultyProfile.objects.filter(
            content_type=course_ct
        ).select_related('content_type').order_by('-computed_difficulty_score')[:limit]
        
        if not profiles.exists():
            self.stdout.write(self.style.WARNING("  No course difficulty data available."))
            return
        
        self.stdout.write(f"\n{'ID':>6} {'Course Title':50} {'Difficulty':>12} {'Category':>15} {'Attempts':>10}")
        self.stdout.write("─" * 100)
        
        for profile in profiles:
            try:
                course = Course.objects.get(id=profile.object_id)
                title = course.title[:48] if len(course.title) > 48 else course.title
                difficulty = f"{profile.computed_difficulty_score:.1f}"
                
                if profile.computed_difficulty_score >= 500:
                    category = "Advanced"
                    color = self.style.ERROR
                elif profile.computed_difficulty_score >= 400:
                    category = "Intermediate"
                    color = self.style.HTTP_INFO
                else:
                    category = "Beginner"
                    color = self.style.SUCCESS
                
                attempts = profile.attempt_count or 0
                
                self.stdout.write(color(
                    f"{course.id:>6} {title:50} {difficulty:>12} {category:>15} {attempts:>10}"
                ))
            except Course.DoesNotExist:
                continue
    
    def show_lesson_rankings(self, limit):
        """Display lesson difficulty rankings."""
        self.stdout.write("\n" + "─" * 100)
        self.stdout.write(self.style.HTTP_INFO("📖 LESSON DIFFICULTY RANKINGS"))
        self.stdout.write("─" * 100)
        
        lesson_ct = ContentType.objects.get_for_model(Lesson)
        profiles = ContentDifficultyProfile.objects.filter(
            content_type=lesson_ct
        ).select_related('content_type').order_by('-computed_difficulty_score')[:limit]
        
        if not profiles.exists():
            self.stdout.write(self.style.WARNING("  No lesson difficulty data available."))
            return
        
        self.stdout.write(f"\n{'ID':>6} {'Lesson Title':50} {'Difficulty':>12} {'Category':>15} {'Completions':>12}")
        self.stdout.write("─" * 100)
        
        for profile in profiles:
            try:
                lesson = Lesson.objects.get(id=profile.object_id)
                title = lesson.title[:48] if len(lesson.title) > 48 else lesson.title
                difficulty = f"{profile.computed_difficulty_score:.1f}"
                
                if profile.computed_difficulty_score >= 500:
                    category = "Advanced"
                    color = self.style.ERROR
                elif profile.computed_difficulty_score >= 400:
                    category = "Intermediate"
                    color = self.style.HTTP_INFO
                else:
                    category = "Beginner"
                    color = self.style.SUCCESS
                
                attempts = profile.attempt_count or 0
                
                self.stdout.write(color(
                    f"{lesson.id:>6} {title:50} {difficulty:>12} {category:>15} {attempts:>12}"
                ))
            except Lesson.DoesNotExist:
                continue
