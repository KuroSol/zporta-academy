// CreateLesson.js
// Based on your uploaded file, updated to consistently use CSS modules.
// Video URL input type changed to "text" to make it more leniently optional on the client-side.

import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomEditor from '../Editor/CustomEditor'; // Assuming path is correct
import apiClient from '../../api'; // <-- apiClient import (Adjust path)
import { AuthContext } from '../../context/AuthContext'; // <-- AuthContext import (Adjust path)

import Modal from '../Modal/Modal'; // For quiz creation modal
import CreateQuiz from './CreateQuiz';   // Assumes CreateQuiz.js is in the same folder
import styles from './CreateLesson.module.css'; // <-- Using dedicated CSS module

const CreateLesson = ({ onSuccess, onClose, isModalMode = false, initialSubjectId = null }) => {
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState(initialSubjectId || ''); // Holds the selected subject ID
    const [videoUrl, setVideoUrl] = useState('');
    const [tags, setTags] = useState('');
    const [subjects, setSubjects] = useState([]); // State for fetched subjects
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuizzes, setSelectedQuizzes] = useState([]);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false); // To track save operation
    const [messageType, setMessageType] = useState('error'); // To style messages: 'error', 'success', 'warning'
    const [loading, setLoading] = useState(true); // For initial data load for subjects/quizzes

    const navigate = useNavigate();
    const editorRef = useRef(null); // Ref for CustomEditor
    const { logout } = useContext(AuthContext); // Get logout from context

    // Fetch initial data (subjects and quizzes)
    const fetchData = useCallback(async () => {
        setLoading(true);
        setMessage('');
        try {
            // Parallel fetch for subjects and quizzes
            const [subjectsRes, quizzesRes] = await Promise.all([
                apiClient.get('/subjects/'),
                apiClient.get('/quizzes/my/') // Assuming this fetches quizzes available to the user
            ]);

            if (Array.isArray(subjectsRes.data)) {
                setSubjects(subjectsRes.data);
                // If an initialSubjectId is provided and exists in the fetched subjects, set it
                if (initialSubjectId && subjectsRes.data.find(s => String(s.id) === String(initialSubjectId))) {
                    setSubject(String(initialSubjectId));
                } else if (subjectsRes.data.length > 0 && !initialSubjectId) {
                    // Optionally, select the first subject if none is provided, or leave blank
                    // setSubject(String(subjectsRes.data[0].id)); 
                }
            } else {
                console.error("Invalid data format for subjects:", subjectsRes.data);
                setMessage('Received invalid subject data.');
                setSubjects([]);
            }

            if (Array.isArray(quizzesRes.data)) {
                setQuizzes(quizzesRes.data);
            } else {
                console.error("Invalid data format for quizzes:", quizzesRes.data);
                setQuizzes([]);
            }

        } catch (error) {
            console.error("Error fetching initial data for lesson:", error.response ? error.response.data : error.message);
            setMessage('Failed to load necessary data (subjects/quizzes). Please try again.');
            setMessageType('error');
            if (error.response?.status === 401 || error.response?.status === 403) {
                logout(); // Logout if unauthorized
                if (!isModalMode) navigate('/login'); // Redirect if not in modal
            }
        } finally {
            setLoading(false);
        }
    }, [logout, initialSubjectId, isModalMode, navigate]); // Added dependencies

    useEffect(() => {
        if (localStorage.getItem('token')) {
            fetchData();
        } else {
            setMessage("Please log in to create a lesson.");
            setMessageType('error');
            setLoading(false);
            if (!isModalMode) {
                navigate('/login');
            }
        }
    }, [fetchData, isModalMode, navigate]); // fetchData is now a dependency

    // Refresh just the quizzes list (e.g., after creating a new one)
    const refreshQuizzes = useCallback(async () => {
        try {
            const quizzesRes = await apiClient.get('/quizzes/my/');
            setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);
        } catch (error) {
            console.error("Error refreshing quizzes:", error.response?.data || error.message);
            setMessage('Failed to refresh quiz list.');
            setMessageType('warning');
        }
    }, []);


    // Handler for editor content (if needed, though direct ref access is primary)
    const handleEditorChange = (editorContent) => {
        // This function can be used if CustomEditor has an onChange prop
        // For now, we rely on editorRef.current.getContent() at submission
    };

    const handleSubjectChange = (e) => {
        setSubject(e.target.value);
    };

    const handleQuizToggle = (quizId) => {
        setSelectedQuizzes(prev =>
            prev.includes(quizId)
                ? prev.filter(id => id !== quizId)
                : [...new Set([...prev, quizId])] // Ensure unique IDs
        );
    };
    
    const handleQuizCreated = (newQuiz) => {
        setIsQuizModalOpen(false);
        refreshQuizzes(); // Refresh the list to include the new quiz
        if (newQuiz?.id) {
            // Auto-select the newly created quiz
            setSelectedQuizzes(prev => [...new Set([...prev, newQuiz.id])]);
        }
        setMessage(`Quiz "${newQuiz?.title || 'New Quiz'}" created successfully and is selected!`);
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000); // Clear message after a delay
    };
    
    // Main save handler for the lesson
    const handleSaveLesson = async () => {
        setMessage(''); // Clear previous messages
        setMessageType('error'); // Default to error

        if (!editorRef.current) {
            setMessage('Editor is not available. Please wait or refresh.');
            return;
        }
        const editorContent = editorRef.current.getContent();

        // Validations
        if (!localStorage.getItem('token')) { 
            setMessage('Authentication error. Please log in again.'); 
            if (!isModalMode) navigate('/login'); 
            return; 
        }
        if (!title.trim()) { setMessage('Lesson Title is required.'); return; }
        if (!subject) { setMessage('Please select a Subject for the lesson.'); return; }
        if (!editorContent || !editorContent.trim()) { setMessage('Lesson Content cannot be empty.'); return; }

        setSubmitting(true); // Indicate saving has started

        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];

      // Build payload without video_url by default
       const payload = {
           title: title.trim(),
           content: editorContent,
           subject: subject,
           tags: tagsArray,
       };
       // Only include video_url if user actually typed one
       if (videoUrl.trim()) {
           payload.video_url = videoUrl.trim();
       }

        try {
            const response = await apiClient.post('/lessons/', payload);
            const newLessonData = response.data;
            const lessonPermalink = newLessonData.permalink; // Assuming permalink is returned

            let overallMessage = `Lesson "${newLessonData.title}" saved successfully!`;
            let overallMessageType = 'success';

            // Attach selected quizzes if any
            if (selectedQuizzes.length > 0 && lessonPermalink) {
                setMessage('Lesson saved. Attaching selected quizzes...'); // Intermediate message
                const quizAttachmentPromises = selectedQuizzes.map(quizId =>
                    apiClient.post(`/lessons/${lessonPermalink}/add-quiz/`, { quiz_id: quizId })
                        .catch(err => ({ // Catch individual errors to not fail all
                            type: 'QuizAttachment', 
                            id: quizId, 
                            error: err.response?.data?.detail || err.message || 'Unknown error'
                        }))
                );
                
                const results = await Promise.allSettled(quizAttachmentPromises);
                const failedAttachments = results.filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error));

                if (failedAttachments.length > 0) {
                    const failedQuizTitles = failedAttachments.map(f => quizzes.find(q => q.id === f.reason?.id)?.title || f.reason?.id || 'Unknown Quiz').join(', ');
                    overallMessage = `Lesson "${newLessonData.title}" saved, but failed to attach quiz(zes): ${failedQuizTitles}. You may need to edit the lesson to try again.`;
                    overallMessageType = 'warning';
                    console.error('Failed quiz attachments:', failedAttachments);
                } else {
                    overallMessage = `Lesson "${newLessonData.title}" and all selected quizzes attached successfully!`;
                }
            }
            
            setMessage(overallMessage);
            setMessageType(overallMessageType);
            
            if (isModalMode && onSuccess) {
                onSuccess(newLessonData); // Pass the new lesson data to the parent (CreateCourse)
            } else {
                // Standalone mode: navigate after a short delay
                setTimeout(() => {
                    navigate('/admin/lessons'); // Or to the new lesson's page: `/lessons/${lessonPermalink}`
                }, overallMessageType === 'success' ? 2000 : 4000);
            }
        } catch (error) {
            console.error('Error creating lesson:', error.response ? error.response.data : error.message);
            let errorMsg = 'Failed to create lesson.';
            if (error.response?.data) {
                if (typeof error.response.data === 'object' && error.response.data !== null) {
                    // Attempt to parse DRF error object
                    errorMsg = Object.entries(error.response.data)
                                     .map(([field, messages]) => `${field.replace("_", " ")}: ${Array.isArray(messages) ? messages.join(' ') : String(messages)}`)
                                     .join(' | ');
                } else if (typeof error.response.data === 'string' && error.response.data.length < 200) {
                     errorMsg = error.response.data; // Use short string errors directly
                } else if (error.response.data?.error) { // Check for common error keys
                    errorMsg = error.response.data.error;
                } else if (error.response.data?.detail) {
                    errorMsg = error.response.data.detail;
                }
            } else if (error.message) { // Fallback to generic error message
                 errorMsg = error.message;
            }
            setMessage(errorMsg);
            setMessageType('error');
            if (error.response?.status === 401 || error.response?.status === 403) {
                logout();
                if(!isModalMode) navigate('/login');
            }
        } finally {
            setSubmitting(false); // Indicate saving has finished
        }
    };

    // Determine container class based on modal mode for slight style variations if needed
    const containerClass = isModalMode ? styles.createLessonModalContainer : styles.pageContainer;

    if (loading && !isModalMode) { // Show full page loading only for standalone page
        return <div className={styles.loading}>Loading lesson creation tools...</div>;
    }
    
    return (
        <div className={containerClass}>
            {/* Title for the page or modal */}
            <h2 className={styles.pageTitle}>{isModalMode ? 'Create New Lesson' : 'Create Lesson Page'}</h2>
            
            {/* Display success/error messages */}
            {message && (
                <p className={`${styles.message} ${styles[messageType] || styles.error}`}>
                    {message}
                </p>
            )}

            {/* Lesson creation form */}
            <form className={styles.lessonForm} onSubmit={(e) => e.preventDefault()}>
                {/* Section for Lesson Details */}
                <fieldset className={styles.formSection}>
                    <legend>Lesson Details</legend>
                     <div className={styles.formGrid}> {/* Using formGrid for consistency if desired */}
                        <div className={styles.formGroup}> {/* Changed from "form-group" to styles.formGroup */}
                            <label htmlFor="lessonTitle">Title <span className={styles.required}>*</span></label>
                            <input id="lessonTitle" className={styles.inputField} type="text" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={submitting || loading} placeholder="e.g., Introduction to JavaScript"/>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="lessonSubject">Subject <span className={styles.required}>*</span></label>
                            <select id="lessonSubject" className={styles.selectField} value={subject} onChange={handleSubjectChange} required disabled={submitting || loading || subjects.length === 0}>
                                <option value="">{loading && subjects.length === 0 ? "Loading subjects..." : (subjects.length === 0 ? "No subjects available" : "Select a Subject")}</option>
                                {subjects.map((subj) => (
                                    <option key={subj.id} value={subj.id}>{subj.name}</option>
                                ))}
                            </select>
                        </div>
                    
                        <div className={styles.formGroup}>
                            <label htmlFor="lessonVideoUrl">Video URL (Optional)</label>
                            {/* Changed type to "text" to avoid strict browser URL validation for an optional field */}
                            <input id="lessonVideoUrl" className={styles.inputField} type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="e.g., https://www.youtube.com/watch?v=..." disabled={submitting || loading} />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="lessonTags">Tags (Optional, comma-separated)</label>
                            <input id="lessonTags" className={styles.inputField} type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g., javascript, web development, basics" disabled={submitting || loading} />
                        </div>
                     </div>
                </fieldset>

                {/* Section for Attaching Quizzes */}
                <fieldset className={styles.formSection}>
                    <legend>Attach Quizzes (Optional)</legend>
                    <div className={styles.addContentSection}> 
                        <div className={styles.contentSectionHeader}>
                            <h3>Available Quizzes</h3>
                            <button
                                type="button"
                                onClick={() => setIsQuizModalOpen(true)}
                                className={styles.createContentBtn}
                                disabled={submitting || loading}
                            >
                                + Create New Quiz
                            </button>
                        </div>
                        <div className={styles.contentListArea}>
                            {loading && quizzes.length === 0 ? ( // Show loading specifically for quizzes if subjects are loaded but quizzes are not
                                <p className={styles.noContentMessage}>Loading quizzes...</p>
                            ) : quizzes.length > 0 ? (
                                <div className={styles.scrollableBox}>
                                    {quizzes.map(q => (
                                        <div key={q.id} className={styles.contentItem}>
                                            <input
                                                type="checkbox"
                                                id={`lesson-quiz-${q.id}`}
                                                checked={selectedQuizzes.includes(q.id)}
                                                onChange={() => handleQuizToggle(q.id)}
                                                // Disable if lesson form is submitting, or if quiz is already part of any lesson or course
                                                disabled={submitting || loading || !!q.lesson || !!q.course} 
                                            />
                                            <label htmlFor={`lesson-quiz-${q.id}`}>
                                                {q.title}
                                                {/* Indicate if quiz is already in use */}
                                                {(q.lesson || q.course) ? <span className={styles.alreadyAttached}> (In use)</span> : ''}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.noContentMessage}>
                                    No quizzes available. You can create one by clicking the button above.
                                </p>
                            )}
                        </div>
                    </div>
                </fieldset>

                {/* Section for Lesson Content Editor */}
                <fieldset className={styles.formSection}>
                    <legend>Lesson Content <span className={styles.required}>*</span></legend>
                    <div className={styles.editorContainer}>
                        {/* Render editor only when not submitting/loading to prevent issues */}
                        {!(submitting || loading) ? (
                            <CustomEditor 
                                ref={editorRef} 
                                onSave={handleEditorChange} /* Or onChange if CustomEditor supports it for live updates */
                                mediaCategory="lesson"
                            />
                        ) : (
                            <div className={styles.editorPlaceholder}>Editor is currently disabled or loading content...</div>
                        )}
                    </div>
                </fieldset>

                {/* Action Buttons: Save and Cancel (for modal) */}
                <div className={styles.formActions}>
                    {isModalMode && ( // Only show Cancel button when in modal mode
                        <button
                            type="button"
                            onClick={onClose} // Call the onClose prop passed from parent (CreateCourse)
                            className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSaveLesson} // Calls the main save handler
                        className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`}
                        disabled={submitting || loading} // Disable if submitting or initial data is loading
                    >
                        {submitting ? 'Saving...' : (isModalMode ? 'Create Lesson' : 'Save Lesson')}
                    </button>
                </div>
            </form>

            {/* Modal for Creating a New Quiz */}
            <Modal 
              isOpen={isQuizModalOpen} 
              onClose={() => setIsQuizModalOpen(false)}
              title="Create New Quiz" // Pass title to Modal component if it supports it
            >
              <CreateQuiz
                onSuccess={handleQuizCreated}
                onClose={() => setIsQuizModalOpen(false)}
                isModalMode={true} // Indicate CreateQuiz is in modal mode
                // Pass the current lesson's subject as initial subject for the quiz, if available
                initialSubjectId={subject || (subjects.length > 0 ? String(subjects[0].id) : null)} 
              />
            </Modal>
        </div>
    );
};

export default CreateLesson;
