import React, { useEffect, useState, useRef, useContext } from 'react'; // Added useContext
import { useNavigate } from 'react-router-dom'; // Keep useNavigate
import {
  FaAngleDown,
  FaComment,
  FaCog,
  FaTimes,
  FaSave,
  FaEdit,
  FaTrash
} from 'react-icons/fa';
import CustomEditor from './components/Editor/CustomEditor'; // Assuming path is correct
import apiClient from './api'; // <-- ADD apiClient import (Adjust path: ../ or ./ etc.)
import { AuthContext } from './context/AuthContext'; // <-- ADD AuthContext import (Adjust path)
import './DiaryList.css';
import './DiaryManagement.css';

const DiaryList = () => {
  // State... keep all original state variables
  const [notes, setNotes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalNote, setModalNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [commentModalOpen, setCommentModalOpen] = useState(false); // Keep, though modal JSX isn't shown
  const [commentNote, setCommentNote] = useState(null); // Keep
  const [loading, setLoading] = useState(true); // <-- ADD loading state if missing before
  const [error, setError] = useState(''); // <-- ADD error state

  // Refs & Auth
  const navigate = useNavigate();
  const modalEditorRef = useRef(null);
  const { token, logout } = useContext(AuthContext); // <-- Use Context, get token and logout
  const currentUserId = parseInt(localStorage.getItem('userId')); // Keep

  // Helper: strip HTML tags.
  const getPlainText = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  // Helper: return only first N words.
  const getTruncatedPlainText = (html, wordCount) => {
    const text = getPlainText(html).trim();
    const words = text.split(/\s+/);
    if (words.length > wordCount) {
      return words.slice(0, wordCount).join(" ") + " …";
    }
    return text;
  };

  // Helper: highlight term snippet.
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
    let snippet = words.slice(start, end).join(" ");
    const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    snippet = snippet.replace(regex, '<span class="highlight">$1</span>');
    if (start > 0) snippet = '... ' + snippet;
    if (end < words.length) snippet = snippet + ' ...';
    return snippet;
  };

  // Fetch notes from the API.
  const fetchNotes = async () => {
    // setLoading(true); // Moved setLoading to useEffect
    setError(''); // Clear previous errors
    try {
      // Use apiClient.get, relative URL, auth handled by interceptor
      const response = await apiClient.get('/notes/');
      setNotes(response.data); // Use response.data
    } catch (error) {
      console.error('Error fetching notes:', error.response ? error.response.data : error.message);
      setError('Failed to load diary entries.'); // Set error state
      if (error.response?.status === 401) logout(); // Logout on auth error
    } finally {
      setLoading(false); // Ensure loading is set to false after fetch attempt
    }
  };

  useEffect(() => {
    if (token) { // Check if token exists from context
        setLoading(true); // Set loading before fetch
        fetchNotes();
    } else {
        // Handle case where there's no token (e.g., user logged out)
        setNotes([]); // Clear notes
        setLoading(false);
        // Optionally: navigate('/login'); or setError('Please log in');
    }
  }, [token]); // Depend on token from context

  // Filter notes by search term.
  const filteredNotes = searchTerm
    ? notes.filter(note =>
        getPlainText(note.text).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : notes;

  // Open modal for editing or commenting.
  const openModal = (note) => {
    if (currentUserId === note.user) {
      setModalNote({ ...note, isCommentMode: false });
    } else if (note.mentions && note.mentions.includes(currentUserId)) {
      setModalNote({ ...note, isCommentMode: true });
    } else {
      setModalNote(note);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalNote(null);
  };

  // Comment modal helpers.
  const openCommentModal = (note) => {
    setCommentNote(note);
    setCommentModalOpen(true);
  };

  const closeCommentModal = () => {
    setCommentModalOpen(false);
    setCommentNote(null);
  };

  // Save (update) handler: for owners editing a note or mentioned users adding a comment.
  const handleModalSave = async () => {
    if (!modalEditorRef.current || !modalNote) { // Added check for modalNote
      alert('Editor or note data not loaded.');
      return;
    }
    const updatedText = modalEditorRef.current.getContent();
    setError(''); // Clear errors

    try {
      // Use apiClient.put, relative URL, data object. Auth/JSON headers handled.
      const response = await apiClient.put(`/notes/${modalNote.id}/`, { text: updatedText });
      const updatedNote = response.data; // Use response.data
      // Update the notes list in state
      setNotes(notes.map(note => note.id === updatedNote.id ? updatedNote : note));
      closeModal(); // Close modal on success
    } catch (error) {
      console.error("Error updating note:", error.response ? error.response.data : error.message);
      const errorMsg = error.response?.data?.detail || JSON.stringify(error.response?.data) || "Failed to update note.";
      setError(errorMsg); // Set error state
      alert("An error occurred while updating the note: " + errorMsg);
      if (error.response?.status === 401) logout();
    }
  };

  // Delete note handler.
  const handleDelete = async (noteId) => {
    if (window.confirm("Are you sure you want to delete this note?")) {
       setError(''); // Clear errors
      try {
        // Use apiClient.delete, relative URL. Auth handled.
        await apiClient.delete(`/notes/${noteId}/`);
        // If await finishes without error, it succeeded (e.g., 204 No Content)
        setNotes(notes.filter(note => note.id !== noteId)); // Update state
      } catch (error) {
        console.error("Error deleting note:", error.response ? error.response.data : error.message);
        const errorMsg = error.response?.data?.detail || "Failed to delete note.";
        setError(errorMsg); // Set error state
        alert("An error occurred while deleting the note: " + errorMsg);
        if (error.response?.status === 401) logout();
      }
    }
  };

  // Pagination logic.
  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredNotes.length / itemsPerPage);
  const indexOfLastNote = currentPage * itemsPerPage;
  const indexOfFirstNote = indexOfLastNote - itemsPerPage;
  const currentNotes = filteredNotes.slice(indexOfFirstNote, indexOfLastNote);

  const goToPage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <button key={i} onClick={() => goToPage(i)} className={i === currentPage ? 'active' : ''}>
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

  return (
    <div className="diary-list-container">
      <h2 className="diary-list-title">Your Diary Entries</h2>
      {error && <p className="error" style={{color: 'red'}}>{error}</p>}
      {/* Search Input */}
      <div className="search-container">
        <input 
          type="text"
          placeholder="Search diary entries..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
        />
      </div>

      {filteredNotes.length === 0 ? (
        <p>No diary entries found.</p>
      ) : (
        <>
          <div className="table-responsive">
            <table className="diary-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Text</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentNotes.map((note, index) => {
                  let displayedText = '';
                  if (searchTerm) {
                    displayedText = getHighlightedSnippet(note.text, searchTerm, 5);
                  } else {
                    const plainText = getPlainText(note.text);
                    const wordCount = plainText.trim().split(/\s+/).length;
                    displayedText = wordCount > 4 ? getTruncatedPlainText(note.text, 4) : note.text;
                  }
                  return (
                    <tr key={note.id}>
                      <td>{indexOfFirstNote + index + 1}</td>
                      <td>
                        <div className="note-text" dangerouslySetInnerHTML={{ __html: displayedText }} />
                        {(!searchTerm && getPlainText(note.text).trim().split(/\s+/).length > 4) && (
                          <button className="see-more-btn" onClick={() => openModal(note)}>
                            See More <FaAngleDown />
                          </button>
                        )}
                      </td>
                      <td>{new Date(note.created_at).toLocaleString()}</td>
                      <td>
                        <div className="diary-action-buttons">
                            <button className="diary-edit-btn" onClick={() => openModal(note)}>
                              <FaEdit />
                            </button>
                            <button className="diary-delete-btn" onClick={() => handleDelete(note.id)}>
                              <FaTrash />
                            </button>
                            {/* Comment icon button: opens the comment modal */}
                            <button className="diary-comment-btn" onClick={() => openCommentModal(note)}>
                              <FaComment />
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

      {/* Modal for editing or adding a note/comment */}
      {modalOpen && modalNote && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{modalNote.isCommentMode ? "Add Comment" : "Edit Diary Entry"}</h2>
            <div className="modal-body">
              <CustomEditor
                ref={modalEditorRef}
                initialContent={modalNote.text}
                enablePrivacyToggle={false}
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleModalSave}>
                {modalNote.isCommentMode ? "Submit Comment" : "Save Changes"}
              </button>
              <button onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for displaying existing comments */}
      {commentModalOpen && commentNote && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Comments for Your Note</h2>
            <div className="modal-body">
              {commentNote.comments && commentNote.comments.length > 0 ? (
                commentNote.comments.map(comment => (
                  <div key={comment.id} className="comment-item">
                    <p><strong>{comment.user_username}:</strong></p>
                    {/* Render comment.text as HTML */}
                    <div dangerouslySetInnerHTML={{ __html: comment.text }} />
                    <p className="comment-date">{new Date(comment.created_at).toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <p>No comments yet.</p>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={closeCommentModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiaryList;
