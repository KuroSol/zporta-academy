import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '@/context/AuthContext';
import apiClient from '@/api';
import styles from '@/styles/MailMagazine.module.css';
import { FaEnvelope, FaPlus, FaTimes, FaPaperPlane, FaSpinner } from 'react-icons/fa';

const MailMagazine = () => {
  const { user, token, logout } = useContext(AuthContext);
  const router = useRouter();

  const [mailMagazines, setMailMagazines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    body: '',
    frequency: 'one_time'
  });
  const [formError, setFormError] = useState('');

  // Check if user has permission (guide, both, or admin)
  const hasPermission = () => {
    if (!user) return false;
    return (
      user.is_staff ||
      user.is_superuser ||
      user.role === 'guide' ||
      user.role === 'both'
    );
  };

  // Fetch mail magazines
  const fetchMailMagazines = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/teacher-mail-magazines/');
      setMailMagazines(response.data || []);
    } catch (err) {
      console.error('Error fetching mail magazines:', err);
      if (err.response?.status === 403) {
        setError('You do not have permission to access this feature.');
      } else if (err.response?.status === 401) {
        logout();
        router.push('/login');
      } else {
        setError('Failed to load mail magazines. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    if (!hasPermission()) {
      setError('You do not have permission to access this feature. Only teachers and admins can create mail magazines.');
      setLoading(false);
      return;
    }

    fetchMailMagazines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateMailMagazine = async (e) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!formData.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!formData.subject.trim()) {
      setFormError('Subject is required.');
      return;
    }
    if (!formData.body.trim()) {
      setFormError('Message body is required.');
      return;
    }

    setCreating(true);
    try {
      await apiClient.post('/teacher-mail-magazines/', formData);
      // Reset form
      setFormData({
        title: '',
        subject: '',
        body: '',
        frequency: 'one_time'
      });
      setShowCreateForm(false);
      // Refresh list
      fetchMailMagazines();
    } catch (err) {
      console.error('Error creating mail magazine:', err);
      setFormError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to create mail magazine. Please try again.'
      );
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <FaSpinner className={styles.spinner} />
          <p>Loading mail magazines...</p>
        </div>
      </div>
    );
  }

  if (error && !hasPermission()) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>{error}</p>
          <button onClick={() => router.push('/profile')} className={styles.backButton}>
            Back to Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <FaEnvelope className={styles.headerIcon} />
          <h1>Mail Magazine</h1>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={styles.createButton}
        >
          {showCreateForm ? <FaTimes /> : <FaPlus />}
          {showCreateForm ? 'Cancel' : 'Create New'}
        </button>
      </div>

      {showCreateForm && (
        <div className={styles.createForm}>
          <h2>Create Mail Magazine</h2>
          {formError && <div className={styles.formError}>{formError}</div>}
          <form onSubmit={handleCreateMailMagazine}>
            <div className={styles.formGroup}>
              <label htmlFor="title">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter mail magazine title"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="subject">Email Subject *</label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                placeholder="Enter email subject line"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="frequency">Frequency</label>
              <select
                id="frequency"
                name="frequency"
                value={formData.frequency}
                onChange={handleInputChange}
                className={styles.select}
              >
                <option value="one_time">One Time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="body">Message *</label>
              <textarea
                id="body"
                name="body"
                value={formData.body}
                onChange={handleInputChange}
                placeholder="Write your message here..."
                className={styles.textarea}
                rows="10"
                required
              />
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={creating}
            >
              {creating ? (
                <>
                  <FaSpinner className={styles.spinner} />
                  Creating...
                </>
              ) : (
                <>
                  <FaPaperPlane />
                  Create Mail Magazine
                </>
              )}
            </button>
          </form>
        </div>
      )}

      <div className={styles.listSection}>
        <h2>Your Mail Magazines</h2>
        {error && <div className={styles.error}>{error}</div>}
        {mailMagazines.length === 0 ? (
          <div className={styles.emptyState}>
            <FaEnvelope className={styles.emptyIcon} />
            <p>No mail magazines yet.</p>
            <p className={styles.emptySubtext}>
              Create your first mail magazine to communicate with your students!
            </p>
          </div>
        ) : (
          <div className={styles.magazineList}>
            {mailMagazines.map((magazine) => (
              <div key={magazine.id} className={styles.magazineCard}>
                <div className={styles.cardHeader}>
                  <h3>{magazine.title}</h3>
                  <span className={styles.frequency}>{magazine.frequency.replace('_', ' ')}</span>
                </div>
                <div className={styles.cardContent}>
                  <p className={styles.subject}>
                    <strong>Subject:</strong> {magazine.subject}
                  </p>
                  <p className={styles.body}>
                    {magazine.body.length > 150
                      ? `${magazine.body.substring(0, 150)}...`
                      : magazine.body}
                  </p>
                </div>
                <div className={styles.cardFooter}>
                  <span className={styles.date}>
                    Created: {formatDate(magazine.created_at)}
                  </span>
                  {magazine.last_sent_at && (
                    <span className={styles.date}>
                      Last Sent: {formatDate(magazine.last_sent_at)}
                    </span>
                  )}
                  <span className={styles.status}>
                    {magazine.is_active ? (
                      <span className={styles.activeStatus}>Active</span>
                    ) : (
                      <span className={styles.inactiveStatus}>Inactive</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MailMagazine;
