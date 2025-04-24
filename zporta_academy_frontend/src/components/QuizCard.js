import React, { useState, useContext } from 'react';
import apiClient from '../api';
import { AuthContext } from '../context/AuthContext';
import './QuizCard.css';

const QuizCard = ({ quiz }) => {
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const { logout } = useContext(AuthContext);

  const checkAnswer = (index) => {
    if (answerSubmitted) return;
    setAnswerSubmitted(true);

    const selectedOption = index + 1;
    const correctOption = quiz.correct_option;
    const isCorrect = selectedOption === correctOption;

    // Immediate feedback
    alert(isCorrect ? '✅ Correct!' : '❌ Wrong!');

    // Log to server
    apiClient.post(`/quizzes/${quiz.id}/record-answer/`, {
      selected_option: selectedOption
    })
    .catch(err => {
      console.error('Logging error', err);
      if (err.response?.status === 401) logout();
    });
  };

  return (
    <div className="quiz-card">
      <h3 className="quiz-card-title">{quiz.title}</h3>
      <div className="quiz-card-content" dangerouslySetInnerHTML={{ __html: quiz.content }} />
      <ul className="quiz-options">
        {[quiz.option1, quiz.option2, quiz.option3, quiz.option4]
          .filter(Boolean)
          .map((opt, i) => (
            <li
              key={i}
              className={`quiz-option ${answerSubmitted ? 'disabled' : ''}`}
              onClick={() => checkAnswer(i)}
              dangerouslySetInnerHTML={{ __html: opt }}
            />
          ))
        }
      </ul>
    </div>
  );
};

export default QuizCard;
