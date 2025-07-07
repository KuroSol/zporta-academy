import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { db } from '../firebase';
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
import styles from './StudyNoteSection.module.css';
import apiClient from '../api';

export default function StudyNoteSection({ enrollmentId }) {
  const { user } = useContext(AuthContext);

  const [notes, setNotes] = useState([]);         // [{ id, username, userId, content, timestamp }]
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'success' | 'error'

  // 1) Subscribe to Firebase notes
  useEffect(() => {
    if (!enrollmentId) return;
    const pathRef = ref(db, `sessions/${enrollmentId}/notes`);
    const listener = onValue(pathRef, snap => {
      const raw = snap.val() || {};
      const arr = Object.entries(raw).map(([id, data]) => ({
        id,
        username: data.username,
        userId: data.userId,
        content: data.content,
        timestamp: data.timestamp
      }));
      arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setNotes(arr);
      setLoading(false);
    });
    return () => off(pathRef, 'value', listener);
  }, [enrollmentId]);

  // 2) Add or update a note
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
        // await apiClient.patch(`/enrollments/${enrollmentId}/notes/${editingId}/`, { note: text });
      } else {
        // push new (one level deep)
        const newRef = push(ref(db, `sessions/${enrollmentId}/notes`));
        await set(newRef, {
            username: user.username,
            //userId: user.id,
            content: text,
            timestamp: serverTimestamp()
        });
        // await apiClient.post(`/enrollments/${enrollmentId}/notes/`, { note: text });
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

  // 3) Delete a note
  const handleDelete = useCallback(
    async noteId => {
      if (!enrollmentId) return;
      try {
        await remove(ref(db, `sessions/${enrollmentId}/notes/${noteId}`));
        // await apiClient.delete(`/enrollments/${enrollmentId}/notes/${noteId}/`);
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

  // 4) Start editing
  const startEdit = note => {
    setEditingId(note.id);
    setText(note.content);
  };

  return (
    <div className={`${styles.container} ${open ? styles.containerOpen : ''}`}>
      <button
        className={styles.toggleButton}
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle Notes"
      >
        {open ? <X size={20} /> : <ClipboardList size={20} />}
      </button>

      {open && (
        <div className={styles.contentWrapper}>
          <header className={styles.header}>
            <h3>Collaborative Notes</h3>
          </header>

          <div className={styles.body}>
            {loading ? (
              <div className={styles.loader}>
                <Loader2 className={styles.spinner} />
                <p>Loading Notes…</p>
              </div>
            ) : (
              <div className={styles.notesList}>
                {notes.map(n => {
                  const mine = n.username === user.username;
                  return (
                    <div
                      key={n.id}
                      className={mine ? styles.myNote : styles.noteItem}
                    >
                      <div className={styles.noteAuthor}>
                        <strong>{n.username}</strong>
                        {mine && (
                          <span className={styles.actions}>
                            <button onClick={() => startEdit(n)}>Edit</button>
                            <button onClick={() => handleDelete(n.id)}>
                              Delete
                            </button>
                          </span>
                        )}
                      </div>
                      <p className={styles.noteContent}>{n.content}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <textarea
              className={styles.textarea}
              placeholder="Type a note…"
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={saving}
            />
          </div>

          <footer className={styles.footer}>
            <div className={styles.saveStatus}>
              {saveStatus === 'success' && (
                <span className={styles.successMessage}>
                  <CheckCircle size={16} />
                  Saved!
                </span>
              )}
              {saveStatus === 'error' && (
                <span className={styles.errorMessage}>
                  <AlertTriangle size={16} />
                  Error
                </span>
              )}
            </div>
            <button
              className={styles.saveButton}
              onClick={handleSave}
              disabled={saving || loading || !text.trim()}
            >
              {saving ? (
                <Loader2 className={styles.spinnerSmall} />
              ) : (
                <Save size={16} />
              )}
              <span>{editingId ? 'Update Note' : 'Add Note'}</span>
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
