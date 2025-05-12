from quizzes.models import Question, Option, ShortAnswerSolution
from django.db import transaction

@transaction.atomic
def migrate_question_data():
    for q in Question.objects.all():
        # --- Migrate MCQ / Multi to Option model ---
        if q.question_type in ['mcq', 'multi']:
            for i in range(1, 5):
                text = getattr(q, f'option{i}')
                if text:
                    Option.objects.update_or_create(
                        question=q,
                        order=i,
                        defaults={
                            'text': text,
                            'is_correct': (
                                (q.question_type == 'mcq' and q.correct_option == i) or
                                (q.question_type == 'multi' and q.correct_options and i in q.correct_options)
                            )
                        }
                    )

        
        # --- Migrate short answer ---
        if q.question_type == 'short':
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT correct_answer FROM quizzes_question WHERE id = %s", [q.id])
                row = cursor.fetchone()
                if row and row[0]:
                    ShortAnswerSolution.objects.update_or_create(
                        question=q,
                        defaults={
                            'correct_answer_text': row[0],
                            'is_case_sensitive': False,
                        }
                    )


        # Optional: clear old fields
        # q.option1 = q.option2 = q.option3 = q.option4 = None
        # q.correct_option = None
        # q.correct_options = None
        # q.correct_answer = None
        q.save()

    print("✅ Migration completed.")
