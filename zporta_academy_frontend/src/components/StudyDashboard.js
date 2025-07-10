// StudyDashboard.js - Combined random feed with fallback recommendations
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

  const [quizzes, setQuizzes] = useState([]);
  const [recommendedQuizzes, setRecommendedQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        // Always fetch the general feed
        const feedRes = await apiClient.get('study/dashboard/');
        const feedQuizzes = feedRes.data.suggested_quizzes || [];
        setQuizzes(feedQuizzes);

        // Attempt personalized recommendations
        let recList = [];
        try {
          const recRes = await apiClient.get('analytics/quiz-recommendations/');
          recList = recRes.data.recommended_quizzes || [];
        } catch (recErr) {
          console.warn('Recommendations failed, using general feed:', recErr);
        }

        // Fallback to general feed if no personalized recs
        if (!recList.length) {
          recList = feedQuizzes;
        }
        setRecommendedQuizzes(recList);
      } catch (err) {
        console.error('Error fetching quizzes:', err);
        setError('Could not load quizzes. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, navigate]);

  if (loading) {
    return (
      <div className={styles.centeredMessage}>
        <Loader size={48} className={styles.spinner} />
        <p>Loading quizzes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.centeredMessage} ${styles.errorMessageContainer}`}>
        <AlertTriangle size={48} />
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className={styles.retryButton}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {user && <p className={styles.welcomeMessage}>Welcome back, {user.first_name || user.username}!</p>}

      <section className={styles.recommendationSection}>
        <h2 className={styles.sectionTitle}>Recommended For You</h2>
        <div className={styles.feedContainer}>
          {recommendedQuizzes.map((quiz) => (
            <article key={quiz.id} className={`${styles.feedItem} ${styles.quizFeedItemContainer}`}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}><FileQuestion size={20} /></div>
                <div className={styles.cardHeaderText}>
                  <h3 className={styles.cardTitle}>{quiz.title}</h3>
                  <p className={styles.cardSubtitle}>
                    <span className={styles.itemTypeLabel}>Quiz</span>
                    <span className={styles.subjectTag}>{quiz.subject?.name || 'General'}</span>
                  </p>
                </div>
                <Link to={`/quizzes/${quiz.permalink}`} className={styles.cardAction}>
                  <span>Take Quiz</span><ArrowRight size={18} />
                </Link>
              </div>
              <div className={styles.quizCardWrapper}>
                <QuizCard quiz={quiz} isFeedView />
              </div>
            </article>
          ))}
        </div>
      </section>

      <h1 className={styles.pageTitle}>All Quizzes</h1>
      {quizzes.length > 0 ? (
        <div className={styles.feedContainer}>
          {quizzes.map((quiz) => (
            <article key={quiz.id} className={`${styles.feedItem} ${styles.quizFeedItemContainer}`}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}><FileQuestion size={20} /></div>
                <div className={styles.cardHeaderText}>
                  <h3 className={styles.cardTitle}>{quiz.title}</h3>
                  <p className={styles.cardSubtitle}>
                    <span className={styles.itemTypeLabel}>Quiz</span>
                    <span className={styles.subjectTag}>{quiz.subject?.name || 'General'}</span>
                  </p>
                </div>
                <Link to={`/quizzes/${quiz.permalink}`} className={styles.cardAction}>
                  <span>Take Quiz</span><ArrowRight size={18} />
                </Link>
              </div>
              <div className={styles.quizCardWrapper}>
                <QuizCard quiz={quiz} isFeedView />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No quizzes available.</p>
        </div>
      )}
    </div>
  );
}
