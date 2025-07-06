// src/DiaryList.js
import React, { useEffect, useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaAngleDown, FaComment, FaEdit, FaTrash } from 'react-icons/fa';
import CustomEditor from './components/Editor/CustomEditor';
import apiClient from './api';
import { AuthContext } from './context/AuthContext';
import Modal from './components/Modal/Modal';        // ← NEW
import './DiaryList.css';
import './DiaryManagement.css';

const DiaryList = () => {
  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  const [notes, setNotes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalNote, setModalNote] = useState(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentNote, setCommentNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ----------------------------------------------------------------
  // Refs & Auth
  // ----------------------------------------------------------------
  const navigate = useNavigate();
  const modalEditorRef = useRef(null);
  const { token, logout } = useContext(AuthContext);
  const currentUserId = parseInt(localStorage.getItem('userId'), 10);

  // ----------------------------------------------------------------
  // Helpers to strip/html/truncate/highlight
  // ----------------------------------------------------------------
  const getPlainText = html => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };
  const getTruncatedPlainText = (html, count) => {
    const words = getPlainText(html).trim().split(/\s+/);
    return words.length > count
      ? words.slice(0, count).join(' ') + ' …'
      : getPlainText(html);
  };
  const getHighlightedSnippet = (html, term, contextWords = 5) => {
    const text = getPlainText(html);
    const words = text.split(/\s+/);
    const idx = words.findIndex(w => w.toLowerCase().includes(term.toLowerCase()));
    if (idx < 0) return text;
    const start = Math.max(0, idx - contextWords);
    const end = Math.min(words.length, idx + contextWords + 1);
    let snippet = words.slice(start, end).join(' ');
    const esc = term.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&');
    snippet = snippet.replace(new RegExp(`(${esc})`, 'gi'), '<span class="highlight">$1</span>');
    return (start>0?'... ':'') + snippet + (end<words.length?' ...':'');
  };

  // ----------------------------------------------------------------
  // Fetch notes
  // ----------------------------------------------------------------
  const fetchNotes = async () => {
    setError('');
    try {
      const res = await apiClient.get('/notes/');
      setNotes(res.data);
    } catch (e) {
      console.error(e);
      setError('Failed to load diary entries.');
      if (e.response?.status === 401) logout();
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (token) {
      setLoading(true);
      fetchNotes();
    } else {
      setNotes([]);
      setLoading(false);
    }
  }, [token]);

  // ----------------------------------------------------------------
  // Filtering & Pagination
  // ----------------------------------------------------------------
  const filtered = searchTerm
    ? notes.filter(n => getPlainText(n.text).toLowerCase().includes(searchTerm.toLowerCase()))
    : notes;
  const perPage = 5;
  const total = Math.ceil(filtered.length / perPage);
  const firstIdx = (currentPage - 1) * perPage;
  const currentNotes = filtered.slice(firstIdx, firstIdx + perPage);

  // ----------------------------------------------------------------
  // Modal open / close
  // ----------------------------------------------------------------
  const openModal = note => {
    setModalNote({
      ...note,
      isCommentMode: note.mentions?.includes(currentUserId)
    });
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalNote(null);
  };

  const openCommentModal = note => {
    setCommentNote(note);
    setCommentModalOpen(true);
  };
  const closeCommentModal = () => {
    setCommentModalOpen(false);
    setCommentNote(null);
  };

  // ----------------------------------------------------------------
  // Save & Delete handlers
  // ----------------------------------------------------------------
  const handleModalSave = async () => {
    if (!modalEditorRef.current || !modalNote) return alert('Editor not loaded');
    const text = modalEditorRef.current.getContent();
    try {
      const res = await apiClient.put(`/notes/${modalNote.id}/`, { text });
      setNotes(notes.map(n => n.id === res.data.id ? res.data : n));
      closeModal();
    } catch (e) {
      console.error(e);
      alert('Failed to save changes.');
    }
  };
  const handleDelete = async id => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await apiClient.delete(`/notes/${id}/`);
      setNotes(notes.filter(n => n.id !== id));
    } catch (e) {
      console.error(e);
      alert('Failed to delete.');
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error)   return <p className="error">{error}</p>;

  return (
    <div className="diary-list-container">
      <h2>Your Diary Entries</h2>
      <div className="search-container">
        <input
          type="text"
          placeholder="Search diary entries…"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
        />
      </div>

      {filtered.length === 0 ? (
        <p>No entries found.</p>
      ) : (
        <>
          <div className="table-responsive">
            <table className="diary-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Text</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentNotes.map((n, i) => {
                  const idx = firstIdx + i + 1;
                  const display = searchTerm
                    ? getHighlightedSnippet(n.text, searchTerm)
                    : (getPlainText(n.text).split(/\s+/).length > 4
                        ? getTruncatedPlainText(n.text, 4)
                        : n.text);
                  return (
                    <tr key={n.id}>
                      <td>{idx}</td>
                      <td>
                        <div
                          className="note-text"
                          dangerouslySetInnerHTML={{ __html: display }}
                        />
                        {!searchTerm && getPlainText(n.text).split(/\s+/).length > 4 && (
                          <button className="see-more-btn" onClick={() => openModal(n)}>
                            See More <FaAngleDown />
                          </button>
                        )}
                      </td>
                      <td>{new Date(n.created_at).toLocaleString()}</td>
                      <td>
                        <div className="diary-action-buttons">
                          <button onClick={() => openModal(n)}>
                            <FaEdit />
                          </button>
                          <button onClick={() => handleDelete(n.id)}>
                            <FaTrash />
                          </button>
                          <button onClick={() => openCommentModal(n)}>
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

          <div className="pagination">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >Previous</button>
            {[...Array(total)].map((_, i) => (
              <button
                key={i+1}
                onClick={() => setCurrentPage(i+1)}
                className={currentPage === i+1 ? 'active' : ''}
              >{i+1}</button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(total, p + 1))}
              disabled={currentPage === total}
            >Next</button>
          </div>
        </>
      )}

      {/** EDIT/COMMENT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalNote?.isCommentMode ? 'Add Comment' : 'Edit Entry'}
        size="medium"
      >
        <CustomEditor
          ref={modalEditorRef}
          initialContent={modalNote?.text || ''}
          enablePrivacyToggle={false}
        />
        <div className="modal-actions">
          <button onClick={handleModalSave}>
            {modalNote?.isCommentMode ? 'Submit Comment' : 'Save Changes'}
          </button>
          <button onClick={closeModal}>Close</button>
        </div>
      </Modal>

      {/** COMMENTS DISPLAY MODAL */}
      <Modal
        isOpen={commentModalOpen}
        onClose={closeCommentModal}
        title="Comments"
        size="medium"
      >
        {commentNote?.comments?.length
          ? commentNote.comments.map(c => (
              <div key={c.id} className="comment-item">
                <p><strong>{c.user_username}:</strong></p>
                <div dangerouslySetInnerHTML={{ __html: c.text }} />
                <p className="comment-date">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
            ))
          : <p>No comments yet.</p>
        }
        <div className="modal-actions">
          <button onClick={closeCommentModal}>Close</button>
        </div>
      </Modal>
    </div>
  );
};

export default DiaryList;
