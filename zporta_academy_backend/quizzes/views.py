# quizzes/views.py

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.contrib.contenttypes.models import ContentType
# Ensure Subject and Course are imported if used elsewhere in this file or serializers
# from subjects.models import Subject
# from courses.models import Course
from .models import Quiz, Question # Import Question model
from .serializers import QuizSerializer
from analytics.utils import log_event # Assuming log_event is correctly imported

class QuizSubmitView(APIView):
    """
    Handles the submission of the entire quiz results at the end.
    (Note: This view might need adjustments based on how 'short', 'sort', 'dragdrop' answers are evaluated)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        answers = request.data.get("answers", []) # Expects a list of answer objects

        if not isinstance(answers, list):
             return Response({"error": "Answers must be provided in a list."}, status=status.HTTP_400_BAD_REQUEST)

        total_questions_in_quiz = quiz.questions.count() # Count questions in the actual quiz
        submitted_question_ids = set(ans.get("question_id") for ans in answers if ans.get("question_id"))

        # Optional: Check if all questions were answered
        # if len(submitted_question_ids) != total_questions_in_quiz:
        #     # Handle partially submitted quizzes if necessary
        #     pass

        correct_answers_count = 0
        question_results_details = []

        # Fetch all relevant questions at once for efficiency
        questions_in_quiz = {q.id: q for q in Question.objects.filter(quiz=quiz, id__in=submitted_question_ids)}

        for answer_data in answers:
            question_id = answer_data.get("question_id")
            selected_option_raw = answer_data.get("selected_option")

            if not question_id or selected_option_raw is None:
                # Log or handle skipped/malformed answer data
                question_results_details.append({
                    "question_id": question_id or "unknown",
                    "selected_option": selected_option_raw,
                    "answered_correctly": False,
                    "error": "Missing question ID or answer."
                })
                continue

            question = questions_in_quiz.get(question_id)
            if not question:
                 question_results_details.append({
                    "question_id": question_id,
                    "selected_option": selected_option_raw,
                    "answered_correctly": False,
                    "error": "Question not found in this quiz."
                })
                 continue # Skip if question doesn't belong to this quiz

            # --- Determine correctness based on question type ---
            is_correct = False
            q_type = question.question_type
            processed_selected_option = selected_option_raw
            correct_answer_value = None

            try:
                if q_type == 'mcq':
                    processed_selected_option = int(selected_option_raw)
                    correct_answer_value = question.correct_option
                    is_correct = (processed_selected_option == correct_answer_value)
                elif q_type == 'multi':
                    if not isinstance(selected_option_raw, list): raise TypeError("Answer must be a list.")
                    processed_selected_option = sorted([int(opt) for opt in selected_option_raw]) # Sort for consistent comparison
                    correct_set = set(question.correct_options or [])
                    correct_answer_value = sorted(list(correct_set))
                    is_correct = (processed_selected_option == correct_answer_value) # Compare sorted lists
                elif q_type == 'short':
                    if not isinstance(selected_option_raw, str): raise TypeError("Answer must be a string.")
                    processed_selected_option = selected_option_raw.strip()
                    correct_answer_value = question.correct_answer
                    is_correct = (processed_selected_option.lower() == (correct_answer_value or '').lower())
                elif q_type == 'sort':
                    if not isinstance(selected_option_raw, list): raise TypeError("Answer must be a list.")
                    processed_selected_option = selected_option_raw # Assume list of strings
                    correct_answer_value = question.correct_options # Assumes this stores the correct list
                    is_correct = (processed_selected_option == correct_answer_value)
                elif q_type == 'dragdrop':
                     # Implement comparison based on your structure in question.correct_options
                     processed_selected_option = selected_option_raw
                     correct_answer_value = question.correct_options
                     # Example: is_correct = compare_drag_drop(processed_selected_option, correct_answer_value)
                     is_correct = False # Placeholder
                else:
                     # Handle unknown type if necessary
                     pass

            except (ValueError, TypeError, KeyError) as e:
                 # Handle errors during processing/comparison if needed
                 question_results_details.append({
                    "question_id": question.id,
                    "selected_option": selected_option_raw,
                    "answered_correctly": False,
                    "error": f"Error processing answer: {e}"
                 })
                 continue # Skip to next answer on error

            if is_correct:
                correct_answers_count += 1

            question_results_details.append({
                "question_id": question.id,
                "question_type": q_type,
                "submitted_answer": processed_selected_option,
                # "correct_answer": correct_answer_value, # Optionally include correct answer
                "answered_correctly": is_correct
            })

        # --- Final Score and Logging ---
        score = correct_answers_count # Simple score based on count

        metadata = {
            "score": score,
            "total_questions_submitted": len(submitted_question_ids),
            "total_questions_in_quiz": total_questions_in_quiz,
            "correct_answers_count": correct_answers_count,
            "questions_details": question_results_details # Log detailed results
        }

        log_event(user=request.user, event_type='quiz_submitted', instance=quiz, metadata=metadata)

        return Response({
            "quiz_id": quiz.pk,
            "score": score,
            "total_questions": total_questions_in_quiz, # Report total in quiz
            "correct_answers": correct_answers_count,
            "wrong_answers": len(submitted_question_ids) - correct_answers_count, # Based on submitted
            "question_details": question_results_details # Send details back
        }, status=status.HTTP_200_OK)


class QuizListCreateView(generics.ListCreateAPIView):
    """
    GET: List all quizzes (public)
    POST: Create a new quiz (requires authentication)
    """
    serializer_class = QuizSerializer
    queryset = Quiz.objects.select_related('created_by', 'subject', 'course').prefetch_related('questions').all() # Optimization

    def get_queryset(self):
        # Start with the base optimized queryset
        queryset = super().get_queryset()
        username = self.request.query_params.get('created_by')
        if username:
            queryset = queryset.filter(created_by__username=username)
        # Add other filters if needed (e.g., by subject, course)
        # subject_id = self.request.query_params.get('subject_id')
        # if subject_id:
        #    queryset = queryset.filter(subject_id=subject_id)
        return queryset

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        # created_by is set automatically in the serializer's create method using context
        serializer.save() # No need to pass created_by here if handled in serializer


class QuizRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or delete a quiz by its primary key (pk).
    Only the quiz creator may update or delete.
    """
    queryset = Quiz.objects.select_related('created_by', 'subject', 'course').prefetch_related('questions').all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk' # Explicitly state lookup field

    def get_object(self):
        # Use the standard get_object method which handles 404
        quiz = super().get_object()

        # Check permissions for modification/deletion
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            if quiz.created_by != self.request.user:
                # Consider if superusers should bypass this check
                # if not self.request.user.is_superuser:
                raise PermissionDenied("You do not have permission to modify this quiz.")
            if quiz.is_locked:
                raise PermissionDenied("This quiz is locked and cannot be modified.")

        return quiz

    # perform_update and perform_destroy are handled by DRF generics,
    # leveraging the serializer's update method and standard deletion.


class DynamicQuizView(APIView):
    """
    Retrieve a quiz by its permalink for display.
    """
    permission_classes = [AllowAny] # Publicly accessible view

    def get(self, request, permalink):
        # Optimize query by prefetching related questions
        quiz = get_object_or_404(
            Quiz.objects.select_related('created_by', 'subject', 'course')
                        .prefetch_related('questions'),
            permalink=permalink
        )
        serializer = QuizSerializer(quiz, context={"request": request})

        # Log quiz start event if user is authenticated
        if request.user.is_authenticated:
            log_event(
                user=request.user,
                event_type='quiz_started',
                instance=quiz,
                metadata={'permalink': quiz.permalink, 'quiz_id': quiz.id}
            )

        # Prepare SEO data (ensure defaults)
        seo_data = {
            "title": quiz.seo_title or quiz.title,
            "description": quiz.seo_description or '', # Default to empty string
            "canonical_url": request.build_absolute_uri(), # Use current URL as canonical by default
            "og_title": quiz.og_title or quiz.title,
            "og_description": quiz.og_description or '', # Default to empty string
             # Provide a sensible default OG image URL
            "og_image": quiz.og_image or request.build_absolute_uri('/static/default_quiz_image.png'),
        }
        # Override canonical if explicitly set on the quiz
        if quiz.canonical_url:
            seo_data["canonical_url"] = quiz.canonical_url

        return Response({
            "quiz": serializer.data,
            "seo": seo_data
        })


class RecordQuizAnswerView(APIView):
    """
    Records a single answer submitted by a user during a quiz.
    Handles different question types appropriately.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        question_id = request.data.get("question_id")
        # Get the raw selected_option from the request data
        selected_option_raw = request.data.get("selected_option")

        if selected_option_raw is None or question_id is None:
            return Response({"error": "selected_option and question_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch the question, ensuring it belongs to the specified quiz (pk)
        question = get_object_or_404(Question, pk=question_id, quiz_id=pk)

        is_correct = False
        correct_answer_value = None # Store the actual correct answer for logging/comparison
        processed_selected_option = selected_option_raw # Keep track of the processed answer

        # --- Handle different question types ---
        q_type = question.question_type

        try:
            if q_type == 'mcq':
                # For MCQ, expect an integer
                processed_selected_option = int(selected_option_raw)
                correct_answer_value = question.correct_option
                # Ensure correct_answer_value is not None before comparing
                is_correct = (correct_answer_value is not None and processed_selected_option == correct_answer_value)

            elif q_type == 'multi':
                # For Multi-Select, expect a list of integers
                if not isinstance(selected_option_raw, list):
                    raise TypeError("selected_option must be a list for multi-select questions.")
                # Ensure all elements in the list are integers and sort for comparison
                processed_selected_option = sorted([int(opt) for opt in selected_option_raw])
                correct_set = set(question.correct_options or []) # Handles null correct_options
                correct_answer_value = sorted(list(correct_set)) # Log the sorted correct list
                is_correct = (processed_selected_option == correct_answer_value) # Compare sorted lists

            elif q_type == 'short':
                # For Short Answer, expect a string
                if not isinstance(selected_option_raw, (str, int, float)): # Allow numbers to be treated as strings
                    raise TypeError("selected_option must be a string or number for short answer questions.")
                processed_selected_option = str(selected_option_raw).strip() # Convert to string and trim
                correct_answer_value = question.correct_answer # Use correct_answer field
                # Case-insensitive comparison is generally better for short answers
                is_correct = (correct_answer_value is not None and processed_selected_option.lower() == correct_answer_value.lower())

            elif q_type == 'sort':
                # For Word Sort, expect a list of strings (the user's sorted order)
                if not isinstance(selected_option_raw, list):
                     raise TypeError("selected_option must be a list of strings for word sort questions.")
                processed_selected_option = selected_option_raw
                correct_answer_value = question.correct_options # Assuming correct_options stores the correct list
                # Ensure correct_answer_value is also a list for comparison
                is_correct = (isinstance(correct_answer_value, list) and processed_selected_option == correct_answer_value)

            elif q_type == 'dragdrop':
                 # For Drag/Drop, expect a specific structure (e.g., the mapping sent from frontend)
                 # Implement comparison based on the structure stored in question.correct_options
                 processed_selected_option = selected_option_raw
                 correct_answer_value = question.correct_options # Assuming correct_options stores the solution map
                 # Example comparison (replace with your actual logic):
                 # is_correct = compare_drag_drop_solutions(processed_selected_option, correct_answer_value)
                 is_correct = False # Placeholder: Implement actual comparison

            else:
                # Handle unknown question types if necessary
                return Response({"error": f"Unsupported question type for answer recording: {q_type}"}, status=status.HTTP_400_BAD_REQUEST)

        except (ValueError, TypeError) as e:
             # Catch errors during type conversion (e.g., int(), list comprehension)
             return Response({"error": f"Invalid format for selected_option for question type '{q_type}': {e}"}, status=status.HTTP_400_BAD_REQUEST)


        # --- Log the event ---
        log_event(
            user=request.user,
            event_type='quiz_answer_submitted',
            instance=question.quiz, # Log against the quiz
            metadata={
                'quiz_id': question.quiz.id,
                'question_id': question.id,
                'question_type': question.question_type,
                'submitted_answer': processed_selected_option, # Log the processed answer
                'correct_answer': correct_answer_value,      # Log the actual correct answer/options
                'is_correct': is_correct,
            }
        )

        # --- Return Response ---
        # Return more info to frontend if needed (e.g., the correct answer if wrong)
        response_data = {
            "message": "Answer recorded",
            "is_correct": is_correct,
            # Optionally include correct answer if submission was incorrect
            # "correct_answer": correct_answer_value if not is_correct else None
        }
        return Response(response_data, status=status.HTTP_200_OK)


class QuizListByCourseView(generics.ListAPIView):
    """
    Returns a list of quizzes attached to a given course.
    """
    serializer_class = QuizSerializer
    permission_classes = [AllowAny] # Or IsAuthenticated if only logged-in users see course quizzes

    def get_queryset(self):
        course_id = self.kwargs.get("course_id")
        # Ensure course_id is provided
        if course_id is None:
            return Quiz.objects.none() # Return empty if no course ID
        # Optimize query
        return Quiz.objects.filter(course_id=course_id).select_related('created_by', 'subject')


class MyQuizzesView(generics.ListAPIView):
    """
    Returns quizzes created by the logged-in user.
    """
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Optimize query
        return Quiz.objects.filter(created_by=self.request.user).select_related('subject', 'course')

