import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useRouter } from 'next/router';
import CustomEditor from '@/components/Editor/CustomEditor';
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';
import styles from '@/styles/admin/CreateCourse.module.css';
import Modal from '@/components/Modal/Modal';
import CreateLesson from '@/components/admin/CreateLesson';
import CreateQuiz from '@/components/admin/CreateQuiz';

// --- Helper Components ---
const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

const CoursePreview = ({ courseData, coverImagePreview }) => (
    <div className={styles.previewContainer}>
        <h3 className={styles.previewTitle}>Live Preview</h3>
        <div className={styles.previewCard}>
            <div className={styles.previewImageContainer}>
                {coverImagePreview ? (
                    <img src={coverImagePreview} alt="Course Preview" className={styles.previewImage} />
                ) : (
                    <div className={styles.previewImagePlaceholder}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        <span>Cover Image</span>
                    </div>
                )}
            </div>
            <div className={styles.previewContent}>
                <h4 className={styles.previewCourseTitle}>{courseData.title || 'Your Course Title'}</h4>
                <p className={styles.previewCourseSubject}>{courseData.subjectName || 'Subject'}</p>
                <div className={styles.previewPriceBadge} data-type={courseData.courseType || 'free'}>
                    {courseData.courseType === 'premium' ? `$${parseFloat(courseData.price || 0).toFixed(2)}` : 'Free'}
                </div>
                <div className={styles.previewDescription} dangerouslySetInnerHTML={{ __html: courseData.description || '<p>Your course description will appear here...</p>' }} />
            </div>
        </div>
    </div>
);


const CreateCourse = () => {
    // --- State Management ---
    const [currentStep, setCurrentStep] = useState(1);
    const [savedSteps, setSavedSteps] = useState([]);
    
    // Course Data - ALL held in state until the final save
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [subject, setSubject] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [selectedLessons, setSelectedLessons] = useState([]);
    const [coverImage, setCoverImage] = useState(null);
    const [coverImagePreview, setCoverImagePreview] = useState(null);
    const [courseType, setCourseType] = useState('free');
    const [price, setPrice] = useState('0.00');
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuizzes, setSelectedQuizzes] = useState([]);
    const [isDraft, setIsDraft] = useState(true);
    const [testers, setTesters] = useState('');

    // UI State
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('error');
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState(false);


    // --- Hooks and Refs ---
    const router = useRouter();
    const editorRef = useRef(null);
    const { logout } = useContext(AuthContext);
    const fileInputRef = useRef(null);
    
    const STEPS = [
        { id: 1, title: 'Course Details' },
        { id: 2, title: 'Description' },
        { id: 3, title: 'Add Lessons' },
        { id: 4, title: 'Add Quizzes' },
        { id: 5, title: 'Publish' }
    ];

    // --- Data Fetching ---
    const fetchInitialData = useCallback(async () => {
        setLoadingInitial(true);
        setMessage('');
        try {
            const [subjectsRes, lessonsRes, quizzesRes] = await Promise.all([
                apiClient.get('/subjects/'),
                apiClient.get('/lessons/my/'),
                apiClient.get('/quizzes/my/')
            ]);
            setSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
            setLessons(Array.isArray(lessonsRes.data) ? lessonsRes.data : []);
            setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);
        } catch (error) {
            handleApiError(error, 'Failed to load required data. Please try refreshing.');
        } finally {
            setLoadingInitial(false);
        }
    }, [logout]);

    useEffect(() => {
        if (localStorage.getItem('token')) {
            fetchInitialData();
        } else {
            router.push('/login');
        }
    }, [fetchInitialData, router]);

    const refreshContentLists = useCallback(async () => {
         try {
            const [lessonsRes, quizzesRes] = await Promise.all([
                apiClient.get('/lessons/my/'),
                apiClient.get('/quizzes/my/')
            ]);
            setLessons(Array.isArray(lessonsRes.data) ? lessonsRes.data : []);
            setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);
        } catch (error) {
            handleApiError(error, 'Failed to refresh lesson/quiz lists.');
        }
    }, [logout]);


    // --- Event Handlers ---
    const handleInputChange = (setter) => (e) => {
        setter(e.target.value);
        setUnsavedChanges(true);
    };

    const handleCoverImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showFeedback('Cover image cannot exceed 5MB.', 'error');
            return;
        }
        setCoverImage(file);
        const reader = new FileReader();
        reader.onloadend = () => setCoverImagePreview(reader.result);
        reader.readAsDataURL(file);
        setUnsavedChanges(true);
    };

    const clearCoverImage = () => {
        setCoverImage(null);
        setCoverImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = null;
        setUnsavedChanges(true);
    };

    const handleContentToggle = (id, selectedItems, setSelectedItems) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
        setUnsavedChanges(true);
    };

    const handleLessonCreated = (newLesson) => {
        setIsLessonModalOpen(false);
        showFeedback(`Lesson "${newLesson?.title || 'New Lesson'}" created! You can now select it.`, 'success');
        refreshContentLists();
    };

    const handleQuizCreated = (newQuiz) => {
        setIsQuizModalOpen(false);
        showFeedback(`Quiz "${newQuiz?.title || 'New Quiz'}" created! You can now select it.`, 'success');
        refreshContentLists();
    };

    // --- Navigation and Saving Logic ---
    const handleStepContinue = () => {
        // Always validate the current step to save its state before proceeding.
        // This is crucial for the editor, which doesn't use the 'unsavedChanges' flag.
        if (!validateCurrentStep()) return;
        
        markStepAsSaved(currentStep);
        if (currentStep < STEPS.length) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleFinalSave = () => {
        // Validate all previous steps before final submission
        for (let i = 1; i <= STEPS.length; i++) {
            if (!validateCurrentStep(i)) {
                setCurrentStep(i); // Switch to the step with the error
                return;
            }
        }
        createCourseInBackend();
    };
    
    // The ONLY function that interacts with the backend to CREATE the course
    const createCourseInBackend = async () => {
        setSubmitting(true);
        showFeedback('Saving course...', 'info');

        const formData = createCourseFormData();
        
        if (!isDraft) {
            formData.append('publish', 'true');
            const testerList = testers.split(',').map(t => t.trim()).filter(Boolean);
            testerList.forEach(t => formData.append('allowed_testers', t));
        }
        
        try {
            const response = await apiClient.post('/courses/', formData);
            const coursePermalink = response.data.permalink;

            if (!coursePermalink) {
                throw new Error("Failed to get course identifier after creation.");
            }
            
            showFeedback('Course created! Attaching content...', 'info');

            const attachmentPromises = [
                ...selectedLessons.map(id => apiClient.post(`/courses/${coursePermalink}/add-lesson/`, { lesson_id: id }).catch(e => ({ type: 'Lesson', id, error: e }))),
                ...selectedQuizzes.map(id => apiClient.post(`/courses/${coursePermalink}/add-quiz/`, { quiz_id: id }).catch(e => ({ type: 'Quiz', id, error: e })))
            ];
            
            let attachmentErrors = [];
            if (attachmentPromises.length > 0) {
                 const results = await Promise.allSettled(attachmentPromises);
                 results.forEach(result => {
                    if (result.status === 'rejected' || result.value?.error) {
                         const failedItem = result.status === 'rejected' ? result.reason : result.value;
                         attachmentErrors.push(`${failedItem.type} (${failedItem.id})`);
                    }
                 });
            }

            if (attachmentErrors.length > 0) {
                 setMessage(`Course ${isDraft ? 'saved as draft' : 'published'}, but failed to attach: ${attachmentErrors.join(', ')}. Please edit the course to try again.`);
                 setMessageType('warning');
                 setTimeout(() => router.push(`/courses/${coursePermalink}`), 4000);
            } else {
                 setMessage(`Course ${isDraft ? 'saved as draft' : 'published'} successfully!`);
                 setMessageType('success');
                 setTimeout(() => {
                     router.push(`/courses/${coursePermalink}`);
                 }, 2000);
            }

        } catch (error) {
            handleApiError(error, 'An unexpected error occurred while creating the course.');
        } finally {
            setSubmitting(false);
        }
    };
    
    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
            setUnsavedChanges(false);
        }
    };
    
    const navigateToStep = (stepId) => {
        if (stepId < currentStep && savedSteps.includes(stepId)) {
            if (unsavedChanges) {
                showFeedback('Please save your changes by continuing before navigating back.', 'warning');
                return;
            }
            setCurrentStep(stepId);
        }
    };

    const markStepAsSaved = (stepId) => {
        if (!savedSteps.includes(stepId)) {
            setSavedSteps(prev => [...prev, stepId]);
        }
        setUnsavedChanges(false);
    };


    // --- Helpers & Validation ---
    const handleApiError = (error, defaultMessage) => {
        console.error("API Error:", error.response?.data || error.message);
        const errorMsg = extractErrorMessage(error);
        showFeedback(errorMsg || defaultMessage, 'error');
        if (error.response?.status === 401 || error.response?.status === 403) logout();
    };

    const showFeedback = (msg, type) => {
        setMessage(msg);
        setMessageType(type);
        if(type !== 'error') {
            setTimeout(() => setMessage(''), 4000);
        }
    };

    // Treat "<p><br></p>" and "&nbsp;" as empty
    const isEmptyHtml = (html) => {
        if (!html) return true;
        const text = html
          .replace(/<br\s*\/?>/gi, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/<[^>]*>/g, '')
          .trim();
        return text.length === 0;
    };

    const readEditorHtml = () => {
        // Prefer state. Fall back to ref if state is empty and ref has content.
        const viaState = description ?? '';
        if (!isEmptyHtml(viaState)) return viaState;
        const viaRef = editorRef.current?.getContent?.() ?? '';
        return viaRef;
    };

    const createCourseFormData = () => {
        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('subject', subject);
        if (coverImage) formData.append('cover_image', coverImage);
        formData.append('course_type', courseType);
        formData.append('price', courseType === 'premium' ? parseFloat(price).toFixed(2) : '0.00');

        const finalDescription = readEditorHtml();
        formData.append('description', finalDescription);
        return formData;
    };
    
    const validateCurrentStep = (stepToValidate = currentStep) => {
        let isValid = true;
        let errorMsg = '';
        switch (stepToValidate) {
            case 1:
                if (!title.trim()) errorMsg = 'Course Title is required.';
                else if (!subject) errorMsg = 'Please select a Subject.';
                else if (courseType === 'premium' && (!price || parseFloat(price) <= 0)) errorMsg = 'A valid Price is required for Premium courses.';
                break;
            case 2:
                // Use state first, then ref as fallback
                const html = readEditorHtml();
                if (isEmptyHtml(html)) {
                    errorMsg = 'Course Description cannot be empty.';
                } else {
                    // ensure state is synced for preview and final submit
                    if (html !== description) setDescription(html);
                }
                break;
            case 5:
                 const testerList = testers.split(',').map(t => t.trim()).filter(Boolean);
                 if (!isDraft && testerList.length > 3) errorMsg = 'You can only assign a maximum of 3 testers.';
                 break;
            default:
                break;
        }

        if (errorMsg) {
            showFeedback(errorMsg, 'error');
            isValid = false;
        }
        return isValid;
    };
    
    const extractErrorMessage = (error) => {
        if (!error.response?.data) return error.message;
        const data = error.response.data;
        if (typeof data === 'string') return data;
        if (typeof data === 'object') {
            return Object.entries(data)
                .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
                .join(' | ');
        }
        return 'An unknown error occurred.';
    };
    
    // --- Render Logic ---
    if (loadingInitial) {
        return <div className={styles.loading}>Loading Course Creator...</div>;
    }

    const subjectName = subjects.find(s => s.id == subject)?.name;
    const previewData = { title, subjectName, courseType, price, description };

    return (
        <div className={styles.createCoursePage}>
            <div className={styles.mainContent}>
                <div className={styles.header}>
                    <h2>Create New Course</h2>
                    <div className={styles.headerActions}>
                         <button onClick={() => router.push('/admin/dashboard')} className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}>Exit</button>
                    </div>
                </div>

                <div className={styles.stepper}>
                    {STEPS.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div
                                className={`${styles.stepItem} ${currentStep === step.id ? styles.active : ''} ${savedSteps.includes(step.id) ? styles.completed : ''}`}
                                onClick={() => navigateToStep(step.id)}
                            >
                                <div className={styles.stepCounter}>
                                    {savedSteps.includes(step.id) ? <CheckIcon /> : step.id}
                                </div>
                                <div className={styles.stepTitle}>{step.title}</div>
                            </div>
                            {index < STEPS.length - 1 && <div className={styles.stepConnector}></div>}
                        </React.Fragment>
                    ))}
                </div>

                {message && (
                    <p className={`${styles.message} ${styles[messageType]}`}>
                        {message}
                    </p>
                )}

                <div className={styles.stepContent}>
                    {/* Step 1: Course Details */}
                    {currentStep === 1 && (
                        <div className={styles.formSection}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="courseTitle">Title <span className={styles.required}>*</span></label>
                                    <input id="courseTitle" type="text" value={title} onChange={handleInputChange(setTitle)} placeholder="e.g., Introduction to Web Development" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="courseSubject">Subject <span className={styles.required}>*</span></label>
                                    <select id="courseSubject" value={subject} onChange={handleInputChange(setSubject)}>
                                        <option value="">Select a Subject</option>
                                        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="courseType">Type <span className={styles.required}>*</span></label>
                                    <select id="courseType" value={courseType} onChange={handleInputChange(setCourseType)}>
                                        <option value="free">Free</option>
                                        <option value="premium">Premium</option>
                                    </select>
                                </div>
                                {courseType === "premium" && (
                                    <div className={styles.formGroup}>
                                        <label htmlFor="coursePrice">Price ($) <span className={styles.required}>*</span></label>
                                        <input id="coursePrice" type="number" value={price} onChange={handleInputChange(setPrice)} step="0.01" min="0.01" placeholder="e.g., 19.99" />
                                    </div>
                                )}
                            </div>
                             <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                                <label htmlFor="coverImage">Cover Image (Optional, max 5MB)</label>
                                <input id="coverImage" type="file" ref={fileInputRef} accept="image/jpeg, image/png, image/webp" onChange={handleCoverImageChange} style={{ display: 'none' }} />
                                <div className={styles.fileInputArea}>
                                    <button type="button" className={styles.fileInputButton} onClick={() => fileInputRef.current?.click()}>
                                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                        Upload Image
                                    </button>
                                     {coverImagePreview && (
                                        <div className={styles.imagePreviewContainer}>
                                            <img src={coverImagePreview} alt="Cover preview" className={styles.imagePreview} />
                                            <span className={styles.fileName}>{coverImage?.name}</span>
                                            <button type="button" onClick={clearCoverImage} className={styles.clearImageButton} title="Remove image">&times;</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Description */}
                    {currentStep === 2 && (
                         <div className={styles.formSection}>
                            <label>Course Description <span className={styles.required}>*</span></label>
                            <div className={styles.editorContainer}>
                                <CustomEditor
                                    ref={editorRef}
                                    mediaCategory="course"
                                    /* Keep editor and preview in sync */
                                    onChange={(html) => {
                                        setDescription(html ?? '');
                                        setUnsavedChanges(true);
                                    }}
                                    /* Remove if your CustomEditor doesn't support value */
                                    value={description}
                                />
                            </div>
                        </div>
                    )}
                    
                    {/* Step 3: Add Lessons */}
                    {currentStep === 3 && (
                        <div className={styles.formSection}>
                             <div className={styles.contentSectionHeader}>
                                <h3>Available Lessons</h3>
                                <button type="button" onClick={() => setIsLessonModalOpen(true)} className={styles.createContentBtn}>+ Create New Lesson</button>
                            </div>
                             <div className={styles.contentListArea}>
                                {lessons.length > 0 ? (
                                    <div className={styles.scrollableBox}>
                                        {lessons.map((lesson) => (
                                            <div key={lesson.id} className={styles.contentItem}>
                                                <input type="checkbox" id={`lesson-${lesson.id}`} checked={selectedLessons.includes(lesson.id)} onChange={() => handleContentToggle(lesson.id, selectedLessons, setSelectedLessons)} disabled={!!lesson.course}/>
                                                <label htmlFor={`lesson-${lesson.id}`}>{lesson.title}{lesson.course ? <span className={styles.alreadyAttached}> (In another course)</span> : ""}</label>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className={styles.noContentMessage}>No lessons created yet. Click &apos;Create New Lesson&apos; to start.</p>}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Add Quizzes */}
                    {currentStep === 4 && (
                        <div className={styles.formSection}>
                             <div className={styles.contentSectionHeader}>
                                <h3>Available Quizzes</h3>
                                <button type="button" onClick={() => setIsQuizModalOpen(true)} className={styles.createContentBtn}>+ Create New Quiz</button>
                            </div>
                             <div className={styles.contentListArea}>
                                {quizzes.length > 0 ? (
                                    <div className={styles.scrollableBox}>
                                        {quizzes.map((quiz) => (
                                            <div key={quiz.id} className={styles.contentItem}>
                                                <input type="checkbox" id={`quiz-${quiz.id}`} checked={selectedQuizzes.includes(quiz.id)} onChange={() => handleContentToggle(quiz.id, selectedQuizzes, setSelectedQuizzes)} disabled={!!quiz.course || !!quiz.lesson} />
                                                <label htmlFor={`quiz-${quiz.id}`}>{quiz.title}{(quiz.course || quiz.lesson) ? <span className={styles.alreadyAttached}> (In use)</span> : ""}</label>
                                            </div>
                                        ))}
                                    </div>
                                 ) : <p className={styles.noContentMessage}>No quizzes created yet. Click &apos;Create New Quiz&apos; to start.</p>}
                            </div>
                        </div>
                    )}

                    {/* Step 5: Publish */}
                    {currentStep === 5 && (
                        <div className={styles.formSection}>
                            <div className={styles.formGroup}>
                                <label>Final Review</label>
                                <p className={styles.reviewText}>You&apos;re about to create this course. Review the details in the live preview. You can save it as a draft to hide it from students, or publish it to make it live.</p>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Course Status <span className={styles.required}>*</span></label>
                                <div className={styles.radioGroup}>
                                    <label className={styles.radioLabel}>
                                        <input type="radio" name="status" value="draft" checked={isDraft} onChange={() => { setIsDraft(true); }}/>
                                        Save as Draft
                                    </label>
                                    <label className={styles.radioLabel}>
                                        <input type="radio" name="status" value="published" checked={!isDraft} onChange={() => { setIsDraft(false); }}/>
                                        Publish Course
                                    </label>
                                </div>
                            </div>
                             <div className={styles.formGroup}>
                                <label htmlFor="testers">Assign Testers for Published Course (Optional, up to 3)</label>
                                <input id="testers" type="text" placeholder="Usernames, comma-separated" value={testers} onChange={handleInputChange(setTesters)} disabled={isDraft} />
                                {isDraft && <small className={styles.fieldNote}>Testers can only be assigned when publishing.</small>}
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.navigationActions}>
                    <button onClick={handlePrevStep} className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`} disabled={currentStep === 1 || submitting}>
                        Back
                    </button>
                    {currentStep < STEPS.length ? (
                         <button onClick={handleStepContinue} className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`} disabled={submitting}>
                             {unsavedChanges ? 'Save & Continue' : 'Continue'}
                         </button>
                    ) : (
                         <button onClick={handleFinalSave} className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`} disabled={submitting}>
                            {submitting ? 'Saving...' : (isDraft ? 'Save Draft' : 'Publish Course')}
                        </button>
                    )}
                </div>
            </div>
            <div className={styles.sidebar}>
                <CoursePreview courseData={previewData} coverImagePreview={coverImagePreview} />
            </div>

            {/* --- Modals --- */}
            <Modal isOpen={isLessonModalOpen} onClose={() => setIsLessonModalOpen(false)} title="Create New Lesson">
                <CreateLesson onSuccess={handleLessonCreated} onClose={() => setIsLessonModalOpen(false)} isModalMode={true} />
            </Modal>
            <Modal isOpen={isQuizModalOpen} onClose={() => setIsQuizModalOpen(false)} title="Create New Quiz">
                <CreateQuiz onSuccess={handleQuizCreated} onClose={() => setIsQuizModalOpen(false)} isModalMode={true} />
            </Modal>
        </div>
    );
};

export default CreateCourse;

