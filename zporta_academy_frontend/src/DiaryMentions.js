import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  FaAngleDown,
  FaComment,
  FaCog,
  FaTimes,
  FaSave,
  FaEdit,
  FaTrash
} from 'react-icons/fa';
import CustomEditor from './components/Editor/CustomEditor';
import './DiaryList.css';
import './DiaryManagement.css';
import './DiaryMentions.css';
import { AuthContext } from './context/AuthContext'; // Use ./ to look inside the current 'src' directory for the 'context' folder
import apiClient from './api'; // Use ./ to look inside the current 'src' directory for 'api.js'


const DiaryMentions = () => {
  // ----------------------------------------------------------------
  // State: Mentions, Loading, Pagination, Search
  // ----------------------------------------------------------------
  const [mentions, setMentions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  // ----------------------------------------------------------------
  // State: Modals
  // ----------------------------------------------------------------
  // 1) modalOpen: Viewing a note and leaving a new comment
  // 2) manageCommentsModalOpen: Managing (editing/deleting) your own comments
  const [modalOpen, setModalOpen] = useState(false);
  const [modalNote, setModalNote] = useState(null);
  const [manageCommentsModalOpen, setManageCommentsModalOpen] = useState(false);
  const [manageCommentsNote, setManageCommentsNote] = useState(null);

  // ----------------------------------------------------------------
  // State: Editing Comments in the "Manage" Modal
  // ----------------------------------------------------------------
  const [selectedComment, setSelectedComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');

  // ----------------------------------------------------------------
  // References & Auth
  // ----------------------------------------------------------------
  const { token, logout } = useContext(AuthContext);
  const currentUserId = parseInt(localStorage.getItem('userId'), 10);
  const modalEditorRef = useRef(null);

  // ----------------------------------------------------------------
  // Fetch: Mentions
  // ----------------------------------------------------------------
  const fetchMentions = async () => {
    // setLoading(true); // Moved to useEffect
    setError(''); // Clear previous errors
    try {
      // Use apiClient.get, relative URL, auth handled by interceptor
      const response = await apiClient.get('/mentions/');
      setMentions(response.data); // Use response.data
    } catch (error) { // Updated catch block
      console.error('Error fetching mentions:', error.response ? error.response.data : error.message);
      setError('Failed to load mentions.'); // Set specific error message
      if (error.response?.status === 401) logout(); // Logout on auth error
    } finally {
      setLoading(false); // Ensure loading stops
    }
  };

  // ----------------------------------------------------------------
  // Fetch: Full Note (Including Comments)
  // ----------------------------------------------------------------
  const fetchFullNote = async (noteId) => {
    setError(''); // Clear errors when fetching details
    try {
      // Use apiClient.get, relative URL, auth handled by interceptor
      const response = await apiClient.get(`/notes/${noteId}/`);
      return response.data; // Return data directly on success
    } catch (error) { // Updated catch block
      console.error('Error fetching full note:', error.response ? error.response.data : error.message);
      setError(`Failed to load note details.`); // Set specific error message
      if (error.response?.status === 401) logout(); // Logout on auth error
      return null; // Keep returning null on error
    }
  };

  // ----------------------------------------------------------------
  // useEffect: Load Mentions on Mount
  // ----------------------------------------------------------------
  useEffect(() => {
    if (token) { // Use the token from AuthContext now
      setLoading(true); // Set loading before fetch
      fetchMentions();
    } else {
       setLoading(false); // Not loading if no token
       setMentions([]); // Clear mentions
       setError('Please log in to view mentions.'); // Set error message
    }
  // Add token and logout to dependency array
  }, [token, logout]); // Using logout from context in error handlers below requires it here

 // ----------------------------------------------------------------
 // Lock background scroll when either modal is open
 // ----------------------------------------------------------------
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (modalOpen || manageCommentsModalOpen) {
      html.style.overflowY = 'hidden';
      html.style.height     = '100%';
      body.style.overflowY = 'hidden';
      body.style.height     = '100%';
    } else {
      html.style.overflowY = '';
      html.style.height     = '';
      body.style.overflowY = '';
      body.style.height     = '';
    }

    return () => {
      html.style.overflowY = '';
      html.style.height     = '';
      body.style.overflowY = '';
      body.style.height     = '';
    };
  }, [modalOpen, manageCommentsModalOpen]);


  // ----------------------------------------------------------------
  // Helper Functions
  // ----------------------------------------------------------------
  const getPlainText = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const getTruncatedText = (html, wordCount) => {
    const text = getPlainText(html).trim();
    const words = text.split(/\s+/);
    if (words.length > wordCount) {
      return words.slice(0, wordCount).join(' ') + ' …';
    }
    return text;
  };

  const getHighlightedSnippet = (html, term, contextWords = 5) => {
    const text = getPlainText(html);
    const words = text.split(/\s+/);
    const lowerTerm = term.toLowerCase();
    let matchIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].toLowerCase().includes(lowerTerm)) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex === -1) return text;
    const start = Math.max(0, matchIndex - contextWords);
    const end = Math.min(words.length, matchIndex + contextWords + 1);
    let snippet = words.slice(start, end).join(' ');
    const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    snippet = snippet.replace(regex, '<span class="highlight">$1</span>');
    if (start > 0) snippet = '... ' + snippet;
    if (end < words.length) snippet = snippet + ' ...';
    return snippet;
  };

  // ----------------------------------------------------------------
  // Pagination
  // ----------------------------------------------------------------
  const itemsPerPage = 5;
  const totalPages = Math.ceil(mentions.length / itemsPerPage);
  const indexOfLastMention = currentPage * itemsPerPage;
  const indexOfFirstMention = indexOfLastMention - itemsPerPage;
  const currentMentions = mentions.slice(indexOfFirstMention, indexOfLastMention);

  const goToPage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => goToPage(i)}
          className={i === currentPage ? 'active' : ''}
        >
          {i}
        </button>
      );
    }
    return (
      <div className="pagination">
        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
          Previous
        </button>
        {pages}
        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
          Next
        </button>
      </div>
    );
  };

  // ----------------------------------------------------------------
  // Search Filter
  // ----------------------------------------------------------------
  const filteredMentions = searchTerm
    ? mentions.filter((m) =>
        getPlainText(m.note_text).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : mentions;

  // ----------------------------------------------------------------
  // Modal: View & Comment
  // ----------------------------------------------------------------
  const openViewModal = async (mention) => {
    const fullNote = await fetchFullNote(mention.note);
    if (fullNote) {
      setModalNote(fullNote);
      setModalOpen(true);
    } else {
      alert('Unable to load note details.');
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalNote(null);
  };

  // ----------------------------------------------------------------
  // Modal: Manage My Comments
  // ----------------------------------------------------------------
  const openManageCommentsModal = async (mention) => {
    const fullNote = await fetchFullNote(mention.note);
    if (fullNote) {
      setManageCommentsNote(fullNote);
      setManageCommentsModalOpen(true);
    } else {
      alert('Unable to load note details for managing comments.');
    }
  };

  const closeManageCommentsModal = () => {
    setManageCommentsModalOpen(false);
    setManageCommentsNote(null);
    setSelectedComment(null);
    setEditCommentText('');
  };

  // ----------------------------------------------------------------
  // Add New Comment
  // ----------------------------------------------------------------
  const handleCommentSubmit = async () => {
    if (!modalNote || !modalEditorRef.current) return; // Check refs/state
    const commentText = modalEditorRef.current.getContent();
    if (!commentText.trim()) {
      alert('Comment cannot be empty.');
      return;
    }
    setError(''); // Clear errors
    try {
      // Use apiClient.patch; Auth handled; Data is object; Use relative path
      // NOTE: Ensure PATCH to /notes/{id}/ is configured in backend to add comment if not owner
      await apiClient.patch(`/notes/${modalNote.id}/`, { text: commentText });
      // If await finishes without error, it was successful (2xx status)
      alert('Comment submitted successfully!');
      closeModal();
      fetchMentions(); // Refresh mentions list
    } catch (error) { // Updated catch block
      console.error('Error submitting comment:', error.response ? error.response.data : error.message);
      alert(error.response?.data?.detail || 'Failed to submit comment.');
      if (error.response?.status === 401) logout();
    }
  };
  // ----------------------------------------------------------------
  // Manage My Comments: Edit / Delete
  // ----------------------------------------------------------------
  const startEditComment = (comment) => {
    setSelectedComment(comment);
    setEditCommentText(comment.text);
  };

  const cancelEdit = () => {
    setSelectedComment(null);
    setEditCommentText('');
  };

  const handleCommentUpdate = async (commentId) => {
    if (!editCommentText.trim()) {
      alert('Comment text cannot be empty.');
      return;
    }
    setError(''); // Clear errors
    try {
      // Use apiClient.patch, relative URL, data object. Auth/JSON handled.
      await apiClient.patch(`/notes/comments/${commentId}/`, { text: editCommentText });
      // If await completes without error, it was successful
      alert('Comment updated successfully!');
      fetchMentions(); // Refresh list
      cancelEdit();
      closeManageCommentsModal();
    } catch (error) { // Updated catch block
      console.error('Error updating comment:', error.response ? error.response.data : error.message);
      alert(error.response?.data?.detail || 'Failed to update comment.');
      if (error.response?.status === 401) logout();
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    setError(''); // Clear errors
    try {
      // Use apiClient.delete, relative URL. Auth handled.
      await apiClient.delete(`/notes/comments/${commentId}/`);
      // If await completes without error, it succeeded (e.g., 204 No Content)
      alert('Comment deleted successfully!');
      fetchMentions(); // Refresh list
      closeManageCommentsModal();
    } catch (error) { // Updated catch block
      console.error('Error deleting comment:', error.response ? error.response.data : error.message);
      alert(error.response?.data?.detail || 'Failed to delete comment.');
      if (error.response?.status === 401) logout();
    }
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  if (loading) return <p>Loading mentions...</p>;
  if (error) return <p className="error" style={{color: 'red'}}>{error}</p>; 

  return (
    <div className="diary-list-container" style={{ padding: '20px' }}>
      <h2 className="diary-list-title">Your Mentions</h2>
      {/* Search Input */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search diary entries..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>
      {filteredMentions.length === 0 ? (
        <p>No diary entries found.</p>
      ) : (
        <>
          <div className="table-responsive">
            <table className="diary-table">
              <thead>
                <tr>
                <th>#</th>
                <th>Author</th>     {/* NEW */}
                <th>Text</th>
                <th>Created At</th>
                <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentMentions.map((mention, index) => {
                  // Decide how to display the text
                  let displayedText = '';
                  if (searchTerm) {
                    displayedText = getHighlightedSnippet(
                      mention.note_text,
                      searchTerm,
                      5
                    );
                  } else {
                    const plainText = getPlainText(mention.note_text);
                    const wordCount = plainText.trim().split(/\s+/).length;
                    displayedText =
                      wordCount > 4
                        ? getTruncatedText(mention.note_text, 4)
                        : mention.note_text;
                  }

                  return (
                    <tr key={mention.id}>
                      <td>{indexOfFirstMention + index + 1}</td>
                      <td>{mention.note_author}</td>  {/* NEW: show diary writer */}
                      <td>
                        <div
                          className="note-text"
                          dangerouslySetInnerHTML={{ __html: displayedText }}
                        />
                        {!searchTerm &&
                          getPlainText(mention.note_text).trim().split(/\s+/)
                            .length > 4 && (
                            <button
                              className="see-more-btn"
                              onClick={() => openViewModal(mention)}
                            >
                              See More <FaAngleDown />
                            </button>
                          )}
                      </td>
                      <td>{new Date(mention.created_at).toLocaleString()}</td>
                      <td>
                        {/* Icon-only button to view full note & add a comment */}
                        <div className="diary-action-buttons">
                          <button
                            className="diary-action-btn"
                            title="View Note & Add Comment"
                            onClick={() => openViewModal(mention)}
                          >
                            <FaComment />
                          </button>
                          {/* Always show Manage My Comments button */}
                          <button
                            className="diary-action-btn"
                            title="Manage My Comments"
                            onClick={() => openManageCommentsModal(mention)}
                          >
                            <FaCog />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {renderPagination()}
        </>
      )}

      {/* -------------------------------------------------------
         Modal for Viewing a Note and Leaving a New Comment
         ------------------------------------------------------- */}
      {modalOpen && modalNote && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ color: '#ffb606' }}>
                {modalNote.isCommentMode ? 'Add Comment' : 'View Note'}
              </h2>
              {/* Icon-only close button */}
              <button
                className="action-btn close-btn"
                onClick={closeModal}
                title="Close"
              >
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div dangerouslySetInnerHTML={{ __html: modalNote.text }} />
              <hr />
              <h3 style={{ color: '#ffb606' }}>Leave a Comment</h3>
              <CustomEditor
                ref={modalEditorRef}
                initialContent=""
                enablePrivacyToggle={false}
              />
              {modalNote.comments && modalNote.comments.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ color: '#ffb606' }}>Existing Comments</h3>
                  {modalNote.comments.map((comment) => (
                    <div key={comment.id} className="comment-item">
                      <p>
                        <strong>{comment.user_username}:</strong>
                      </p>
                      <div
                        dangerouslySetInnerHTML={{ __html: comment.text }}
                      />
                      <p className="comment-date">
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="action-submit-btn"
                onClick={handleCommentSubmit}
                title="Submit Comment"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------
         Modal for Managing My Comments (Editing/Deleting)
         ------------------------------------------------------- */}
      {manageCommentsModalOpen && manageCommentsNote && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ color: '#007bff' }}>Manage My Comments</h2>
              <button
                className="action-btn close-btn"
                onClick={closeManageCommentsModal}
                title="Close"
              >
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              {manageCommentsNote.my_comments && manageCommentsNote.my_comments.length > 0 ? (
                manageCommentsNote.my_comments.map((comment) => (
                  <div key={comment.id} className="comment-item">
                    <p>
                      <strong>{comment.user_username}:</strong>
                    </p>
                    {selectedComment && selectedComment.id === comment.id ? (
                      <>
                        <textarea
                          className="edit-textarea"
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                        />
                        <button
                          className="action-btn edit-btn"
                          onClick={() => handleCommentUpdate(comment.id)}
                          title="Save"
                        >
                          <FaSave />
                        </button>
                        <button
                          className="action-btn cancel-btn"
                          onClick={cancelEdit}
                          title="Cancel"
                        >
                          <FaTimes />
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          dangerouslySetInnerHTML={{ __html: comment.text }}
                        />
                        <p className="comment-date">
                          {new Date(comment.created_at).toLocaleString()}
                        </p>
                        <button
                          className="action-btn edit-btn"
                          onClick={() => startEditComment(comment)}
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="action-btn delete-btn"
                          onClick={() => handleCommentDelete(comment.id)}
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <p>You haven't made any comments yet on this note.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiaryMentions;
