import React, { useState, useContext } from 'react';
import apiClient from '../api';
import { AuthContext } from '../context/AuthContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './QuizCard.css';

const QuizCard = ({ quiz }) => {
  const { logout } = useContext(AuthContext);

  // Safely grab the questions array (could be undefined)
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const total = questions.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);

  // If there are zero questions, just show the title
  if (total === 0) {
    return (
      <div className="quiz-card">
        <h3 className="quiz-card-title">{quiz.title}</h3>
        <p className="quiz-no-questions">No questions available.</p>
      </div>
    );
  }

  // Safe question object
  const q = questions[currentIndex];

  const checkAnswer = (optionIndex) => {
    if (answerSubmitted) return;
    setAnswerSubmitted(true);

    const selectedOption = optionIndex + 1;
    const isCorrect = selectedOption === q.correct_option;
    alert(isCorrect ? '✅ Correct!' : '❌ Wrong!');

    apiClient
      .post(`/quizzes/${quiz.id}/record-answer/`, {
        question_id: q.id,
        selected_option: selectedOption
      })
      .catch(err => {
        console.error('Logging error', err);
        if (err.response?.status === 401) logout();
      });
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setAnswerSubmitted(false);
    }
  };

  const goNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswerSubmitted(false);
    }
  };

  return (
    <div className="quiz-card">
      <h3 className="quiz-card-title">{quiz.title}</h3>

      <div className="quiz-progress">
        Question {currentIndex + 1} of {total}
      </div>

      <div
        className="quiz-question"
        dangerouslySetInnerHTML={{ __html: q.question_text }}
      />

      <ul className="quiz-options">
        {[q.option1, q.option2, q.option3, q.option4]
          .filter(Boolean)
          .map((opt, i) => (
            <li
              key={i}
              className={`quiz-option ${answerSubmitted ? 'disabled' : ''}`}
              onClick={() => checkAnswer(i)}
              dangerouslySetInnerHTML={{ __html: opt }}
            />
          ))}
      </ul>

      <div className="quiz-nav">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="quiz-nav-button"
        >
          <ChevronLeft size={24} />
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={currentIndex === total - 1}
          className="quiz-nav-button"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};

export default QuizCard;
