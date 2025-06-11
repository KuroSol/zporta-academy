import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Send, Copy, Loader2, UserPlus } from 'lucide-react';
import apiClient from '../api'; // Your existing api client
import styles from './CollaborationInviteModal.module.css';

const CollaborationInviteModal = ({ isOpen, onClose, onInviteUser, courseTitle, enrollmentId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteSent, setInviteSent] = useState({});

  const inviteLink = `${window.location.origin}/courses/study/${enrollmentId}`;

  // This is the section we are updating
  useEffect(() => {
    // Don't search if the input is too short
    if (searchTerm.length < 2) {
      setUsers([]);
      return;
    }

    const handler = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        // ======================= CHANGE IS HERE =======================
        // We are using the same endpoint as your DiaryEditor.
        const response = await apiClient.get(`/users/guides/?search=${searchTerm}`);
        
        // Your PublicProfileSerializer returns a list of profiles.
        // We can use it directly.
        setUsers(response.data.results || response.data);
        // =============================================================

      } catch (err) {
        setError('Failed to fetch users.');
        console.error("User search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms delay to wait for user to stop typing

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]); // This effect runs whenever the user types in the search box

  const handleInviteClick = (user) => {
    onInviteUser(user);
    setInviteSent(prev => ({ ...prev, [user.id]: true }));
  };
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
        // You can use a more advanced notification system here if you have one
        alert('Invite link copied to clipboard!'); 
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          <X size={24} />
        </button>
        <div className={styles.modalHeader}>
          <UserPlus className="text-blue-500" size={28} />
          <h2 className={styles.modalTitle}>Invite to Collaborate</h2>
          <p className={styles.modalSubtitle}>
            Share this page with another user to study together.
          </p>
        </div>

        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} size={20} />
          <input
            type="text"
            placeholder="Search for a guide by username..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.resultsContainer}>
          {loading && <Loader2 className={styles.loader} />}
          {error && <p className={styles.errorText}>{error}</p>}
          {!loading && users.length > 0 && (
            <ul className={styles.userList}>
              {/* This JSX maps over the user data from your API */}
              {users.map((user) => (
                <li key={user.id} className={styles.userListItem}>
                  <div className={styles.userInfo}>
                    <img src={user.profile_image_url || `https://placehold.co/40x40/EBF4FF/76A9EA?text=${user.username.charAt(0).toUpperCase()}`} alt={user.username} className={styles.avatar} />
                    <div>
                      {/* Your PublicProfileSerializer provides `username` and `email` */}
                      <p className={styles.userName}>{user.username}</p>
                      <p className={styles.userEmail}>{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleInviteClick(user)}
                    className={`${styles.inviteButton} ${inviteSent[user.id] ? styles.sent : ''}`}
                    disabled={inviteSent[user.id]}
                  >
                    {inviteSent[user.id] ? 'Sent' : 'Invite'}
                    <Send size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && searchTerm.length > 1 && users.length === 0 && (
             <p className={styles.noResults}>No users found.</p>
          )}
        </div>

        <div className={styles.linkShareSection}>
            <p>Or share a direct link:</p>
            <div className={styles.linkContainer}>
                <input type="text" readOnly value={inviteLink} className={styles.linkInput} />
                <button onClick={handleCopyToClipboard} className={styles.copyButton}>
                    <Copy size={18} />
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default CollaborationInviteModal;

