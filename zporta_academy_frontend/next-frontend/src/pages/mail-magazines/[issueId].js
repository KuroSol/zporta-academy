import { useRouter } from 'next/router';
import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/context/AuthContext';
import apiClient from '@/api';
import styles from '@/styles/MailMagazineIssue.module.css';
import { FaArrowLeft } from 'react-icons/fa';

export default function MailMagazineIssuePage() {
  const router = useRouter();
  const { issueId } = router.query;
  const { token, logout } = useContext(AuthContext);
  
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    
    if (!issueId) return;

    const fetchIssue = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await apiClient.get(`/mailmagazine/issues/${issueId}/`);
        setIssue(data);
      } catch (err) {
        console.error('Error fetching mail magazine issue:', err);
        if (err.response?.status === 401) {
          logout();
        } else if (err.response?.status === 403) {
          setError('You do not have permission to view this mail magazine issue.');
        } else if (err.response?.status === 404) {
          setError('Mail magazine issue not found.');
        } else {
          setError('Failed to load mail magazine issue. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchIssue();
  }, [issueId, token, router, logout]);

  const handleBack = () => {
    if (issue?.teacher_username) {
      // Go back to the teacher's profile, specifically the magazines tab if possible
      // Since we can't easily control the tab state from URL without modifying the profile page,
      // we'll just go to the profile. The user can click the tab.
      router.push(`/guide/${issue.teacher_username}`);
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => router.push('/home')} className={styles.homeButton}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Not Found</h2>
          <p>This mail magazine issue could not be found.</p>
          <button onClick={() => router.push('/home')} className={styles.homeButton}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button onClick={handleBack} className={styles.backButton}>
        <FaArrowLeft /> Back to List
      </button>

      <div className={styles.meta}>
        <p className={styles.sentDate}>
          Sent on {new Date(issue.sent_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
        <p className={styles.teacher}>By {issue.teacher_username}</p>
      </div>
      
      <div 
        className={styles.content}
        dangerouslySetInnerHTML={{ __html: issue.html_content }}
      />
    </div>
  );
}
