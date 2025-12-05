"""
Management command to show detailed AI ranking predictions for each quiz.

Usage:
    python manage.py show_quiz_predictions
    python manage.py show_quiz_predictions --quiz-id 4
    python manage.py show_quiz_predictions --limit 50

Shows for each quiz:
- Difficulty score
- 5-level categorization (Beginner, Beginner-Medium, Medium, Medium-Hard, Hard/Expert)
- Success rate
- Number of attempts
- User performance breakdown
- Ranking explanation
"""

from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from django.db.models import Avg, Count
from quizzes.models import Quiz
from intelligence.models import ContentDifficultyProfile
from analytics.models import ActivityEvent


class Command(BaseCommand):
    help = 'Show detailed AI ranking predictions for each quiz'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--quiz-id',
            type=int,
            help='Show prediction for specific quiz ID only'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=30,
            help='Number of quizzes to show (default: 30)'
        )
    
    def handle(self, *args, **options):
        quiz_id = options.get('quiz_id')
        limit = options['limit']
        
        self.stdout.write("=" * 120)
        self.stdout.write(self.style.SUCCESS("🤖 AI QUIZ DIFFICULTY PREDICTIONS WITH BREAKDOWN"))
        self.stdout.write("=" * 120)
        
        quiz_ct = ContentType.objects.get_for_model(Quiz)
        
        if quiz_id:
            quizzes = Quiz.objects.filter(id=quiz_id)
        else:
            quizzes = Quiz.objects.all().order_by('id')[:limit]
        
        for quiz in quizzes:
            self.show_quiz_prediction(quiz, quiz_ct)
    
    def show_quiz_prediction(self, quiz, quiz_ct):
        """Display detailed AI prediction for a single quiz."""
        
        # Get difficulty profile
        try:
            diff_profile = ContentDifficultyProfile.objects.get(
                content_type=quiz_ct,
                object_id=quiz.id
            )
            difficulty_score = diff_profile.computed_difficulty_score
            success_rate = diff_profile.success_rate
            attempt_count = diff_profile.attempt_count
        except ContentDifficultyProfile.DoesNotExist:
            difficulty_score = 400.0
            success_rate = 50.0
            attempt_count = 0
        
        # Determine 5-level category
        if difficulty_score < 320:
            level = "Beginner"
            emoji = "🟢"
            color = self.style.SUCCESS
        elif difficulty_score < 420:
            level = "Beginner ➜ Medium"
            emoji = "🟡"
            color = self.style.HTTP_INFO
        elif difficulty_score < 520:
            level = "Medium"
            emoji = "🟠"
            color = self.style.WARNING
        elif difficulty_score < 620:
            level = "Medium ➜ Hard"
            emoji = "🔶"
            color = self.style.WARNING
        else:
            level = "Hard/Expert"
            emoji = "🔴"
            color = self.style.ERROR
        
        # Get quiz questions for breakdown
        questions = quiz.questions.all()
        question_count = questions.count()
        
        # Calculate average question difficulty
        avg_q_difficulty = 0
        if question_count > 0:
            question_difficulties = []
            for q in questions:
                try:
                    q_profile = ContentDifficultyProfile.objects.get(
                        content_type=ContentType.objects.get_for_model(q.__class__),
                        object_id=q.id
                    )
                    question_difficulties.append(q_profile.computed_difficulty_score)
                except:
                    pass
            if question_difficulties:
                avg_q_difficulty = sum(question_difficulties) / len(question_difficulties)
        
        # Get user performance
        events = ActivityEvent.objects.filter(
            event_type='quiz_answer_submitted',
            content_type=ContentType.objects.get_for_model(Quiz),
            object_id=quiz.id
        )
        
        unique_users = events.values('user').distinct().count() if events.exists() else 0
        correct_events = events.filter(metadata__is_correct=True).count() if events.exists() else 0
        
        # Display header
        self.stdout.write("\n" + "─" * 120)
        self.stdout.write(color(
            f"{emoji} QUIZ #{quiz.id}: {quiz.title[:80]}"
        ))
        self.stdout.write("─" * 120)
        
        # Display main metrics
        self.stdout.write(f"\n  📊 DIFFICULTY METRICS:")
        self.stdout.write(f"     Difficulty Score:     {difficulty_score:.1f}/1000")
        self.stdout.write(color(f"     Level:                 {level}"))
        self.stdout.write(f"     Success Rate:         {success_rate:.1f}%")
        self.stdout.write(f"     Total Attempts:       {attempt_count}")
        self.stdout.write(f"     Unique Users:         {unique_users}")
        
        # Display breakdown
        self.stdout.write(f"\n  📚 QUIZ COMPOSITION:")
        self.stdout.write(f"     Total Questions:      {question_count}")
        self.stdout.write(f"     Avg Question Diff:    {avg_q_difficulty:.1f}")
        
        # Display explanation
        self.stdout.write(f"\n  🔍 HOW AI RANKED THIS QUIZ:")
        self.display_ranking_explanation(difficulty_score, success_rate, attempt_count, question_count)
        
        # Display user performance breakdown
        if attempt_count > 0:
            self.stdout.write(f"\n  👥 USER PERFORMANCE:")
            self.display_user_breakdown(events, quiz, difficulty_score)
        
        # Display difficulty factors
        self.stdout.write(f"\n  ⚙️ AI FACTORS CONSIDERED:")
        self.display_ai_factors(difficulty_score, success_rate, attempt_count, avg_q_difficulty)
    
    def display_ranking_explanation(self, score, success_rate, attempts, q_count):
        """Explain how the quiz was ranked."""
        
        factors = []
        
        # Success rate analysis
        if success_rate < 30:
            factors.append("✓ Very low success rate (< 30%) → Increases difficulty")
        elif success_rate < 50:
            factors.append("✓ Low success rate (30-50%) → Increases difficulty")
        elif success_rate < 70:
            factors.append("✓ Moderate success rate (50-70%) → Balanced difficulty")
        else:
            factors.append("✓ High success rate (> 70%) → Decreases difficulty")
        
        # Attempt count analysis
        if attempts < 10:
            factors.append("✓ Few attempts (< 10) → Less confidence in ranking")
        elif attempts < 30:
            factors.append("✓ Moderate attempts (10-30) → Fair confidence")
        else:
            factors.append("✓ Many attempts (> 30) → High confidence in ranking")
        
        # Question count analysis
        if q_count < 3:
            factors.append("✓ Few questions (< 3) → May affect accuracy")
        elif q_count < 10:
            factors.append("✓ Normal question count (3-10) → Good for ranking")
        else:
            factors.append("✓ Many questions (> 10) → More reliable ranking")
        
        for factor in factors:
            self.stdout.write(f"     {factor}")
    
    def display_user_breakdown(self, events, quiz, difficulty_score):
        """Show user performance breakdown by difficulty level."""
        
        # Categorize users by ability
        users_data = {}
        for event in events:
            user = event.user
            if user.id not in users_data:
                users_data[user.id] = {
                    'username': user.username,
                    'attempts': 0,
                    'correct': 0
                }
            users_data[user.id]['attempts'] += 1
            if event.metadata and event.metadata.get('is_correct'):
                users_data[user.id]['correct'] += 1
        
        # Sort by performance
        user_list = sorted(users_data.values(), key=lambda x: (x['correct'] / x['attempts']) if x['attempts'] > 0 else 0, reverse=True)
        
        self.stdout.write(f"     Top Performers:")
        for user_data in user_list[:3]:
            success = (user_data['correct'] / user_data['attempts'] * 100) if user_data['attempts'] > 0 else 0
            self.stdout.write(f"       • {user_data['username']:20} - {success:5.1f}% ({user_data['correct']}/{user_data['attempts']} correct)")
        
        if len(user_list) > 3:
            self.stdout.write(f"     ... and {len(user_list) - 3} more users")
    
    def display_ai_factors(self, score, success_rate, attempts, avg_q_diff):
        """Explain the AI factors used in ranking."""
        
        # Factor 1: Question difficulty
        q_factor = (avg_q_diff / 1000) * 100
        self.stdout.write(f"     1. Question Difficulty Component:  {q_factor:.1f}%")
        self.stdout.write(f"        → Average question difficulty influences quiz difficulty")
        
        # Factor 2: Success rate (inverse)
        sr_factor = ((100 - success_rate) / 100) * 50
        self.stdout.write(f"     2. Success Rate Component:         {sr_factor:.1f}%")
        self.stdout.write(f"        → Lower success = Harder quiz ({success_rate:.1f}% success rate)")
        
        # Factor 3: Attempt volume
        if attempts > 30:
            confidence = "High ✓"
        elif attempts > 10:
            confidence = "Medium ~"
        else:
            confidence = "Low ✗"
        self.stdout.write(f"     3. Attempt Volume (Confidence):    {confidence}")
        self.stdout.write(f"        → {attempts} attempts helps validate the ranking")
        
        # Final score breakdown
        self.stdout.write(f"\n     📈 FINAL SCORE CALCULATION:")
        self.stdout.write(f"        Base Score:                    {score:.1f}")
        self.stdout.write(f"        Confidence Multiplier:         {'High' if attempts > 30 else 'Medium' if attempts > 10 else 'Low'}")
        
        # Prediction confidence
        if attempts >= 30:
            confidence_pct = 95
        elif attempts >= 10:
            confidence_pct = 75
        else:
            confidence_pct = 50
        
        self.stdout.write(f"        Prediction Confidence:         {confidence_pct}%")
