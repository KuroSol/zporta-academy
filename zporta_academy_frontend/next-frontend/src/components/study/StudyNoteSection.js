import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { db } from '@/firebase/firebase';
import {
  ref,
  onValue,
  off,
  push,
  set,
  update,
  remove,
  serverTimestamp
} from 'firebase/database';
import {
  Save,
  Loader2,
  CheckCircle,
  ClipboardList,
  AlertTriangle,
  X
} from 'lucide-react';
import styles from '@/styles/StudyNoteSection.module.css';

// This component now uses your original, trusted logic with the new responsive UI.
export default function StudyNoteSection({ enrollmentId }) {
  const { user } = useContext(AuthContext);

  // --- State variables from your original, working file ---
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false); // Restored 'open' state variable
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  // 1) Subscribe to Firebase notes (Your original logic)
  useEffect(() => {
    if (!enrollmentId) return;
    setLoading(true);
    const pathRef = ref(db, `sessions/${enrollmentId}/notes`);
    const listener = onValue(pathRef, snap => {
      const raw = snap.val() || {};
      const arr = Object.entries(raw).map(([id, data]) => ({
        id,
        username: data.username,
        userId: data.userId, // Kept for future-proofing, but not used in 'mine' check
        content: data.content,
        timestamp: data.timestamp
      }));
      arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setNotes(arr);
      setLoading(false);
    });
    return () => off(pathRef, 'value', listener);
  }, [enrollmentId]);

  // 2) Add or update a note (Your original logic)
  const handleSave = useCallback(async () => {
    if (!user || !enrollmentId || !text.trim()) return;
    setSaving(true);
    setSaveStatus('idle');

    try {
      if (editingId) {
        // update existing
        const noteRef = ref(db, `sessions/${enrollmentId}/notes/${editingId}`);
        await update(noteRef, {
          content: text,
          timestamp: serverTimestamp()
        });
      } else {
        // push new
        const newRef = push(ref(db, `sessions/${enrollmentId}/notes`));
        await set(newRef, {
            username: user.username,
            // userId is intentionally not set here to match your original code
            content: text,
            timestamp: serverTimestamp()
        });
      }

      setText('');
      setEditingId(null);
      setSaveStatus('success');
    } catch (err) {
      console.error('Save failed', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [user, enrollmentId, text, editingId]);

  // 3) Delete a note (Your original logic)
  const handleDelete = useCallback(
    async noteId => {
      if (!enrollmentId) return;
      try {
        await remove(ref(db, `sessions/${enrollmentId}/notes/${noteId}`));
        if (editingId === noteId) {
          setEditingId(null);
          setText('');
        }
      } catch (err) {
        console.error('Delete failed', err);
      }
    },
    [enrollmentId, editingId]
  );

  // 4) Start editing (Your original logic)
  const startEdit = note => {
    setEditingId(note.id);
    setText(note.content);
  };
  
  const cancelEdit = () => {
    setEditingId(null);
    setText('');
  };

  return (
    <>
      {/* The main floating button to open/close the notes panel */}
      <button
        className={styles.notesToggleButton}
        onClick={() => setOpen(v => !v)}
        aria-label={open ? "Close Notes" : "Open Notes"}
      >
        {/* CORRECTED: Using your original icon choices */}
        {open ? <X size={24} /> : <ClipboardList size={24} />}
      </button>

      {/* The container for the overlay and the panel itself */}
      <div className={`${styles.notesContainer} ${open ? styles.open : ''}`}>
        <div className={styles.notesOverlay} onClick={() => setOpen(false)}></div>
        
        {/* The main panel that slides up */}
        <div className={styles.notesPanel}>
          <header className={styles.notesPanelHeader}>
            <h3 className={styles.notesPanelTitle}>Collaborative Notes</h3>
            <button
              className={styles.notesPanelCloseBtn}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </header>

          <div className={styles.notesPanelBody}>
            {loading ? (
              <div className={styles.notesLoader}>
                <Loader2 className={styles.notesSpinner} />
                <p>Loading Notes…</p>
              </div>
            ) : (
              <div className={styles.notesList}>
                {notes.length === 0 && <p className={styles.noNotesMessage}>No notes yet. Be the first to add one!</p>}
                {notes.map(n => {
                  // CORRECTED: Using your original logic to identify user's own notes
                  const mine = n.username === user.username;
                  return (
                    <div
                      key={n.id}
                      className={`${styles.noteItem} ${mine ? styles.myNote : ''}`}
                    >
                      <div className={styles.noteAuthor}>
                        <strong>{n.username}</strong>
                        {mine && (
                          <div className={styles.noteActions}>
                            <button onClick={() => startEdit(n)}>Edit</button>
                            <button onClick={() => handleDelete(n.id)}>Delete</button>
                          </div>
                        )}
                      </div>
                      <p className={styles.noteContent}>{n.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <footer className={styles.notesPanelFooter}>
            <textarea
              className={styles.notesTextarea}
              placeholder="Type a note…"
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={saving}
            />
            <div className={styles.footerActions}>
                <div className={styles.saveStatus}>
                 {editingId && <button className={styles.cancelButton} onClick={cancelEdit}>Cancel</button>}
                  {saveStatus === 'success' && <span className={styles.successMessage}><CheckCircle size={16} /> Saved!</span>}
                  {saveStatus === 'error' && <span className={styles.errorMessage}><AlertTriangle size={16} /> Error</span>}
                </div>
                <button
                  className={styles.saveButton}
                  onClick={handleSave}
                  disabled={saving || loading || !text.trim()}
                >
                  {saving ? <Loader2 className={styles.spinnerSmall} /> : <Save size={16} />}
                  <span>{editingId ? 'Update' : 'Add Note'}</span>
                </button>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
