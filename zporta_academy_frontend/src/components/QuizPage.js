import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import apiClient from '../api';
import { AuthContext } from '../context/AuthContext';
import "./QuizPage.css";
import { Pencil, Trash2 } from 'lucide-react';

const QuizPage = () => {
  // Declare all hooks at the top of the component.
  const [userAnswers, setUserAnswers] = useState([]);
  const [quizData, setQuizData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editQuiz, setEditQuiz] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);

  const { username, subject, date, quizSlug } = useParams();
  const permalink = `${username}/${subject}/${date}/${quizSlug}`;
  const navigate = useNavigate();
  const { user, token, logout } = useContext(AuthContext);

  // Fetch quiz data on mount/when token or permalink changes.
  useEffect(() => {
    const fetchQuizData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get(`/quizzes/${permalink}/`);
        setQuizData(response.data);
      } catch (error) {
        console.error('Error fetching quiz data', error.response ? error.response.data : error.message);
        setError("Failed to load quiz data.");
        if (error.response?.status === 401) logout();
      } finally {
        setLoading(false);
      }
    };

    if (token && permalink) {
      fetchQuizData();
    } else {
      setLoading(false);
      if (!token) navigate('/login');
    }
  }, [permalink, token, logout, navigate]);

  // Conditional rendering after all hooks have been called.
  if (loading) return <div>Loading...</div>;
  if (error) return <p className="error" style={{ color: 'red' }}>{error}</p>;
  if (!quizData || !quizData.quiz) return <div>Quiz not found.</div>;

  const { quiz, seo } = quizData;
  const isCreator = quiz.created_by?.toLowerCase() === user.username.toLowerCase();
  const isLocked = quiz.is_locked;

  // Function to handle answer submission immediately when a user clicks an option.
  const checkAnswer = (selectedIndex) => {
    if (answerSubmitted) return; // Prevent multiple clicks

    setAnswerSubmitted(true); // Mark that an answer has been submitted

    const selectedOption = selectedIndex + 1;
    const correctOption = quiz.correct_option;
    const isCorrect = selectedOption === correctOption;

    alert(isCorrect ? '✅ Correct answer!' : '❌ Wrong answer!');

    apiClient.post(`/quizzes/${quiz.id}/record-answer/`, {
      selected_option: selectedOption
    })
    .then(response => {
      console.log("Answer logged:", response.data);
      // Additional feedback or state updates can be added here if needed.
    })
    .catch(error => {
      console.error("Error logging answer:", error.response ? error.response.data : error.message);
      if (error.response?.status === 401) logout();
    });
  };

  const handleDeleteQuiz = async () => {
    if (isLocked) return alert("This quiz is locked and cannot be deleted.");
    if (window.confirm("Are you sure you want to delete this quiz?")) {
      setError(null);
      try {
        await apiClient.delete(`/quizzes/detail/${quiz.id}/`);
        alert("Quiz deleted successfully.");
        navigate("/quizzes/my");
      } catch (err) {
        console.error("Error deleting quiz:", err.response ? err.response.data : err.message);
        const errorMsg = err.response?.data?.detail || "Failed to delete quiz.";
        setError(errorMsg);
        alert("Error deleting quiz: " + errorMsg);
        if (err.response?.status === 401 || err.response?.status === 403) logout();
      }
    }
  };

  const handleEditClick = () => {
    if (isLocked) return alert("This quiz is locked and cannot be edited.");
    setEditQuiz({ ...quiz });
    setEditMode(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (isLocked) return alert("This quiz is locked and cannot be edited.");
    setError(null);
    try {
      const response = await apiClient.put(`/quizzes/detail/${quiz.id}/`, editQuiz);
      setQuizData(prevData => ({ ...prevData, quiz: response.data }));
      setEditMode(false);
      alert("Quiz updated successfully.");
    } catch (err) {
      console.error("Error updating quiz:", err.response ? err.response.data : err.message);
      let errorMsg = "Failed to update quiz.";
      if (err.response && err.response.data) {
        if (typeof err.response.data === 'object') {
          errorMsg = Object.entries(err.response.data)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
            .join(' | ');
        } else {
          errorMsg = err.response.data.error || err.response.data.detail || errorMsg;
        }
      } else if (err.request) {
        errorMsg = 'Network error.';
      } else {
        errorMsg = 'An unexpected error occurred while updating.';
      }
      setError(errorMsg);
      alert("Error updating quiz: " + errorMsg);
      if (err.response?.status === 401 || err.response?.status === 403) logout();
    }
  };

  const handleCancelEdit = () => setEditMode(false);

  return (
    <div className="quiz-detail-container">
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <link rel="canonical" href={seo.canonical_url} />
        <meta property="og:title" content={seo.og_title} />
        <meta property="og:description" content={seo.og_description} />
        <meta property="og:image" content={seo.og_image} />
      </Helmet>

      {editMode ? (
        <form className="edit-quiz-form" onSubmit={handleSaveEdit}>
          <input 
            value={editQuiz.title} 
            onChange={(e) => setEditQuiz({ ...editQuiz, title: e.target.value })} 
            required 
          />
          <textarea 
            value={editQuiz.content} 
            onChange={(e) => setEditQuiz({ ...editQuiz, content: e.target.value })} 
            required 
          />
          <button type="submit">Save Changes</button>
          <button type="button" onClick={handleCancelEdit}>Cancel</button>
        </form>
      ) : (
        <>
          <h1>{quiz.title}</h1>
          <div dangerouslySetInnerHTML={{ __html: quiz.content }} />
          <ul>
            {[quiz.option1, quiz.option2, quiz.option3, quiz.option4]
              .filter(Boolean)
              .map((option, index) => (
                <li
                  key={index}
                  onClick={() => checkAnswer(index)}
                  className={answerSubmitted ? 'disabled' : ''}
                  dangerouslySetInnerHTML={{ __html: option }}
                />
              ))}
          </ul>
          {isCreator && (
            <div className="quiz-actions">
              <button
                className="quiz-action-btn edit-btn"
                onClick={handleEditClick}
                disabled={isLocked}
                title="Edit Quiz"
              >
                <Pencil size={18} />
              </button>
              <button
                className="quiz-action-btn delete-btn"
                onClick={handleDeleteQuiz}
                disabled={isLocked}
                title="Delete Quiz"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QuizPage; 
