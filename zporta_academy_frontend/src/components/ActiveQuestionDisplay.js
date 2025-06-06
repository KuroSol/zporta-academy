// components/ActiveQuestionDisplay.js (Example path)
import React, { useState, useEffect, useRef, useContext } from 'react';
import apiClient from '../api'; // Your API client
import { AuthContext } from '../context/AuthContext'; // Your Auth context
import styles from './ActiveQuestionDisplay.module.css'; // Create corresponding CSS

const ActiveQuestionDisplay = ({ quizId, question, onAnswerProcessed, questionNumber, totalQuestions }) => {
  const [startTime, setStartTime] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null); // Store the user's selected answer
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // To show if answer was correct/incorrect

  const { token } = useContext(AuthContext);

  useEffect(() => {
    setStartTime(Date.now());
    setSelectedAnswer(null); // Reset selected answer when question changes
    setFeedback(null); // Reset feedback
    // console.log(`Displaying Q:${question.id} from Quiz:${quizId}. Timer started.`);
  }, [question.id, quizId]); // Effect runs when the question prop changes

  const handleAnswerSelection = (answerValue) => {
    if (feedback) return; // Don't allow changing answer after feedback is shown
    setSelectedAnswer(answerValue);
  };

  const handleSubmitAnswer = async () => {
    if (selectedAnswer === null) {
      alert("Please select an answer."); // Replace with a proper UI message
      return;
    }
    if (isSubmitting || feedback) return; // Prevent multiple submissions or submission after feedback

    setIsSubmitting(true);
    const endTime = Date.now();
    const timeSpentMs = endTime - startTime;
    // console.log(`Submitting Q:${question.id}. Time spent: ${timeSpentMs}ms. Answer: ${selectedAnswer}`);

    try {
      // This endpoint is from the conceptual `quizzes/views.py - SubmitAnswerView`
      const response = await apiClient.post('/quizzes/submit-answer/', { // Adjust API path
        quiz_id: quizId,
        question_id: question.id,
        answer_data: selectedAnswer, // Send the actual answer value
        time_spent_ms: timeSpentMs,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // console.log("Answer submission response:", response.data);
      setFeedback({
        isCorrect: response.data.is_correct,
        message: response.data.is_correct ? "Correct!" : "Incorrect.", // Add more detailed feedback if API provides it
        // correctAnswer: response.data.correct_answer_details // If API returns correct answer
      });

      // Call parent callback after a short delay to show feedback
      setTimeout(() => {
        onAnswerProcessed({
          questionId: question.id,
          isCorrect: response.data.is_correct,
          nextReviewAt: response.data.next_review_at, // For potential immediate UI update
          // ... any other relevant data from response
        });
      }, 1500); // Show feedback for 1.5 seconds

    } catch (error) {
      console.error("Error submitting answer:", error);
      setFeedback({
          isCorrect: false,
          message: error.response?.data?.error || "Submission failed. Please try again."
      });
       // Potentially call onAnswerProcessed with error flag or retry logic
    } finally {
      // setIsSubmitting(false); // Keep it true if we navigate away after timeout
    }
  };

  // --- Render answer options (example for multiple choice) ---
  // You'll need to adapt this based on your question.question_type (e.g., text input, true/false)
  const renderAnswerOptions = () => {
    if (!question.options || !Array.isArray(question.options)) { // Assuming question.options is an array of {id, text}
      return <p>No answer options available for this question.</p>;
    }
    return question.options.map((option) => (
      <button
        key={option.id}
        onClick={() => handleAnswerSelection(option.id)} // Assuming option.id is the value to submit
        className={`${styles.optionButton} ${selectedAnswer === option.id ? styles.selected : ''} ${feedback && option.id === (feedback.isCorrect ? selectedAnswer : question.correct_answer_id_placeholder) ? styles.correct : ''} ${feedback && !feedback.isCorrect && option.id === selectedAnswer ? styles.incorrect : ''}`}
        disabled={isSubmitting || feedback} // Disable after submission/feedback
      >
        {option.text}
      </button>
    ));
  };

  return (
    <div className={styles.activeQuestionContainer}>
      <div className={styles.questionHeader}>
        <h3>Question {questionNumber} of {totalQuestions}</h3>
        {/* Potentially add a timer display here if desired, though time_spent_ms is logged on submit */}
      </div>
      <div className={styles.questionText} dangerouslySetInnerHTML={{ __html: question.question_text || "" }}></div>
      
      <div className={styles.answerOptions}>
        {renderAnswerOptions()}
      </div>

      {!feedback && (
        <button 
          onClick={handleSubmitAnswer} 
          disabled={selectedAnswer === null || isSubmitting}
          className={styles.submitButton}
        >
          {isSubmitting ? "Submitting..." : "Submit Answer"}
        </button>
      )}

      {feedback && (
        <div className={`${styles.feedbackMessage} ${feedback.isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}>
          {feedback.message}
          {/* {!feedback.isCorrect && feedback.correctAnswer && <p>Correct answer: {feedback.correctAnswer}</p>} */}
        </div>
      )}
    </div>
  );
};

export default ActiveQuestionDisplay;