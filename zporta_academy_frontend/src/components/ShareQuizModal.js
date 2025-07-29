import React, { useState, useEffect } from 'react';
import styles from './ShareQuizModal.module.css';
import apiClient from '../api';   
const ShareQuizModal = ({ isOpen, onClose, quizId, quizLink }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const handler = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const res = await apiClient.get(`/users/search/?q=${search}`);
        setResults(res.data.results || []);
      } catch (err) {
        setError('Failed to search users.');
      } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const handleShare = async (user) => {
    try {
      await apiClient.post(`/quizzes/${quizId}/share/`, { to_user_id: user.id });
      alert(`Shared with ${user.username}!`);
    } catch (err) {
      alert(err.response?.data?.error || 'Share failed.');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(quizLink).then(() => {
      alert('Quiz link copied to clipboard!');
    });
  };

  if (!isOpen) return null;
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>Share Quiz</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user by username"
        />
        {loading && <p>Searching...</p>}
        {error && <p className={styles.error}>{error}</p>}
        {!loading && results.map((user) => (
          <div key={user.id} className={styles.userRow}>
            <span>{user.username} ({user.email})</span>
            <button onClick={() => handleShare(user)}>Share</button>
          </div>
        ))}
        {search.length > 1 && results.length === 0 && !loading && (
          <p>No users found.</p>
        )}
        <hr />
        <p>Or share via link:</p>
        <div className={styles.linkRow}>
          <span>{quizLink}</span>
          <button onClick={handleCopy}>Copy</button>
        </div>
        <button onClick={onClose} className={styles.cancelButton}>Close</button>
      </div>
    </div>
  );
};

export default ShareQuizModal;
