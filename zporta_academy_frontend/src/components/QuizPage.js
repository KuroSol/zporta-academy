import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import apiClient from '../api';
import { AuthContext } from '../context/AuthContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';           // ← Add
import "./QuizPage.css";

const QuizPage = () => {
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);               // ← Add

  const { username, subject, date, quizSlug } = useParams();
  const permalink = `${username}/${subject}/${date}/${quizSlug}`;
  const navigate = useNavigate();
  const { user, token, logout } = useContext(AuthContext);

  // Fetch quiz + questions
  useEffect(() => {
    const fetchQuiz = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/quizzes/${permalink}/`);
        setQuizData(res.data.quiz); // note: res.data.quiz contains the Quiz object
      } catch (err) {
        setError("Failed to load quiz.");
        if (err.response?.status === 401) logout();
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchQuiz();
    else navigate('/login');
  }, [permalink, token, logout, navigate]);

  // Derived values for slider
  if (!loading && !quizData) return <div>Quiz not found.</div>;
  const questions = quizData?.questions || [];
  const total = questions.length;
  const q = questions[currentIndex] || {};                          // current question

  // Handle a user selecting an option
  const handleAnswer = async (i) => {
    if (answerSubmitted) return;
    setAnswerSubmitted(true);
    const selected = i + 1;
    const isCorrect = selected === q.correct_option;

    alert(isCorrect ? '✅ Correct!' : '❌ Wrong!');

    try {
      await apiClient.post(`/quizzes/${quizData.id}/record-answer/`, {
        question_id: q.id,
        selected_option: selected
      });
    } catch (err) {
      if (err.response?.status === 401) logout();
      console.error("Logging error:", err);
    }
  };

  // Prev / Next controls
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

  if (loading) return <div>Loading...</div>;
  if (error)   return <p className="error">{error}</p>;

  // Render slider
  return (
    <div className="quiz-detail-container">
      <Helmet>
        <title>{quizData.seo_title || quizData.title}</title>
        <meta name="description" content={quizData.seo_description} />
        <link rel="canonical" href={quizData.canonical_url} />
        <meta property="og:title" content={quizData.og_title} />
        <meta property="og:description" content={quizData.og_description} />
        <meta property="og:image" content={quizData.og_image} />
      </Helmet>

      <h1>{quizData.title}</h1>

      {/* Progress */}
      <div className="quiz-detail-progress">
        Question {currentIndex + 1} of {total}
      </div>

      {/* Question */}
      <div
        className="quiz-detail-question"
        dangerouslySetInnerHTML={{ __html: q.question_text }}
      />

      {/* Options */}
      <ul className="quiz-detail-options">
        {[q.option1, q.option2, q.option3, q.option4]
          .filter(Boolean)
          .map((opt, idx) => (
            <li
              key={idx}
              className={`quiz-detail-option ${answerSubmitted ? 'disabled' : ''}`}
              onClick={() => handleAnswer(idx)}
              dangerouslySetInnerHTML={{ __html: opt }}
            />
        ))}
      </ul>

      {/* Prev / Next */}
      <div className="quiz-detail-nav">
        <button
          type="button"
          className="quiz-nav-button"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={24} />
        </button>
        <button
          type="button"
          className="quiz-nav-button"
          onClick={goNext}
          disabled={currentIndex === total - 1}
        >
          <ChevronRight size={24} />
        </button>
      </div>

    </div>
  );
};

export default QuizPage;
