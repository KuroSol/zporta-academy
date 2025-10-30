// CreateLesson.js
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useRouter } from 'next/router';
import LessonEditor from '@/components/Editor/LessonEditor';
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';
import Modal from '@/components/Modal/Modal';
import CreateQuiz from '@/components/admin/CreateQuiz';
import styles from '@/styles/admin/CreateLesson.module.css';

// ---- helpers ----
// strip <style>, then tags; check remaining text/media tokens
// (Copied from EditLesson, ensure consistency)
const hasMeaningfulContent = (html) => {
  const noStyle = String(html || '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const text = noStyle.replace(/<[^>]+>/g, '').trim();
  if (text) return true;
  return /<(img|video|audio|iframe|svg|canvas)\b/i.test(noStyle);
};


const CreateLesson = ({ onSuccess, onClose, isModalMode = false, initialSubjectId = null }) => {
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState(initialSubjectId || ''); // Holds the selected subject ID
    const [videoUrl, setVideoUrl] = useState('');
    const [tags, setTags] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuizzes, setSelectedQuizzes] = useState([]);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    // Premium flag
    const [isPremium, setIsPremium] = useState(false);

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
    const [customJS,  setCustomJS]  = useState(''); // Lesson-specific custom JS (scoped to this lesson)

    // === Live Preview State ===
    const [previewContent, setPreviewContent] = useState('');

    const router = useRouter();
    const editorRef = useRef(null);
    const previewIframeRef = useRef(null);
    const { logout } = useContext(AuthContext);

    // Fetch initial data: subjects, quizzes, and lesson templates
    const fetchData = useCallback(async () => {
        setLoading(true);
        setMessage('');
        try {
            const [subjectsRes, quizzesRes, templatesRes, myCoursesRes] = await Promise.all([
                apiClient.get('/subjects/'),
                apiClient.get('/quizzes/my/'),
                apiClient.get('/lessons/templates/'), // Endpoint for admin-defined LessonTemplates
                apiClient.get('/courses/my/')
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

            // Courses (owned by user)
            if (Array.isArray(myCoursesRes.data)) {
                setCourses(myCoursesRes.data);
            } else {
                console.error("Invalid data format for courses:", myCoursesRes.data);
                setCourses([]);
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


    // === Live Preview Logic ===
    const updatePreview = async () => { // Made async
        if (!editorRef.current) return;
        await editorRef.current?.flush?.(); // Ensure content is up-to-date
        const editorContent = editorRef.current.getContent();

        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Lesson Preview</title>
                <style>
                    body { font-family: sans-serif; line-height: 1.6; padding: 20px; color: #333; }
                    :root { --accent-color: ${accentColor}; }
                    ${customCSS}
                </style>
            </head>
            <body>
                <div data-lesson-root="true">
                    <h1>${title || 'Lesson Title'}</h1>
                    ${editorContent}
                </div>
                <script>
                    (function() {
                        try {
                            const root = document.querySelector('[data-lesson-root="true"]');
                            ${customJS}
                        } catch (e) {
                            console.error("Error in custom JS preview:", e);
                        }
                    })();
                <\/script>
            </body>
            </html>
        `;
        setPreviewContent(html);
    };


    useEffect(() => {
        if (previewIframeRef.current && previewContent) {
            previewIframeRef.current.srcdoc = previewContent;
        }
    }, [previewContent]);

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

    // handleEditorChange might be useful if LessonEditor emitted changes, but it doesn't seem to
    // const handleEditorChange = (editorContent) => { /* Currently unused */ };

    const handleSubjectChange = (e) => setSubject(e.target.value);

    // When premium toggled, clear incompatible course choice
    useEffect(() => {
        if (!selectedCourse) return;
        const courseObj = courses.find(c => String(c.id) === String(selectedCourse));
        if (!courseObj) return;
        // UI rule:
        // - premium lesson -> must attach to premium course
        // - free lesson    -> can attach to ANY course
        const allowed = isPremium
            ? courseObj.course_type === 'premium'
            : true;
        if (!allowed) setSelectedCourse('');
    }, [isPremium, selectedCourse, courses]);

    const filteredCourses = React.useMemo(() => {
        if (!Array.isArray(courses)) return [];
        return isPremium
            ? courses.filter(c => c.course_type === 'premium')
            : courses; // free lessons: show all courses
    }, [courses, isPremium]);

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

    const handleSaveLesson = async (publishAfter = false) => {
        setMessage('');
        setMessageType('error');

        if (!editorRef.current) {
            setMessage('Editor is not available.'); return;
        }

        // --- CRITICAL FIX: Flush before getting content ---
        console.log("[CreateLesson] Calling editorRef.flush()...");
        await editorRef.current?.flush?.();
        console.log("[CreateLesson] flush() completed.");
        const editorContent = editorRef.current.getContent();
        console.log("[CreateLesson] Content from editor:", editorContent);
        // --- END FIX ---

        if (!localStorage.getItem('token')) {
            setMessage('Authentication error. Please log in again.');
            if (!isModalMode) router.push('/login');
            return;
        }
        if (!title.trim()) { setMessage('Lesson Title is required.'); return; }
        if (!subject) { setMessage('Subject is required.'); return; }

        // Use hasMeaningfulContent helper for validation
        if (!hasMeaningfulContent(editorContent)) {
             console.error("[CreateLesson] Validation failed: Content is empty or lacks meaningful tags.");
             setMessage('Lesson Content cannot be empty.');
             return;
        }
         console.log("[CreateLesson] Content validation passed.");

        setSubmitting(true);
        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];

        const payload = {
            title: title.trim(),
            content: editorContent,
            subject,                 // always required
            tags: tagsArray,
            template: template,
            accent_color: accentColor,
            custom_css: customCSS,
            template_ref: selectedTemplateRef || null,
        };

        // premium flag
        payload.is_premium = !!isPremium;

       // If no customCSS typed, capture CSS applied in editor toolbar
        if (!payload.custom_css) {
            const cssFromEditor = editorRef.current?.getAppliedCSS?.();
            if (cssFromEditor) payload.custom_css = cssFromEditor;
        }
        // strip accidental <script> wrappers before sending
        if (customJS.trim()) {
            payload.custom_js = customJS.replace(/<\/?script[^>]*>/gi, '');
        }

        if (videoUrl.trim()) {
            payload.video_url = videoUrl.trim();
        }

        console.log("[CreateLesson] Sending payload to API:", payload);

        try {
            const response = await apiClient.post('/lessons/', payload);
            console.log("[CreateLesson] API Create successful:", response);
            const newLessonData = response.data;
            const lessonPermalink = newLessonData.permalink;

            let overallMessage = `Draft "${newLessonData.title}" saved!`;
            let overallMessageType = 'success';

            // Optional: attach to a course first, if selected
            if (selectedCourse && lessonPermalink) {
                 console.log("[CreateLesson] Attaching lesson to course:", selectedCourse);
                try {
                    setMessage('Lesson saved. Attaching to selected course...');
                    await apiClient.post(`/lessons/${lessonPermalink}/attach-course/`, {
                        course_id: selectedCourse
                    });
                     console.log("[CreateLesson] Course attachment successful.");
                    overallMessage = `Lesson saved and attached to course successfully!`;
                } catch (attachErr) {
                    console.error('[CreateLesson] Attach course error:', attachErr.response?.data || attachErr.message);
                    // Surface backend premium rule messages clearly
                    const attachMsg = attachErr.response?.data?.error || attachErr.response?.data?.detail || attachErr.message || 'Unknown error';
                    overallMessage = `Lesson saved, but failed to attach to course: ${attachMsg}`;
                    overallMessageType = 'warning';
                }
            }

            if (selectedQuizzes.length > 0 && lessonPermalink) {
                 console.log("[CreateLesson] Attaching quizzes:", selectedQuizzes);
                setMessage('Lesson saved. Attaching quizzes...');
                const quizAttachmentPromises = selectedQuizzes.map(quizId =>
                    apiClient.post(`/lessons/${lessonPermalink}/add-quiz/`, { quiz_id: quizId })
                        .catch(err => ({
                            type: 'QuizAttachment', id: quizId,
                            error: err.response?.data?.detail || err.message || 'Unknown error'
                        }))
                );
                const results = await Promise.allSettled(quizAttachmentPromises);
                 console.log("[CreateLesson] Quiz attachment results:", results);
                const failedAttachments = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
                if (failedAttachments.length > 0) {
                     const failedDetails = failedAttachments.map(f => {
                         const quiz = quizzes.find(q => String(q.id) === String(f.reason?.id || f.value?.id));
                         return `${quiz?.title || 'Unknown Quiz'} (${f.reason?.error || f.value?.error || 'Unknown reason'})`;
                     }).join(', ');
                     console.error("[CreateLesson] Failed quiz attachments:", failedDetails);
                    overallMessage = `Lesson saved, but failed to attach some quizzes: ${failedDetails}.`;
                    overallMessageType = 'warning';
                } else {
                     console.log("[CreateLesson] All selected quizzes attached successfully.");
                    overallMessage = `Lesson and all selected quizzes attached successfully!`;
                }
            }

            // If user chose Publish, do it after attachments
            if (publishAfter && lessonPermalink) {
                console.log("[CreateLesson] Attempting to publish lesson:", lessonPermalink);
                // Friendly client-side guard for premium rule (backend also enforces)
                if (isPremium && !selectedCourse) {
                    setMessage('Draft saved. Premium lessons must be attached to a premium course before publishing.');
                    setMessageType('warning');
                    setSubmitting(false);
                    return;
                }
                // Guard: if selected course is draft, block publish
                const courseObj = filteredCourses.find(c => String(c.id) === String(selectedCourse));
                if (courseObj && courseObj.is_draft) {
                    setMessage('Draft saved. You cannot publish a lesson while its course is in draft. Publish the course first or keep the lesson as draft.');
                    setMessageType('warning');
                    setSubmitting(false);
                    return;
                }
                try {
                    await apiClient.post(`/lessons/${lessonPermalink}/publish/`);
                     console.log("[CreateLesson] Publish successful.");
                    overallMessage = `Lesson published!`;
                    overallMessageType = 'success';
                } catch (pubErr) {
                    console.error('[CreateLesson] Publish error:', pubErr.response?.data || pubErr.message);
                    const pubMsg = pubErr.response?.data?.detail || pubErr.response?.data?.error || pubErr.message || 'Unknown error';
                    overallMessage = `Draft saved, but publish failed: ${pubMsg}`;
                    overallMessageType = 'warning';
                }
            }

            setMessage(overallMessage);
            setMessageType(overallMessageType);

            if (isModalMode && onSuccess) {
                onSuccess(newLessonData);
            } else if (!isModalMode) { // Only redirect if not in modal mode
                setTimeout(() => router.push('/admin/lessons'), overallMessageType === 'success' ? 1500 : 3000);
            }
        } catch (error) {
            console.error('[CreateLesson] Error creating lesson:', error.response ? error.response.data : error.message);
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
                if (!isModalMode) router.push('/login');
            }
        } finally {
             console.log("[CreateLesson] handleSaveLesson finished.");
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
                // CORRECTED className TEMPLATE LITERAL
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

                        {/* Access Type */}
                        <div className={styles.formGroup}>
                            <label htmlFor="lessonAccessType">Access</label>
                            <div className={styles.inlineAccess}>
                                <label className={styles.inlineAccessOption}>
                                    <input
                                        type="radio"
                                        name="access"
                                        value="free"
                                        checked={!isPremium}
                                        onChange={() => setIsPremium(false)}
                                        disabled={submitting || loading}
                                    />
                                    <span className={styles.badgeFree}>Free</span>
                                </label>
                                <label className={styles.inlineAccessOption}>
                                    <input
                                        type="radio"
                                        name="access"
                                        value="premium"
                                        checked={isPremium}
                                        onChange={() => setIsPremium(true)}
                                        disabled={submitting || loading}
                                    />
                                    <span className={styles.badgePremium}>Premium</span>
                                </label>
                            </div>
                            {isPremium ? (
                                <div className={styles.inlineNote}>
                                    Premium lessons <strong>must be attached</strong> to a <strong>premium course</strong> before publishing.
                                </div>
                            ) : (
                                <div className={styles.inlineNote}>
                                    Free lessons can be published standalone or attached to a free course.
                                </div>
                            )}
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

                        {/* CORRECTED className TEMPLATE LITERAL */}
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

                        {/* CORRECTED className TEMPLATE LITERAL */}
                        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                            <label htmlFor="customCSS">Custom CSS (Overrides template CSS if provided)</label>
                             {/* CORRECTED self-closing tag */}
                            <textarea
                                id="customCSS"
                                rows="6"
                                value={customCSS}
                                onChange={(e) => setCustomCSS(e.target.value)}
                                placeholder="e.g., .lesson-title { font-size: 2em; color: blue; }"
                                disabled={submitting || loading}
                                className={styles.inputField}
                            ></textarea>
                            <p className={styles.fieldHelpText}>
                                CSS entered here will be applied specifically to this lesson.
                                If an admin template is selected, its CSS will appear here; you can modify it.
                            </p>
                        </div>

                        {/* Custom JS (scoped to this lesson only) */}
                         {/* CORRECTED className TEMPLATE LITERAL */}
                        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                            <label htmlFor="customJS">Custom JS (runs only on this lesson)</label>
                             {/* CORRECTED self-closing tag */}
                            <textarea
                                id="customJS"
                                rows="6"
                                value={customJS}
                                onChange={(e) => setCustomJS(e.target.value)}
                                placeholder={`// Example
                                // (function(root){
                                //   const btn = root.querySelector('.my-button');
                                //   if(btn) btn.addEventListener('click', ()=>alert('Hi from this lesson only!'));
                                // })(document.querySelector('[data-lesson-root]'));`}
                                disabled={submitting || loading}
                                className={styles.inputField}
                            ></textarea>
                            <p className={styles.fieldHelpText}>
                                Inline JS only. External <code>&lt;script src&gt;</code> is blocked by the API validator.
                                Your code receives no globals—prefer selecting elements under this lesson root.
                            </p>
                        </div>
                    </div>
                </fieldset>
                {/* Section 2.5: Attach to Course (Optional) */}
                <fieldset className={styles.formSection}>
                    <legend>Attach to Course {isPremium ? '(Required for Premium before publish)' : '(Optional)'}</legend>

                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label htmlFor="attachCourseSelect">Attach to an existing course</label>
                            <select
                                id="attachCourseSelect"
                                className={styles.selectField}
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                disabled={submitting || loading || filteredCourses.length === 0}
                            >
                                <option value="">
                                    {filteredCourses.length === 0
                                      ? (isPremium ? 'No premium courses found' : 'No free courses found')
                                      : (isPremium ? 'Select a premium course' : 'Do not attach (standalone lesson)')}
                                </option>
                                {filteredCourses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.title}{c.is_draft ? ' (draft)' : ''}{c.course_type === 'premium' ? ' • Premium' : ''}
                                    </option>
                                ))}
                            </select>
                            <p className={styles.fieldHelpText}>
                                {isPremium
                                  ? 'Premium lessons must be attached to a premium course before publishing.'
                                  : 'Optional. If selected, the lesson will be attached to this course after it’s created.'}
                            </p>
                            {!!selectedCourse && filteredCourses.find(c => String(c.id) === String(selectedCourse))?.is_draft && (
                                <p className={styles.inlineNote}>
                                    The selected course is <strong>Draft</strong>. You can save this lesson as draft, but you must publish the course before publishing the lesson.
                                </p>
                            )}
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
                        <LessonEditor
                            ref={editorRef}
                           // Removed onSave prop as LessonEditor doesn't use it
                            mediaCategory="lesson"
                            externalCss={customCSS}
                        />
                        ) : (
                            <div className={styles.editorPlaceholder}>Editor is currently disabled...</div>
                        )}
                    </div>
                </fieldset>

                {/* Section 5: Live Preview */}
                <fieldset className={styles.formSection}>
                    <legend>Live Preview</legend>
                    <div className={styles.previewHeader}>
                        <p className={styles.fieldHelpText}>
                            See how your content, custom CSS, and JS will look to a student.
                        </p>
                        {/* CORRECTED className TEMPLATE LITERAL */}
                        <button
                            type="button"
                            onClick={updatePreview}
                            className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}
                            disabled={submitting || loading}
                        >
                            Refresh Preview
                        </button>
                    </div>
                    <div className={styles.previewIframeContainer}>
                         {/* CORRECTED self-closing tag */}
                        <iframe
                            ref={previewIframeRef}
                            className={styles.previewIframe}
                            title="Lesson Content Preview"
                            sandbox="allow-scripts" // Allows JS to run but in a secure context
                            srcDoc={previewContent || "<p style='text-align:center;color:#888;'>Click 'Refresh Preview' to see your lesson.</p>"}
                        ></iframe>
                    </div>
                </fieldset>

                {/* Action Buttons */}
                <div className={styles.formActions}>
                    {/* Save as Draft (private) */}
                     {/* CORRECTED className TEMPLATE LITERAL */}
                    <button
                        type="button"
                        onClick={() => handleSaveLesson(false)}
                        className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}
                        disabled={submitting || loading || !subject}
                        title="Save as private draft (only you can see it)"
                    >
                        {submitting ? 'Saving…' : 'Save Draft'}
                    </button>
                    {/* Publish (requires subject) */}
                     {/* CORRECTED className TEMPLATE LITERAL */}
                    <button
                        type="button"
                        onClick={() => handleSaveLesson(true)}
                        className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`}
                        disabled={submitting || loading || !subject}
                        title={isPremium ? "Publish (requires attaching to a premium course first)" : "Publish (visible to everyone)"}
                    >
                        {submitting ? 'Publishing…' : 'Publish'}
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
