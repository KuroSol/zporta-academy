// StudyDashboard.js
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
  const [recQuizzes, setRecQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const loadQuizzes = async () => {
      setLoading(true);
      setError('');
      try {
        // 1) load feed quizzes
        const { data: feedData } = await apiClient.get('study/dashboard/');
        const base = feedData.suggested_quizzes || [];
        setFeedQuizzes(base);

        // 2) attempt personal recs
        try {
          const { data: recData } = await apiClient.get('analytics/quiz-recommendations/');
          setRecQuizzes(recData.recommended_quizzes.length ? recData.recommended_quizzes : base);
        } catch {
          // fallback
          setRecQuizzes(base);
        }
      } catch (e) {
        console.error(e);
        setError('Could not load quizzes.');
      } finally {
        setLoading(false);
      }
    };
    loadQuizzes();
  }, [token, navigate]);

  if (loading) return (<div className={styles.centeredMessage}><Loader /><p>Loading...</p></div>);
  if (error) return (
    <div className={`${styles.centeredMessage} ${styles.errorMessageContainer}`}>
      <AlertTriangle /><p>{error}</p>
      <button onClick={()=>window.location.reload()} className={styles.retryButton}><RefreshCw /> Retry</button>
    </div>
  );

  const renderQuiz = (quiz, source) => (
    <article key={quiz.id} className={`${styles.feedItem} ${styles.quizFeedItemContainer}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}><FileQuestion /></div>
        <div className={styles.cardHeaderText}>
          <h3 className={styles.cardTitle}>{quiz.title}</h3>
          <p className={styles.cardSubtitle}>
            <span className={styles.itemTypeLabel}>Quiz</span>
            <span className={styles.subjectTag}>{quiz.subject?.name||'General'}</span>
            <span className={styles.sourceTag}>{source}</span>
          </p>
        </div>
        <Link to={`/quizzes/${quiz.permalink}`} className={styles.cardAction}><span>Take Quiz</span><ArrowRight/></Link>
      </div>
      <div className={styles.quizCardWrapper}><QuizCard quiz={quiz} isFeedView/></div>
    </article>
  );

  return (
    <div className={styles.dashboardContainer}>
      {user && <p className={styles.welcomeMessage}>Welcome back, {user.first_name||user.username}!</p>}
      <section>
        <h2 className={styles.sectionTitle}>Recommended For You</h2>
        <div className={styles.feedContainer}>{recQuizzes.map(q=>renderQuiz(q,'Recommended'))}</div>
      </section>
      <h1 className={styles.pageTitle}>All Quizzes</h1>
      <div className={styles.feedContainer}>{feedQuizzes.map(q=>renderQuiz(q,'Random'))}</div>
    </div>
  );
}