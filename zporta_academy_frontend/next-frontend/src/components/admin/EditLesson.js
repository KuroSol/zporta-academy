// components/admin/EditLesson.js
import React, { useEffect, useRef, useState, useContext, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
// *** REMOVED dynamic import ***
// import dynamic from 'next/dynamic';
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';
import styles from '@/styles/admin/CreateLesson.module.css';
import Modal from '@/components/Modal/Modal';
import CreateQuiz from '@/components/admin/CreateQuiz';

// *** USE STANDARD IMPORT ***
import LessonEditor from '@/components/Editor/LessonEditor';

// ---- helpers ----
const hasMeaningfulContent = (html) => {
  const noStyle = String(html || '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const text = noStyle.replace(/<[^>]+>/g, '').trim();
  if (text) return true;
  return /<(img|video|audio|iframe|svg|canvas)\b/i.test(noStyle);
};

export default function EditLesson() {
  const router = useRouter();
  const { permalink } = router.query;
  const { logout, user } = useContext(AuthContext);

  const editorRef = useRef(null); // Ref to hold the LessonEditor instance
  const previewIframeRef = useRef(null);
  const [editorKey, setEditorKey] = useState(0); // Key to force remount
  const [initialContent, setInitialContent] = useState('');
  const [editorReady, setEditorReady] = useState(false); // Track if ref methods are available

  // --- State Variables ---
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [tags, setTags] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [attachedQuizIds, setAttachedQuizIds] = useState([]);
  const [selectedQuizzes, setSelectedQuizzes] = useState([]);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [originalCourseId, setOriginalCourseId] = useState(null);
  const [currentLessonId, setCurrentLessonId] = useState(null);
  const [lessonTemplates, setLessonTemplates] = useState([]);
  const [selectedTemplateRef, setSelectedTemplateRef] = useState(null);
  const [template, setTemplate] = useState('modern');
  const [accentColor, setAccentColor] = useState('#222E3B');
  const [customCSS, setCustomCSS] = useState('');
  const [customJS, setCustomJS] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [ownerUsername, setOwnerUsername] = useState(null);
  const [lessonStatus, setLessonStatus] = useState('draft');

  // --- Callbacks ---
  const getEditorHTML = useCallback((lessonObj) => {
    if (!lessonObj) return '';
    return ( lessonObj.editor_content ?? lessonObj.editorContent ?? lessonObj.content ?? '' );
  }, []);

  const fetchInitial = useCallback(async () => {
    if (!permalink || !user?.username) return;
    console.log("[EditLesson] Fetching initial data for permalink:", permalink);
    setLoading(true);
    setEditorReady(false); // Reset on fetch
    setMessage('');
    try {
      const [lessonRes, subjectsRes, userQuizzesRes, templatesRes, myCoursesRes] = await Promise.all([
        apiClient.get(`/lessons/${encodeURIComponent(permalink)}/update/`),
        apiClient.get('/subjects/'), apiClient.get('/quizzes/my/'),
        apiClient.get('/lessons/templates/'), apiClient.get('/courses/my/'),
      ]);
      console.log("[EditLesson] API responses received.");
      const l = lessonRes.data;
      if (!l) throw new Error("Lesson data not found.");
      setOwnerUsername(l.created_by || null);
      if (l.created_by !== user.username) {
        setMessage('Not allowed.'); setMessageType('error'); setLoading(false); return;
      }
      console.log("[EditLesson] User verified.");
      // Populate state...
      setCurrentLessonId(l.id); setIsLocked(!!l.is_locked); setTitle(l.title || '');
      setSubject(l.subject ? String(l.subject) : ''); setVideoUrl(l.video_url || '');
      setTemplate(l.template || 'modern'); setAccentColor(l.accent_color || '#222E3B');
      setCustomCSS(l.custom_css || ''); setCustomJS(l.custom_js || '');
      setSelectedTemplateRef(l.template_ref || null); setIsPremium(!!l.is_premium);
      setLessonStatus(l.status || 'draft');
      const tagList = Array.isArray(l.tags_output) ? l.tags_output : []; setTags(tagList.join(', '));
      setOriginalCourseId(l.course || null); setSelectedCourse(l.course ? String(l.course) : '');
      const initiallyAttachedIds = Array.isArray(l.quizzes) ? l.quizzes.map(q => q.id) : [];
      setAttachedQuizIds(initiallyAttachedIds); setSelectedQuizzes(initiallyAttachedIds);
      const initialHtml = getEditorHTML(l);
      setInitialContent(initialHtml); // Set content BEFORE incrementing key
      console.log("[EditLesson] Initial content set.");
      // Increment key AFTER setting content, ensuring editor gets the new content on remount
      setEditorKey(k => k + 1);
      console.log("[EditLesson] Triggering editor remount.");
      setSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
      setQuizzes(Array.isArray(userQuizzesRes.data) ? userQuizzesRes.data : []);
      setLessonTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : []);
      setCourses(Array.isArray(myCoursesRes.data) ? myCoursesRes.data : []);
      console.log("[EditLesson] Aux data loaded.");
    } catch (err) {
        console.error("[EditLesson] ========== ERROR DETAILS ==========");
        console.error("[EditLesson] Full error object:", err);
        console.error("[EditLesson] Error name:", err.name);
        console.error("[EditLesson] Error message:", err.message);
        console.error("[EditLesson] Error stack:", err.stack);
        console.error("[EditLesson] Response status:", err.response?.status);
        console.error("[EditLesson] Response data:", err.response?.data);
        console.error("[EditLesson] Response headers:", err.response?.headers);
        console.error("[EditLesson] =====================================");
        
        const code = err.response?.status;
        if (code === 401 || code === 403) { setMessage(err.response?.data?.detail || 'Auth error.'); logout(); router.push('/login'); return; }
        if (code === 404) { setMessage("Lesson not found."); }
        else { 
            const detailedMessage = err.message || err.response?.data?.detail || 'Failed to load lesson data. Check console for details.';
            setMessage(detailedMessage); 
        }
        setMessageType('error');
    } finally { setLoading(false); console.log("[EditLesson] fetchInitial finished."); }
  }, [permalink, user, logout, router, getEditorHTML]);

  // *** Simplified useEffect to check editor readiness after direct import ***
  useEffect(() => {
    // Run after render cycle when editorKey changes (after fetch) and loading is done
    if (!loading && editorKey > 0) {
      console.log(`[EditLesson] useEffect[loading=${loading}, editorKey=${editorKey}]: Checking ref immediately after render...`);

      // Small delay to ensure ref is attached after direct import render
      const checkTimeoutId = setTimeout(() => {
          const currentRef = editorRef.current;
          const isReady = !!currentRef
            && typeof currentRef.getContent === 'function'
            && typeof currentRef.flush === 'function';

          setEditorReady(isReady); // Update state based on check
          console.log(`[EditLesson] Editor Ready Check result (after 50ms delay):`, isReady, currentRef ? `Keys: [${Object.keys(currentRef).join(', ')}]` : 'ref null');
          if (!isReady) {
              console.error("[EditLesson] Editor ref still not ready after delay.", currentRef);
          }
      }, 50); // Short delay (50ms)

      return () => clearTimeout(checkTimeoutId); // Cleanup timeout

    } else {
        // Reset readiness if loading starts again or on initial mount (key=0)
        console.log("[EditLesson] Conditions not met for readiness check or resetting.", { loading, editorKey });
        if (editorReady) {
            console.log("[EditLesson] Resetting editorReady state to false.");
            setEditorReady(false);
        }
    }
  // Depend on loading and editorKey.
  }, [loading, editorKey]);


  // --- Initial Data Load Effect ---
  useEffect(() => {
    if (permalink) {
      if (!localStorage.getItem('token')) { router.push('/login'); return; }
      fetchInitial();
    } else { console.warn("[EditLesson] Permalink not available for initial fetch."); }
  }, [permalink, fetchInitial, router]);

  // --- Other Effects and Callbacks ---
  useEffect(() => {
    if (selectedTemplateRef && lessonTemplates.length > 0) {
      const t = lessonTemplates.find(t => String(t.id) === String(selectedTemplateRef));
      if (t) {
        if (t.predefined_css) setCustomCSS(t.predefined_css);
        if (t.accent_color) setAccentColor(t.accent_color);
      }
    }
  }, [selectedTemplateRef, lessonTemplates]);

  const filteredCourses = useMemo(() => {
    if (!Array.isArray(courses)) return [];
    return isPremium ? courses.filter(c => c.course_type === 'premium') : courses;
  }, [courses, isPremium]);

  const refreshQuizzes = useCallback(async () => {
    try {
      const res = await apiClient.get('/quizzes/my/');
      setQuizzes(Array.isArray(res.data) ? res.data : []);
    } catch (error){ console.error("Error refreshing quizzes:", error); }
  }, []);

  const handleQuizToggle = (quizId) => {
    setSelectedQuizzes(prev =>
      prev.includes(quizId) ? prev.filter(id => id !== quizId) : [...new Set([...prev, quizId])]
    );
  };

   const handleQuizCreated = (newQuiz) => {
        setIsQuizModalOpen(false);
        refreshQuizzes();
        if (newQuiz?.id) { setSelectedQuizzes(prev => [...new Set([...prev, newQuiz.id])]); }
        setMessage(`Quiz "${newQuiz?.title || 'New Quiz'}" created and selected!`);
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
    };

  // --- Live Preview Logic ---
  const updatePreview = async () => {
    console.log("[EditLesson] updatePreview called. Editor ready:", editorReady);
    if (!editorReady || !editorRef.current) {
      setMessage('Editor not ready yet.'); console.warn("Preview aborted: editor not ready."); return;
    }
    console.log("[EditLesson] Calling editorRef.current.flush() for preview...");
    try {
        await editorRef.current.flush();
        console.log("[EditLesson] flush() completed.");
        await new Promise(r => setTimeout(r, 0)); // Allow state updates if blur happened
        const editorContent = editorRef.current.getContent() || '';
        console.log("[EditLesson] Content for preview:", editorContent.substring(0, 100) + '...');
        const html = `
          <!doctype html><html><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Lesson Preview</title>
          <style>
            body { font-family: sans-serif; line-height: 1.6; padding: 20px; color: #333; }
            :root { --accent-color: ${accentColor}; }
            ${customCSS}
          </style></head>
          <body><div data-lesson-root="true"><h1>${title || 'Lesson Title'}</h1>${editorContent}</div>
          <script>(function(){try{ const root = document.querySelector('[data-lesson-root="true"]'); ${customJS} }catch(e){console.error("Error in custom JS preview:", e)}})();<\/script></body></html>`;
        setPreviewContent(html);
        console.log("[EditLesson] Preview HTML generated.");
    } catch (error) { console.error("[EditLesson] Error during updatePreview:", error); setMessage("Preview error."); setEditorReady(false); }
  };
  useEffect(() => {
    if (previewIframeRef.current && previewContent) {
      previewIframeRef.current.srcdoc = previewContent;
    }
  }, [previewContent]);


  // --- Save Handler ---
  const handleSave = async () => {
    console.log("[EditLesson] handleSave called. Editor ready:", editorReady);
    setMessage(''); setMessageType('error');
    if (isLocked) { setMessage('Lesson locked.'); console.warn("Save aborted: Locked."); return; }
    if (!editorReady || !editorRef.current) {
      setMessage('Editor not ready.'); console.error('[EditLesson] Save aborted: editor not ready.'); return;
    }
    if (!title?.trim() || !subject) { setMessage('Title & Subject required.'); console.warn("Save aborted: Missing title/subject."); return; }

    let editorHTML = '';
    try {
        console.log("[EditLesson] Calling editorRef.current.flush() before save...");
        await editorRef.current.flush();
        await new Promise(r => setTimeout(r, 0)); // Allow state updates
        if (typeof editorRef.current.getContent !== 'function') throw new Error('getContent not found on ref.');
        editorHTML = String(editorRef.current.getContent() || '');
        console.log("[EditLesson] Content retrieved:", editorHTML.substring(0, 100) + '...');
    } catch (error) { console.error("[EditLesson] Error getting content:", error); setMessage("Save error getting content."); setEditorReady(false); return; }

    if (!hasMeaningfulContent(editorHTML)) {
        if (editorHTML.replace(/<style.*?<\/style>/gs, '').replace(/<[^>]+>/g, '').trim() === '') { setMessage('Content empty.'); }
        else { setMessage('Content validation failed.'); }
        console.warn("Save aborted: Content validation failed."); return;
    }
    console.log("[EditLesson] Validation passed.");
    setSubmitting(true);
    const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const appliedEditorCSS = typeof editorRef.current?.getAppliedCSS === 'function' ? editorRef.current.getAppliedCSS() : '';
    const payload = {
      title: title.trim(),
      subject,
      editor_content: editorHTML,
      content: editorHTML,
      tags: tagsArray,
      template: template,
      accent_color: accentColor,
      custom_css: customCSS || appliedEditorCSS || '',
      custom_js: (customJS || '').replace(/<\/?script[^>]*>/gi, ''),
      template_ref: selectedTemplateRef || null,
      is_premium: !!isPremium
    };
    const trimmedVideo = (videoUrl || '').trim();
    if (trimmedVideo) payload.video_url = trimmedVideo;

    console.log("[EditLesson] Sending PATCH payload:", { title: payload.title, subject: payload.subject, tags: payload.tags }); // Log less
    try {
        const res = await apiClient.patch(`/lessons/${encodeURIComponent(permalink)}/update/`, payload);
        console.log("[EditLesson] PATCH successful.");
        let overallMessage = 'Lesson updated successfully.';
        let overallMessageType = 'success';

        // --- Handle Course Change ---
        const newCourseId = selectedCourse ? String(selectedCourse) : null;
        const oldCourseId = originalCourseId ? String(originalCourseId) : null;
        if (newCourseId !== oldCourseId) {
            if (oldCourseId && !newCourseId) { // Detach
                console.log("[EditLesson] Detaching from course:", oldCourseId);
                try {
                     await apiClient.post(`/lessons/${encodeURIComponent(permalink)}/detach-course/`);
                     setOriginalCourseId(null); console.log("Detach success.");
                } catch (detachErr) {
                     console.error('[EditLesson] Detach failed:', detachErr.response?.data || detachErr.message);
                     overallMessage = 'Saved, but detach failed.'; overallMessageType = 'warning';
                }
            } else if (newCourseId) { // Attach
                if(oldCourseId) { console.log("Detaching before attach..."); try { await apiClient.post(`/lessons/${encodeURIComponent(permalink)}/detach-course/`); } catch (e) { console.warn("Pre-attach detach failed.")}}
                console.log("[EditLesson] Attaching to course:", newCourseId);
                try {
                    await apiClient.post(`/lessons/${encodeURIComponent(permalink)}/attach-course/`, { course_id: newCourseId });
                    setOriginalCourseId(newCourseId); console.log("Attach success."); overallMessage='Updated & attached.';
                } catch (attachErr) {
                    console.error('[EditLesson] Attach failed:', attachErr.response?.data || attachErr.message);
                    overallMessage = `Saved, but attach failed: ${attachErr.response?.data?.detail || 'Error'}`; overallMessageType = 'warning';
                    setSelectedCourse(oldCourseId ? String(oldCourseId) : ''); // Revert
                }
            }
        }

        // --- Handle Quiz Changes ---
        const newlySelectedIds = new Set(selectedQuizzes);
        const previouslyAttachedIds = new Set(attachedQuizIds);
        const quizzesToAttach = selectedQuizzes.filter(id => !previouslyAttachedIds.has(id));
        const quizzesToDetach = attachedQuizIds.filter(id => !newlySelectedIds.has(id));
        if (quizzesToAttach.length > 0 || quizzesToDetach.length > 0) {
            console.log("[EditLesson] Updating quizzes:", { attach: quizzesToAttach, detach: quizzesToDetach });
            setMessage('Lesson saved. Updating quizzes...'); // Intermediate message
             const attachPromises = quizzesToAttach.map(quizId => apiClient.post(`/lessons/${encodeURIComponent(permalink)}/add-quiz/`, { quiz_id: quizId }).catch(err => ({ quizId, error: err.response?.data?.detail || err.message })));
             const detachPromises = quizzesToDetach.map(quizId => apiClient.post(`/lessons/${encodeURIComponent(permalink)}/detach-quiz/`, { quiz_id: quizId }).catch(err => ({ quizId, error: err.response?.data?.detail || err.message })));
             const results = await Promise.allSettled([...attachPromises, ...detachPromises]);
             const failedOps = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error));
             if (failedOps.length > 0) {
                 const failedDetails = failedOps.map(f => `QuizID ${f.reason?.quizId || f.value?.quizId}: ${f.reason?.error || f.value?.error || 'Unknown'}`).join(', ');
                 console.error("[EditLesson] Failed quiz ops:", failedDetails);
                 overallMessage = `Saved, but quiz updates failed: ${failedDetails}.`; overallMessageType = 'warning';
                 // Re-fetch quizzes to be safe?
                 await refreshQuizzes();
                 try { const currentLessonRes = await apiClient.get(`/lessons/${encodeURIComponent(permalink)}/update/`); setAttachedQuizIds(Array.isArray(currentLessonRes.data.quizzes) ? currentLessonRes.data.quizzes.map(q => q.id) : []); } catch (fetchErr) { console.error("Failed re-fetch"); }
             } else {
                 console.log("Quiz updates success."); setAttachedQuizIds(selectedQuizzes); overallMessage='Updated & quizzes saved.'; overallMessageType = 'success';
             }
        }

        setMessage(overallMessage);
        setMessageType(overallMessageType);

    } catch (err) {
         console.error("[EditLesson] API PATCH failed:", err.response?.data || err.message);
         const msg = err.response?.data?.detail || (typeof err.response?.data === 'object' ? Object.entries(err.response.data).map(([k,v]) => `${k}: ${v}`).join(' | ') : 'Update failed.');
         setMessage(msg); setMessageType('error');
         if (err.response?.status === 401 || err.response?.status === 403) { logout(); router.push('/login'); }
    } finally { setSubmitting(false); console.log("[EditLesson] handleSave finished."); }
  };

  // --- Publish Handler ---
  const handlePublish = async () => {
    if (!permalink || lessonStatus === 'published' || isLocked || submitting || !editorReady) { return; }
     console.log("[EditLesson] handlePublish called.");
     if (isPremium && !selectedCourse) {setMessage('Premium need course.'); return;}
     const courseObj = courses.find(c => String(c.id) === String(selectedCourse));
     if (courseObj && courseObj.is_draft) {setMessage('Course is draft.'); return;}
    console.warn("[EditLesson] Publishing last saved version...");
    setSubmitting(true); setMessage('Publishing...');
    try {
        await apiClient.post(`/lessons/${encodeURIComponent(permalink)}/publish/`);
        setMessage('Published!'); setMessageType('success'); setLessonStatus('published');
    } catch (pubErr) {
        console.error('[EditLesson] Publish error:', pubErr.response?.data || pubErr.message);
        setMessage(`Publish failed: ${pubErr.response?.data?.detail || 'Error'}`); setMessageType('error');
    } finally { setSubmitting(false); }
  };


  // --- Render Logic ---
  if (loading && editorKey === 0) return <div className={styles.loading}>Loading...</div>;
  if (!loading && message && ownerUsername && user?.username !== ownerUsername) {
    return ( <div className={styles.pageContainer}><h2 className={styles.pageTitle}>Edit Lesson</h2><p className={`${styles.message} ${styles.error}`}>{message}</p></div> );
  }

  return (
    <div className={styles.pageContainer}>
      <h2 className={styles.pageTitle}>Edit Lesson</h2>
      {isLocked && <p className={`${styles.message} ${styles.warning}`}>Lesson locked.</p>}
      {message && <p className={`${styles.message} ${styles[messageType] || styles.error}`}>{message}</p>}

      <form className={styles.lessonForm} onSubmit={(e)=>e.preventDefault()}>
        {/* --- Fieldsets 1-4 --- */}
        <fieldset className={styles.formSection}><legend>Core Details</legend><div className={styles.formGrid}>
            <div className={styles.formGroup}> <label htmlFor="lessonTitle">Title *</label> <input id="lessonTitle" className={styles.inputField} type="text" value={title} onChange={e=>setTitle(e.target.value)} disabled={submitting||isLocked}/> </div>
            <div className={styles.formGroup}> <label htmlFor="lessonSubject">Subject *</label> <select id="lessonSubject" className={styles.selectField} value={subject} onChange={e=>setSubject(e.target.value)} disabled={submitting||isLocked}><option value="">Select...</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select> </div>
            <div className={styles.formGroup}> <label htmlFor="lessonVideoUrl">Video URL</label> <input id="lessonVideoUrl" className={styles.inputField} type="text" value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} disabled={submitting||isLocked}/> </div>
            <div className={styles.formGroup}> <label htmlFor="lessonTags">Tags</label> <input id="lessonTags" className={styles.inputField} type="text" value={tags} onChange={e=>setTags(e.target.value)} disabled={submitting||isLocked} placeholder="tag1, tag2"/> </div>
            <div className={styles.formGroup}> <label>Access</label> <div className={styles.inlineAccess}><label><input type="radio" name="access" value="free" checked={!isPremium} onChange={()=>setIsPremium(false)} disabled={submitting||isLocked}/><span className={styles.badgeFree}>Free</span></label><label><input type="radio" name="access" value="premium" checked={isPremium} onChange={()=>setIsPremium(true)} disabled={submitting||isLocked}/><span className={styles.badgePremium}>Premium</span></label></div>{isPremium ? <div className={styles.inlineNote}>Needs premium course.</div> : <div className={styles.inlineNote}>Standalone or free course.</div>}</div>
        </div></fieldset>
        {/* Section 2: Styling & Presentation
        <fieldset className={styles.formSection}><legend>Styling & Presentation</legend><div className={styles.formGrid}>
             <div className={styles.formGroup}> <label htmlFor="lessonBuiltInTemplate">Built-in Style</label> <select id="lessonBuiltInTemplate" className={styles.selectField} value={template} onChange={e=>setTemplate(e.target.value)} disabled={submitting||isLocked}><option value="modern">Modern</option><option value="minimal">Minimal</option><option value="dark">Dark</option></select> </div>
             <div className={styles.formGroup}> <label htmlFor="accentColor">Accent Color</label> <input id="accentColor" type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)} disabled={submitting||isLocked} className={styles.inputField}/> </div>
             <div className={`${styles.formGroup} ${styles.formGroupSpan2}`}> <label htmlFor="adminTemplateRef">Use Admin Template</label> <select id="adminTemplateRef" className={styles.selectField} value={selectedTemplateRef || ''} onChange={e=>setSelectedTemplateRef(e.target.value || null)} disabled={submitting||isLocked||lessonTemplates.length===0}><option value="">{lessonTemplates.length===0 ? 'None' : 'None (Use built-in)'}</option>{lessonTemplates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>{selectedTemplateRef && lessonTemplates.find(t => String(t.id) === String(selectedTemplateRef))?.description && (<p className={styles.templateDescription}>Selected: {lessonTemplates.find(t => String(t.id) === String(selectedTemplateRef))?.description}</p>)}</div>
             <div className={`${styles.formGroup} ${styles.fullWidth}`}> <label htmlFor="customCSS">Custom CSS</label> <textarea id="customCSS" rows="6" value={customCSS} onChange={e=>setCustomCSS(e.target.value)} disabled={submitting||isLocked} className={styles.inputField}></textarea> <p className={styles.fieldHelpText}>Overrides templates.</p> </div>
             <div className={`${styles.formGroup} ${styles.fullWidth}`}> <label htmlFor="customJS">Custom JS</label> <textarea id="customJS" rows="6" value={customJS} onChange={e=>setCustomJS(e.target.value)} disabled={submitting||isLocked} className={styles.inputField}></textarea> <p className={styles.fieldHelpText}>Lesson-specific JS.</p> </div>
        </div></fieldset>
         */}
        <fieldset className={styles.formSection}><legend>Attach to Course</legend><div className={styles.formGrid}>
            <div className={styles.formGroup}> <label htmlFor="attachCourseSelect">Course Attachment</label> <select id="attachCourseSelect" className={styles.selectField} value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} disabled={submitting||isLocked||courses.length===0}><option value="">{originalCourseId ? 'Detach' : 'Standalone'}</option>{filteredCourses.map(c=>(<option key={c.id} value={c.id}>{c.title}{c.is_draft ? ' (draft)' : ''}{c.course_type === 'premium' ? ' • Premium' : ''}</option>))}</select><p className={styles.fieldHelpText}>{isPremium ? 'Must attach to premium.' : 'Optional.'}</p>{!!selectedCourse && courses.find(c => String(c.id) === String(selectedCourse))?.is_draft && (<p className={styles.inlineNote}>Course is draft.</p>)}</div>
        </div></fieldset>
        <fieldset className={styles.formSection}><legend>Manage Quizzes</legend><div className={styles.addContentSection}>
            <div className={styles.contentSectionHeader}><h3>Select Quizzes</h3><button type="button" className={styles.createContentBtn} onClick={()=>setIsQuizModalOpen(true)} disabled={submitting||isLocked||!subject}>+ Create Quiz</button></div>
            <div className={styles.contentListArea}>{quizzes.length > 0 ? (<div className={styles.scrollableBox}>{quizzes.map(q=>( <div key={q.id} className={styles.contentItem}><input type="checkbox" id={`lesson-quiz-${q.id}`} checked={selectedQuizzes.includes(q.id)} onChange={()=>handleQuizToggle(q.id)} disabled={submitting || isLocked || (q.lesson && String(q.lesson) !== String(currentLessonId)) || q.course} /><label htmlFor={`lesson-quiz-${q.id}`}>{q.title}{((q.lesson && String(q.lesson) !== String(currentLessonId)) || q.course) ? <span className={styles.alreadyAttached}> (In use)</span>:''}</label></div> ))}</div>) : <p className={styles.noContentMessage}>No quizzes yet.</p>}</div>
            <p className={styles.fieldHelpText}>Check to attach.</p>
        </div></fieldset>


        {/* Section 5: Lesson Content Editor */}
        <fieldset className={styles.formSection}>
          <legend>Lesson Content *</legend>
          <div className={styles.editorContainer}>
             {/* Conditionally render */}
             {!loading && editorKey > 0 ? (
                 <LessonEditor
                   key={editorKey}
                   // *** Pass the ref instance directly ***
                   ref={editorRef}
                   initialContent={initialContent}
                   mediaCategory="lesson"
                   externalCss={customCSS}
                   // *** REMOVED onEditorReady prop ***
                 />
             ) : (
                <div className={styles.loading}>{loading ? 'Loading...' : 'Initializing...'}</div>
             )}
          </div>
        </fieldset>

        {/* Section 6: Live Preview */}
        <fieldset className={styles.formSection}>
            <legend>Live Preview</legend>
            <div className={styles.previewHeader}>
                 <p className={styles.fieldHelpText}>Preview content.</p>
                 <button type="button" onClick={updatePreview} className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`} disabled={submitting||isLocked || !editorReady}>Refresh Preview</button>
            </div>
            <div className={styles.previewIframeContainer}>
                <iframe ref={previewIframeRef} className={styles.previewIframe} title="Lesson Preview" sandbox="allow-scripts allow-same-origin" srcDoc={previewContent || "<p>Click 'Refresh Preview'</p>"}></iframe>
            </div>
        </fieldset>

        {/* --- Action Buttons --- */}
        <div className={styles.formActions}>
            <button type="button" onClick={handleSave} className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`} disabled={submitting || isLocked || !editorReady} title={!editorReady ? "Initializing..." : "Save"}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
           {lessonStatus === 'draft' && !isLocked && ( <button type="button" onClick={handlePublish} className={`${styles.zportaBtn} ${styles.zportaBtnWarning}`} disabled={submitting || !editorReady} title={!editorReady ? "Initializing..." : "Publish"}> {submitting ? 'Saving...' : 'Publish'} </button> )}
        </div>
      </form>

      {/* --- Modals --- */}
      <Modal isOpen={isQuizModalOpen} onClose={()=>setIsQuizModalOpen(false)} title="Create New Quiz">
        <CreateQuiz onSuccess={handleQuizCreated} onClose={()=>setIsQuizModalOpen(false)} isModalMode={true} initialSubjectId={subject || (subjects.length>0 ? String(subjects[0].id) : null)} />
      </Modal>
    </div>
  );
}

