import React, { useState } from 'react';
import styles from './ReportQuizModal.module.css'; // create CSS similar to CollaborationInviteModal
import apiClient from '../api';  

const ReportQuizModal = ({ isOpen, onClose, quizId }) => {
  const [message, setMessage] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!message.trim()) { setError('Please describe the problem.'); return; }
    setLoading(true);
    try {
      await apiClient.post(`/quizzes/${quizId}/report/`, {
        message,
        suggested_correction: suggestion
      });
      alert('Thank you! Your report has been sent.'); // replace with toast if available
      onClose();
      setMessage(''); setSuggestion('');
    } catch (err) {
      setError('Failed to submit report.');
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>Report a Problem</h2>
        {error && <p className={styles.error}>{error}</p>}
        <textarea
          placeholder="Describe the incorrect answer, outdated fact or misleading content..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
        />
        <textarea
          placeholder="Optional: suggest correction or additional notes"
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          rows={2}
        />
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
        <button onClick={onClose} className={styles.cancelButton}>Cancel</button>
      </div>
    </div>
  );
};

export default ReportQuizModal;
