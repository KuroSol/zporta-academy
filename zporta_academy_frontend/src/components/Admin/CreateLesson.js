import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomEditor from '../Editor/CustomEditor'; // Assuming path is correct
import apiClient from '../../api'; // <-- apiClient import (Adjust path)
import { AuthContext } from '../../context/AuthContext'; // <-- AuthContext import (Adjust path)

import Modal from '../Modal/Modal';
import styles from './CreateLesson.module.css'
import CreateQuiz from './CreateQuiz';

const CreateLesson = ({ onSuccess, onClose, isModalMode = false }) => {
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState(''); // Holds the selected subject ID
    // REMOVED: const [newSubject, setNewSubject] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [tags, setTags] = useState('');
    const [subjects, setSubjects] = useState([]); // State for fetched subjects
    const [quizzes, setQuizzes]               = useState([]);
    const [selectedQuizzes, setSelectedQuizzes] = useState([]);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false); // To track save operation
    const [messageType, setMessageType] = useState('error'); // To style messages
    const navigate = useNavigate();
    const editorRef = useRef(null); // Ref for CustomEditor
    const { logout } = useContext(AuthContext); // Get logout from context

    // Fetch subjects when the component mounts
    useEffect(() => {
        const fetchSubjects = async () => {
            setMessage('');
            try {
                const response = await apiClient.get('/subjects/');
                if (Array.isArray(response.data)) {
                   setSubjects(response.data);
                } else {
                   console.error("Invalid data format for subjects:", response.data);
                   setMessage('Received invalid subject data.');
                   setSubjects([]);
                }
            } catch (error) {
                console.error("Error fetching subjects:", error.response ? error.response.data : error.message);
                setMessage('Failed to load subjects.');
                if (error.response?.status === 401 || error.response?.status === 403) {
                    logout();
                }
            }
        };
        if (localStorage.getItem('token')) {
            fetchSubjects();
            apiClient.get('/quizzes/my/')
                .then(res => setQuizzes(Array.isArray(res.data) ? res.data : []))
                .catch(err => console.error('Failed to load quizzes', err));
        } else {
             setMessage("Please log in to load subjects.");
        }
    }, [logout]);

    // Content state and handler (Keep original)
    const [content, setContent] = useState('');
    const handleSaveContent = (editorContent) => {
        setContent(editorContent);
    };

    // Simplified subject change handler
    const handleSubjectChange = (e) => {
        setSubject(e.target.value);
    };

    const handleQuizToggle = (quizId) => {
        setSelectedQuizzes(prev =>
          prev.includes(quizId)
            ? prev.filter(id => id !== quizId)
            : [...prev, quizId]
        );
      };
    
    const handleQuizCreated = (newQuiz) => {
        setIsQuizModalOpen(false);
        setQuizzes(prev => [newQuiz, ...prev]);
        setSelectedQuizzes(prev => [...prev, newQuiz.id]);
      };
    

    // External save handler (Keep original)
    const handleExternalSave = () => {
        console.log("--- handleExternalSave triggered ---"); // Log: Button clicked
        console.log("Editor Ref:", editorRef.current); // Log: Check if ref exists

        if (!editorRef.current) {
            setMessage('Editor not loaded.');
            console.log("Error: Editor ref not found."); // Log: Error if no ref
            return;
        }

        let editorContent = null;
        try {
             // Make sure 'getContent' is the correct method name for your CustomEditor
            editorContent = editorRef.current.getContent();
            console.log("Content from ref:", editorContent); // Log: See the retrieved content
        } catch (e) {
             console.error("Error calling editorRef.current.getContent():", e);
             setMessage("Error retrieving content from editor.");
             return;
        }


        // Check if content is empty AFTER trying to get it
        if (!editorContent || !editorContent.trim()) {
            setMessage('Editor content is empty. Please write something.'); // More specific message
            console.log("Validation Failed: Content is empty or whitespace."); // Log: Validation failure reason
            return;
        }

        console.log("Validation Passed. Calling handleSave..."); // Log: If validation passes
        handleSave(editorContent); // Pass the content retrieved from the ref
    };

    // Save function (Refactored API call, simplified subject logic)
    const handleSave = async (editorContent) => {
        setMessage('');
        setSubmitting(true); // Indicate saving has started
        if (!localStorage.getItem('token')) { setMessage('You must be logged in.'); navigate('/login'); return; }
        if (!title.trim()) { setMessage('Title is required.'); return; }
        if (!subject) { setMessage('Please select a subject.'); return; } // Ensure subject ID is selected
        if (!editorContent || !editorContent.trim()) { setMessage('Editor content cannot be empty.'); return; }

        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];

        // Use selected subject ID directly
        const payload = {
            title,
            content: editorContent,
            video_url: videoUrl,
            subject: subject || null, // Send selected ID
            tags: tagsArray,
        };

        try {
            const response = await apiClient.post('/lessons/', payload);
            // *** START REPLACEMENT ***
            const newLessonData = response.data; // Get the created lesson data
            // Attach any selected quizzes
            const lessonPermalink = newLessonData.permalink;
            if (selectedQuizzes.length) {
            await Promise.allSettled(
                selectedQuizzes.map(id =>
                apiClient.post(`/lessons/${lessonPermalink}/add-quiz/`, { quiz_id: id })
                )
            );
            }
            if (isModalMode && onSuccess) {
                // --- Modal Mode ---
                // We are in a modal - call the callback from CreateCourse
                setMessage('Lesson saved!'); // Optional: Show temporary success in modal
                setMessageType('success');
                onSuccess(newLessonData); // Pass data back to parent (which handles closing)
            } else {
                // --- Standalone Mode ---
                // Keep the original behavior for the standalone page
                setMessage('Lesson created successfully!');
                setMessageType('success'); // Set message type for styling
                console.log('Lesson created:', newLessonData);
                // Keep your original navigation for standalone mode
                navigate('/admin/lessons'); // Or navigate to the new lesson detail page, etc.
            }
            // *** END REPLACEMENT ***
        } catch (error) {
            console.error('Error creating lesson:', error.response ? error.response.data : error.message);
            let errorMsg = 'Failed to create lesson.';
            if (error.response && error.response.data) {
                if (typeof error.response.data === 'object') {
                    errorMsg = Object.entries(error.response.data).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`).join(' | ');
                } else { errorMsg = error.response.data.error || error.response.data.detail || errorMsg; }
            } else if (error.request) { errorMsg = 'Network error.'; }
            else { errorMsg = 'An unexpected error occurred.'; }
            setMessageType('error'); // Ensure message type is set correctly on error
            setMessage(errorMsg);
            if (error.response?.status === 401 || error.response?.status === 403) logout();
        } // closing brace of catch
        finally { // Add this finally block
            setSubmitting(false); // Indicate saving has finished
        }
    };

    // --- JSX (Simplified Subject Section) ---
    return (
        <div className={styles.createLessonContainer}>
            <h2>Create New Lesson</h2>
            {/* Updated Message Display */}
            {message && (
                <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
                    {message}
                </p>
            )}
            <form className={styles.lessonForm} onSubmit={(e) => e.preventDefault()}>
                <div className="form-group">
                <label htmlFor="lessonTitle">Title: <span className={styles.required}>*</span></label>
                <input id="lessonTitle" className={styles.inputField} type="text" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={submitting} />
                </div>

                <div className="form-group">
                <label htmlFor="lessonSubject">Subject: <span className={styles.required}>*</span></label>
                    {/* Simplified Select - No "Create New" option */}
                    <select id="lessonSubject" className={styles.selectField} value={subject} onChange={handleSubjectChange} required disabled={submitting}>
                        <option value="">Select a Subject</option>
                        {subjects.map((subj) => (
                            <option key={subj.id} value={subj.id}>{subj.name}</option>
                        ))}
                    </select>
                </div>

                {/* REMOVED conditional input for new subject name */}

                <div className="form-group">
                <label htmlFor="lessonVideoUrl">Video URL:</label>
                <input id="lessonVideoUrl" className={styles.inputField} type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Optional video URL" disabled={submitting} />
                </div>

                <div className="form-group">
                <label htmlFor="lessonTags">Tags (comma separated):</label>
                <input id="lessonTags" className={styles.inputField} type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. javascript, react" disabled={submitting} />
                </div>

                {/* ===== Attach Quizzes Section ===== */}
                <fieldset className={styles.formSection}>
                    <legend>Attach Quiz (Optional)</legend>

                    {/* Header containing Title and Create Button */}
                    <div className={styles.contentSectionHeader}>
                        <h3>Available Quizzes</h3>
                        <button
                            type="button"
                            onClick={() => setIsQuizModalOpen(true)} // Opens the CreateQuiz modal
                            className={styles.createContentBtn}    // Style for the button itself
                            disabled={submitting}                   // Disable if lesson form is saving
                        >
                            + Create New Quiz
                        </button>
                    </div>

                    {/* List Area: Scrollable box or 'No items' message */}
                    <div className={styles.contentListArea}>
                        {quizzes.length > 0 ? (
                            <div className={styles.scrollableBox}> {/* Scrollable container for list */}
                                {quizzes.map(q => (
                                    <div key={q.id} className={styles.contentItem}> {/* Individual list item */}
                                        <input
                                            type="checkbox"
                                            id={`lesson-quiz-${q.id}`} // Unique ID for this checkbox
                                            checked={selectedQuizzes.includes(q.id)} // Check if selected
                                            onChange={() => handleQuizToggle(q.id)} // Handle selection change
                                            disabled={submitting || !!q.lesson || !!q.course} // Disable if saving or quiz already in use
                                        />
                                        <label htmlFor={`lesson-quiz-${q.id}`}>
                                            {q.title}
                                            {/* Show if quiz is already part of a lesson or course */}
                                            {(q.lesson || q.course) ? <span className={styles.alreadyAttached}> (In use)</span> : ''}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            // Message shown only if the quizzes array is empty
                            <p className={styles.noContentMessage}>No quizzes created yet.</p>
                        )}
                    </div>
                </fieldset>
                {/* ===== End Attach Quizzes ===== */}


                <div className={styles.editorContainer}>
                    <label>Content:</label>
                    <CustomEditor ref={editorRef} onSave={handleSaveContent} mediaCategory="lesson"/>
                </div>

                {/* Action Buttons: Save and Cancel (for modal) */}
                <div className={styles.modalActions}>
                    {/* Only show Cancel button when in modal mode */}
                    {isModalMode && (
                        <button
                            type="button"
                            onClick={onClose} // Call the onClose prop passed from CreateCourse
                            className={`${styles.btn} ${styles.btnSecondary}`} // Use button styles
                            disabled={submitting} // Disable if submitting
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleExternalSave} // Still triggers the external save
                        className={`${styles.btn} ${styles.btnPrimary}`} // Use button styles
                        disabled={submitting} // Disable buttons while submitting
                    >
                        {submitting ? 'Saving...' : 'Save Lesson'}
                    </button>
                </div>
            </form>
            {/* Quiz creation modal */}
            <Modal
              isOpen={isQuizModalOpen}
              onClose={() => setIsQuizModalOpen(false)}
            >
              <CreateQuiz
                onSuccess={handleQuizCreated}
                onClose={() => setIsQuizModalOpen(false)}
                isModalMode={true}
              />
            </Modal>
        </div>
    );
};

export default CreateLesson;