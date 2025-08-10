import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { quizPermalinkToUrl } from '../utils/urls';
import apiClient from '../api';
import { AuthContext } from '../context/AuthContext';
import styles from './StudyDashboard.module.css';
import Select from 'react-select';
import QuizCard from './QuizCard';
import { FileQuestion, Loader, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';

export default function StudyDashboard() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [feedQuizzes, setFeedQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


  // new: preferences form state
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [languageOptions, setLanguageOptions] = useState([]);
  const [selection, setSelection] = useState({ subject: null, language: null });
  const [savingPrefs, setSavingPrefs] = useState(false);

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

        // load subjects & languages for initial preferences
    ;(async () => {
      try {
        const [subs, langs] = await Promise.all([
          apiClient.get('/subjects/'),
          apiClient.get('/feed/preferences/languages/')
        ]);
        setSubjectOptions(subs.data.map(s => ({ value: s.id, label: s.name })));
        setLanguageOptions(langs.data.map(l => ({ value: l.id, label: l.name })));
      } catch (err) {
        console.error('Failed to load preference options', err);
      }
    })();
  }, [token, navigate]);

  // when feed is empty, handle preferences submit
  const handleSavePrefs = async e => {
    e.preventDefault();
    if (!selection.subject || !selection.language) return;
    setSavingPrefs(true);
    try {
      await apiClient.patch(
        '/users/preferences/',
        {
          interested_subjects: [selection.subject.value],
          languages_spoken:     [selection.language.value]
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // reload feed once prefs are set
      const { data } = await apiClient.get('feed/dashboard/');
      setFeedQuizzes(data);
    } catch (err) {
      console.error('Failed to save preferences', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  // show empty-state form when no quizzes
  if (!loading && feedQuizzes.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2>Welcome! Let’s personalize your study feed.</h2>
        <form className={styles.preferenceForm} onSubmit={handleSavePrefs}>
          <div className={styles.preferenceField}>
            <label>What subjects interest you?</label>
            <Select
              options={subjectOptions}
              value={selection.subject}
              onChange={opt => setSelection(s => ({ ...s, subject: opt }))}
              isSearchable
              placeholder="Select a subject…"
              isDisabled={savingPrefs}
            />
          </div>
          <div className={styles.preferenceField}>
            <label>What language do you want to learn?</label>
            <Select
              options={languageOptions}
              value={selection.language}
              onChange={opt => setSelection(s => ({ ...s, language: opt }))}
              isSearchable
              placeholder="Select a language…"
              isDisabled={savingPrefs}
            />
          </div>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={savingPrefs}
          >
            {savingPrefs ? 'Saving…' : 'Save Preferences'}
          </button>
        </form>
      </div>
    );
  }

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
          <a href={quizPermalinkToUrl(quiz.permalink)} className={styles.cardAction}>
            <span>Take Quiz</span>
            <ArrowRight />
          </a>
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
