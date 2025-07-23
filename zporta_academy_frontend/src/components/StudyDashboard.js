import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api';
import { AuthContext } from '../context/AuthContext';
import styles from './StudyDashboard.module.css';
import QuizCard from './QuizCard';
import { FileQuestion, Loader, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';

export default function StudyDashboard() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [feedQuizzes, setFeedQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const loadFeed = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await apiClient.get('feed/dashboard/');
        setFeedQuizzes(data);
      } catch (e) {
        console.error(e);
        setError('Could not load your study feed.');
      } finally {
        setLoading(false);
      }
    };

    loadFeed();
  }, [token, navigate]);

  if (loading) {
    return (
      <div className={styles.centeredMessage}>
        <Loader />
        <p>Loading your study feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.centeredMessage} ${styles.errorMessageContainer}`}>
        <AlertTriangle />
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className={styles.retryButton}>
          <RefreshCw /> Retry
        </button>
      </div>
    );
  }

  const getSourceLabel = (source) => {
    switch (source) {
      case 'review':
        return '🧠 Review';
      case 'personalized':
        return '🎯 Personalized';
      case 'explore':
        return '🌍 Explore';
      default:
        return '';
    }
  };

  const renderQuiz = (quiz) => (
    <article key={quiz.id} className={`${styles.feedItem} ${styles.quizFeedItemContainer}`}>
      <div className={styles.cardHeader}>

        <div className={styles.cardHeaderText}>
          <h3 className={styles.cardTitle}>{quiz.title}</h3>
          <p className={styles.cardSubtitle}>
            <span className={styles.itemTypeLabel}>Quiz</span>
            <span className={styles.questionCountTag}>{quiz.questions?.length||0} Questions</span>
            <span className={styles.sourceTag}>{getSourceLabel(quiz.source)}</span>
          </p>
        </div>
        <Link to={`/quizzes/${quiz.permalink}`} className={styles.cardAction}>
          <span>Take Quiz</span>
          <ArrowRight />
        </Link>
      </div>
      <div className={styles.quizCardWrapper}>
        <QuizCard quiz={quiz} isFeedView />
      </div>
    </article>
  );

  return (
    <div className={styles.dashboardContainer}>
      {user && <p className={styles.welcomeMessage}>Welcome back, {user.first_name || user.username}!</p>}
      <h1 className={styles.pageTitle}>Your Study Feed</h1>
      <div className={styles.feedContainer}>
        {feedQuizzes.map((quiz) => renderQuiz(quiz))}
      </div>
    </div>
  );
}
