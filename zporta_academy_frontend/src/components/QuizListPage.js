import React, { useEffect, useState, useContext } from 'react'; // Added useContext
import { Link } from 'react-router-dom';
import apiClient from '../api'; // <-- Added apiClient (Adjust path ../api)
import { AuthContext } from '../context/AuthContext'; // <-- Added AuthContext (Adjust path)
import './QuizListPage.css'; // Assuming CSS path is correct

const QuizListPage = () => {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token, logout } = useContext(AuthContext); // <-- Use Context
    const [error, setError] = useState(null); // <-- Added error state

    useEffect(() => {
        const fetchQuizzes = async () => {
            setLoading(true);
            setError(null);
            try {
                // Use apiClient.get, relative URL, auth handled
                const response = await apiClient.get('/quizzes/my/');
                if (Array.isArray(response.data)) { // Check if response is an array
                   setQuizzes(response.data);
                } else {
                   console.error("Invalid data format for quizzes:", response.data);
                   setQuizzes([]);
                   setError("Received invalid data for quizzes.");
                }
            } catch (error) {
                console.error("Error fetching quizzes:", error.response ? error.response.data : error.message);
                setError("Failed to load your quizzes.");
                if (error.response?.status === 401) logout();
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchQuizzes();
        } else {
            setLoading(false);
            setError("Please log in to view your quizzes.");
            setQuizzes([]);
        }
    }, [token, logout]); // Add token and logout dependencies

    // Render Logic
    if (loading) return <div style={{ padding: '20px' }}>Loading...</div>; // Add some padding
    if (error) return <p className="error" style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</p>;

    // Main JSX
    return (
        <div className="quiz-list-container">
            <h1>My Quizzes</h1>
            {quizzes.length === 0 ? (
                <p>You haven't created or been assigned any quizzes yet.</p> // Slightly more informative message
            ) : (
                <ul className="quiz-list">
                    {quizzes.map((quiz) => (
                        <li key={quiz.id} className="quiz-list-item">
                            {/* Ensure quiz.permalink exists and link structure is correct */}
                            <Link to={quiz.permalink ? `/quizzes/${quiz.permalink}` : '#'}>
                                {quiz.title || 'Untitled Quiz'}
                            </Link>
                            {/* Optionally add more info like subject or date */}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default QuizListPage;