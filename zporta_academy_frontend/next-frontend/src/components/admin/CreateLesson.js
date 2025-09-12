// CreateLesson.js
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useRouter } from 'next/router';
import CustomEditor from '@/components/Editor/CustomEditor';
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';
import Modal from '@/components/Modal/Modal';
import CreateQuiz from '@/components/admin/CreateQuiz';
import styles from '@/styles/admin/CreateLesson.module.css';

const CreateLesson = ({ onSuccess, onClose, isModalMode = false, initialSubjectId = null }) => {
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState(initialSubjectId || ''); // Holds the selected subject ID
    const [videoUrl, setVideoUrl] = useState('');
    const [tags, setTags] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuizzes, setSelectedQuizzes] = useState([]);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [messageType, setMessageType] = useState('error');
    const [loading, setLoading] = useState(true);

    // === Template state ===
    const [lessonTemplates, setLessonTemplates] = useState([]); // Admin-defined templates
    const [selectedTemplateRef, setSelectedTemplateRef] = useState(null); // ID of selected admin-defined template

    const [template, setTemplate] = useState('modern'); // Built-in template choice (e.g., 'modern', 'minimal')
    const [accentColor, setAccentColor] = useState('#222E3B'); // Lesson accent color
    const [customCSS, setCustomCSS] = useState(''); // Lesson-specific custom CSS

    const router = useRouter();
    const editorRef = useRef(null);
    const { logout } = useContext(AuthContext);

    // Fetch initial data: subjects, quizzes, and lesson templates
    const fetchData = useCallback(async () => {
        setLoading(true);
        setMessage('');
        try {
            const [subjectsRes, quizzesRes, templatesRes] = await Promise.all([
                apiClient.get('/subjects/'),
                apiClient.get('/quizzes/my/'),
                apiClient.get('/lessons/templates/') // Endpoint for admin-defined LessonTemplates
            ]);

            // Subject handling (restored from your reliable older version)
            if (Array.isArray(subjectsRes.data)) {
                setSubjects(subjectsRes.data);
                if (initialSubjectId && subjectsRes.data.find(s => String(s.id) === String(initialSubjectId))) {
                    setSubject(String(initialSubjectId));
                } else if (subjectsRes.data.length > 0 && !initialSubjectId) {
                    // setSubject(String(subjectsRes.data[0].id)); // Intentionally commented: allows "Select a Subject"
                }
            } else {
                console.error("Invalid data format for subjects:", subjectsRes.data);
                setMessage('Received invalid subject data.');
                setSubjects([]);
            }

            // Quiz handling
            if (Array.isArray(quizzesRes.data)) {
                setQuizzes(quizzesRes.data);
            } else {
                console.error("Invalid data format for quizzes:", quizzesRes.data);
                setQuizzes([]);
            }

            // Lesson Templates (admin-defined)
            if (Array.isArray(templatesRes.data)) {
                setLessonTemplates(templatesRes.data);
            } else {
                console.error("Invalid data format for lesson templates:", templatesRes.data);
                setLessonTemplates([]);
            }

        } catch (error) {
            console.error("Error fetching initial data:", error.response ? error.response.data : error.message);
            setMessage('Failed to load necessary data. Please try again.');
            setMessageType('error');
            if (error.response?.status === 401 || error.response?.status === 403) {
                logout(); 
                if (!isModalMode) router.push('/login');
            }
        } finally {
            setLoading(false);
        }
    }, [logout, initialSubjectId, isModalMode, router]);

    useEffect(() => {
        if (localStorage.getItem('token')) {
            fetchData();
        } else {
            setMessage("Please log in to create a lesson.");
            setMessageType('error');
            setLoading(false);

            if (!isModalMode) router.push('/login');
        }
    }, [fetchData, isModalMode, router]);

    // Effect to apply styles when an admin-defined template is selected
    useEffect(() => {
        if (selectedTemplateRef && lessonTemplates.length > 0) {
            const selectedAdminTemplate = lessonTemplates.find(t => String(t.id) === String(selectedTemplateRef));
            if (selectedAdminTemplate) {
                if (selectedAdminTemplate.predefined_css) {
                    setCustomCSS(selectedAdminTemplate.predefined_css);
                }
                if (selectedAdminTemplate.accent_color) {
                    setAccentColor(selectedAdminTemplate.accent_color);
                }
                // Optionally, you could also set the 'template' (modern, minimal, dark) if your admin templates correspond to these
            }
        } else if (!selectedTemplateRef) {
            // Optionally reset customCSS or accentColor if "None" is selected for admin template
            // setCustomCSS(''); // Or revert to a default
            // setAccentColor('#222E3B'); // Or revert to a default
        }
    }, [selectedTemplateRef, lessonTemplates]);


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

    const handleEditorChange = (editorContent) => { /* For future use if editor supports live updates */ };

    const handleSubjectChange = (e) => setSubject(e.target.value);

    const handleQuizToggle = (quizId) => {
        setSelectedQuizzes(prev =>
            prev.includes(quizId)
                ? prev.filter(id => id !== quizId)
                : [...new Set([...prev, quizId])]
        );
    };
    
    const handleQuizCreated = (newQuiz) => {
        setIsQuizModalOpen(false);
        refreshQuizzes();
        if (newQuiz?.id) {
            setSelectedQuizzes(prev => [...new Set([...prev, newQuiz.id])]);
        }
        setMessage(`Quiz "${newQuiz?.title || 'New Quiz'}" created and selected!`);
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
    };
    
    const handleSaveLesson = async () => {
        setMessage(''); 
        setMessageType('error');

        if (!editorRef.current) {
            setMessage('Editor is not available.'); return;
        }
        const editorContent = editorRef.current.getContent();

        if (!localStorage.getItem('token')) { 
            setMessage('Authentication error. Please log in again.'); 
            if (!isModalMode) router.push('/login'); 
            return; 
        }
        if (!title.trim()) { setMessage('Lesson Title is required.'); return; }
        if (!subject) { setMessage('Please select a Subject.'); return; }
        if (!editorContent || !editorContent.trim()) { setMessage('Lesson Content cannot be empty.'); return; }

        setSubmitting(true);
        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];

        const payload = {
            title: title.trim(),
            content: editorContent,
            subject: subject,
            tags: tagsArray,
            template: template, // Built-in template choice
            accent_color: accentColor,
            custom_css: customCSS,
            template_ref: selectedTemplateRef || null, // Admin-defined template ID
        };
        if (videoUrl.trim()) {
            payload.video_url = videoUrl.trim();
        }

        try {
            const response = await apiClient.post('/lessons/', payload);
            const newLessonData = response.data;
            const lessonPermalink = newLessonData.permalink;

            let overallMessage = `Lesson "${newLessonData.title}" saved!`;
            let overallMessageType = 'success';

            if (selectedQuizzes.length > 0 && lessonPermalink) {
                setMessage('Lesson saved. Attaching quizzes...'); 
                const quizAttachmentPromises = selectedQuizzes.map(quizId =>
                    apiClient.post(`/lessons/${lessonPermalink}/add-quiz/`, { quiz_id: quizId })
                        .catch(err => ({ 
                            type: 'QuizAttachment', id: quizId, 
                            error: err.response?.data?.detail || err.message || 'Unknown error'
                        }))
                );
                const results = await Promise.allSettled(quizAttachmentPromises);
                const failedAttachments = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
                if (failedAttachments.length > 0) {
                    const failedTitles = failedAttachments.map(f => quizzes.find(q => q.id === (f.reason?.id || f.value?.id))?.title || 'Unknown Quiz').join(', ');
                    overallMessage = `Lesson saved, but failed to attach: ${failedTitles}.`;
                    overallMessageType = 'warning';
                } else {
                    overallMessage = `Lesson and all selected quizzes attached successfully!`;
                }
            }
            
            setMessage(overallMessage);
            setMessageType(overallMessageType);
            
            if (isModalMode && onSuccess) {
                onSuccess(newLessonData); 
            } else {
                setTimeout(() => router.push('/admin/lessons'), overallMessageType === 'success' ? 2000 : 4000);
            }
        } catch (error) {
            console.error('Error creating lesson:', error.response ? error.response.data : error.message);
            let errorMsg = 'Failed to create lesson. ';
            if (error.response?.data) {
                if (typeof error.response.data === 'object' && error.response.data !== null) {
                    errorMsg += Object.entries(error.response.data)
                                     .map(([field, messages]) => `${field.replace("_", " ")}: ${Array.isArray(messages) ? messages.join(' ') : String(messages)}`)
                                     .join(' | ');
                } else if (typeof error.response.data === 'string' && error.response.data.length < 200) {
                    errorMsg += error.response.data;
                } else if (error.response.data?.detail) {
                    errorMsg += error.response.data.detail;
                }
            } else if (error.message) {
                errorMsg += error.message;
            }
            setMessage(errorMsg);
            setMessageType('error');
            if (error.response?.status === 401 || error.response?.status === 403) {
                logout();
                if(!isModalMode) navigate('/login');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const containerClass = isModalMode ? styles.createLessonModalContainer : styles.pageContainer;

    if (loading && !isModalMode) { 
        return <div className={styles.loading}>Loading lesson creation tools...</div>;
    }
    
    return (
        <div className={containerClass}>
            <h2 className={styles.pageTitle}>{isModalMode ? 'Create New Lesson' : 'Create Lesson Page'}</h2>
            
            {message && (
                <p className={`${styles.message} ${styles[messageType] || styles.error}`}>
                    {message}
                </p>
            )}

            <form className={styles.lessonForm} onSubmit={(e) => e.preventDefault()}>
                {/* Section 1: Core Lesson Details */}
                <fieldset className={styles.formSection}>
                    <legend>Core Details</legend>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label htmlFor="lessonTitle">Title <span className={styles.required}>*</span></label>
                            <input id="lessonTitle" className={styles.inputField} type="text" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={submitting || loading} placeholder="e.g., Introduction to Algebra"/>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="lessonSubject">Subject <span className={styles.required}>*</span></label>
                            <select 
                                id="lessonSubject" 
                                className={styles.selectField} 
                                value={subject}
                                onChange={handleSubjectChange} 
                                required 
                                disabled={submitting || loading || subjects.length === 0}
                            >
                                <option value=""> 
                                    {loading && subjects.length === 0 ? "Loading subjects..." : (subjects.length === 0 ? "No subjects available" : "Select a Subject")}
                                </option>
                                {subjects.map((subj) => (
                                    <option key={subj.id} value={subj.id}>{subj.name}</option>
                                ))}
                            </select>
                        </div>
                    
                        <div className={styles.formGroup}>
                            <label htmlFor="lessonVideoUrl">Video URL (Optional)</label>
                            <input id="lessonVideoUrl" className={styles.inputField} type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="e.g., https://youtube.com/watch?v=..." disabled={submitting || loading} />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="lessonTags">Tags (Optional, comma-separated)</label>
                            <input id="lessonTags" className={styles.inputField} type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g., algebra, math, basics" disabled={submitting || loading} />
                        </div>
                    </div>
                </fieldset>

                {/* Section 2: Styling & Templates */}
                <fieldset className={styles.formSection}>
                    <legend>Styling & Presentation</legend>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label htmlFor="lessonBuiltInTemplate">Built-in Style</label>
                            <select
                                id="lessonBuiltInTemplate"
                                className={styles.selectField}
                                value={template}
                                onChange={e => setTemplate(e.target.value)}
                                disabled={submitting || loading}
                            >
                                <option value="modern">Modern</option>
                                <option value="minimal">Minimal</option>
                                <option value="dark">Dark</option>
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="accentColor">Accent Color</label>
                            <input
                                id="accentColor"
                                type="color"
                                value={accentColor}
                                onChange={(e) => setAccentColor(e.target.value)}
                                disabled={submitting || loading}
                                className={styles.inputField} 
                            />
                        </div>
                        
                        <div className={`${styles.formGroup} ${styles.formGroupSpan2}`}> {/* Spans 2 columns for better layout */}
                            <label htmlFor="adminTemplateRef">Use Admin Template (Optional)</label>
                            <select
                                id="adminTemplateRef"
                                className={styles.selectField}
                                value={selectedTemplateRef || ''}
                                onChange={e => setSelectedTemplateRef(e.target.value || null)}
                                disabled={submitting || loading || lessonTemplates.length === 0}
                            >
                                <option value="">
                                    {loading && lessonTemplates.length === 0 ? "Loading templates..." : (lessonTemplates.length === 0 ? "No admin templates" : "None (Use above style)")}
                                </option>
                                {lessonTemplates.map((tmpl) => (
                                    <option key={tmpl.id} value={tmpl.id}>{tmpl.name} {tmpl.description ? `(${tmpl.description})`: ''}</option>
                                ))}
                            </select>
                            {selectedTemplateRef && lessonTemplates.find(t => String(t.id) === String(selectedTemplateRef))?.description && (
                                <p className={styles.templateDescription}>
                                    Selected: {lessonTemplates.find(t => String(t.id) === String(selectedTemplateRef))?.description}
                                </p>
                            )}
                        </div>
                        
                        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                            <label htmlFor="customCSS">Custom CSS (Overrides template CSS if provided)</label>
                            <textarea
                                id="customCSS"
                                rows="6"
                                value={customCSS}
                                onChange={(e) => setCustomCSS(e.target.value)}
                                placeholder="e.g., .lesson-title { font-size: 2em; color: blue; }"
                                disabled={submitting || loading}
                                className={styles.inputField}
                            />
                            <p className={styles.fieldHelpText}>
                                CSS entered here will be applied specifically to this lesson. 
                                If an admin template is selected, its CSS will appear here; you can modify it.
                            </p>
                        </div>
                    </div>
                </fieldset>


                {/* Section 3: Attach Quizzes */}
                <fieldset className={styles.formSection}>
                    <legend>Attach Quizzes (Optional)</legend>
                    <div className={styles.addContentSection}> 
                        <div className={styles.contentSectionHeader}>
                            <h3>Available Quizzes</h3>
                            <button
                                type="button"
                                onClick={() => setIsQuizModalOpen(true)}
                                className={styles.createContentBtn}
                                disabled={submitting || loading || !subject} // Also disable if no subject is selected
                            >
                                + Create New Quiz { !subject && "(Select Subject First)"}
                            </button>
                        </div>
                        <div className={styles.contentListArea}>
                            {loading && quizzes.length === 0 && subjects.length > 0 ? ( // Check subjects.length to avoid showing this if subjects haven't loaded
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
                                                disabled={submitting || loading || !!q.lesson || !!q.course} 
                                            />
                                            <label htmlFor={`lesson-quiz-${q.id}`}>
                                                {q.title}
                                                {(q.lesson || q.course) ? <span className={styles.alreadyAttached}> (In use)</span> : ''}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.noContentMessage}>
                                    No quizzes available for the selected subject or to create. 
                                    Select a subject to enable quiz creation.
                                </p>
                            )}
                        </div>
                    </div>
                </fieldset>

                {/* Section 4: Lesson Content Editor */}
                <fieldset className={styles.formSection}>
                    <legend>Lesson Content <span className={styles.required}>*</span></legend>
                    <div className={styles.editorContainer}>
                        {!(submitting || loading) ? (
                            <CustomEditor 
                                ref={editorRef} 
                                onSave={handleEditorChange}
                                mediaCategory="lesson"
                            />
                        ) : (
                            <div className={styles.editorPlaceholder}>Editor is currently disabled...</div>
                        )}
                    </div>
                </fieldset>

                {/* Action Buttons */}
                <div className={styles.formActions}>
                    {isModalMode && (
                        <button type="button" onClick={onClose} className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`} disabled={submitting}>
                            Cancel
                        </button>
                    )}
                    <button type="button" onClick={handleSaveLesson} className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`} disabled={submitting || loading}>
                        {submitting ? 'Saving...' : (isModalMode ? 'Create Lesson' : 'Save Lesson')}
                    </button>
                </div>
            </form>

            {/* Modal for Creating a New Quiz */}
            <Modal 
                isOpen={isQuizModalOpen} 
                onClose={() => setIsQuizModalOpen(false)}
                title="Create New Quiz"
            >
                <CreateQuiz
                    onSuccess={handleQuizCreated}
                    onClose={() => setIsQuizModalOpen(false)}
                    isModalMode={true}
                    initialSubjectId={subject || (subjects.length > 0 ? String(subjects[0].id) : null)} 
                />
            </Modal>
        </div>
    );
};

export default CreateLesson;
