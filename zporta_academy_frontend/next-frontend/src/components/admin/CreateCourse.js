import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useRouter } from 'next/router';
import CustomEditor from '@/components/Editor/CustomEditor';
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';
import styles from '@/styles/admin/CreateCourse.module.css';
import Modal from '@/components/Modal/Modal';
import CreateLesson from '@/components/admin/CreateLesson';
import CreateQuiz from '@/components/admin/CreateQuiz';


const CreateCourse = () => {
    // State for course details
    const [title, setTitle] = useState('');
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [subject, setSubject] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [selectedLessons, setSelectedLessons] = useState([]);
    const [coverImage, setCoverImage] = useState(null);
    const [coverImagePreview, setCoverImagePreview] = useState(null); // For preview
    const [courseType, setCourseType] = useState('free');
    const [price, setPrice] = useState('0.00');
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuizzes, setSelectedQuizzes] = useState([]);
    const [isDraft, setIsDraft] = useState(true);
    const [testers, setTesters] = useState(''); // Keep as single string for input

    // State for UI feedback
    const [loadingInitial, setLoadingInitial] = useState(true); // Initial data load
    const [submitting, setSubmitting] = useState(false);       // Form submission
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('error'); // 'error' or 'success'

    const router = useRouter();
    const editorRef = useRef(null);
    const { logout } = useContext(AuthContext);
    const fileInputRef = useRef(null); // Ref for file input

    // --- Data Fetching Logic ---
    const fetchCourseData = useCallback(async (showLoading = true) => {
      if (showLoading) setLoadingInitial(true);
      setMessage('');
      try {
          const [subjectsRes, lessonsRes, quizzesRes] = await Promise.all([
              apiClient.get('/subjects/'),
              apiClient.get('/lessons/my/'), // Assuming endpoint for lessons available to be added
              apiClient.get('/quizzes/my/')  // Assuming endpoint for quizzes available to be added
          ]);

          setSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
          setLessons(Array.isArray(lessonsRes.data) ? lessonsRes.data : []);
          setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);

      } catch (error) {
          console.error("Error fetching initial data:", error.response?.data || error.message);
          setMessage('Failed to load required data. Please try refreshing.');
          setMessageType('error');
          if (error.response?.status === 401 || error.response?.status === 403) logout();
      } finally {
          if (showLoading) setLoadingInitial(false);
      }
    }, [logout]);

    // Fetch subjects, lessons, and quizzes on mount
    useEffect(() => {
      if (localStorage.getItem('token')) {
          fetchCourseData(true);
      } else {
          setMessage("Please log in to create a course.");
          setMessageType('error');
          setLoadingInitial(false);
          router.push('/login');
      }
    }, [fetchCourseData, router]);

    // Refresh lists (lessons/quizzes) without full page loading
    const refreshContentLists = useCallback(async () => {
        setMessage('');
        try {
            const [lessonsRes, quizzesRes] = await Promise.all([
                apiClient.get('/lessons/my/'),
                apiClient.get('/quizzes/my/')
            ]);
            setLessons(Array.isArray(lessonsRes.data) ? lessonsRes.data : []);
            setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);
        } catch (error) {
            console.error("Error refreshing content lists:", error.response?.data || error.message);
            setMessage('Failed to refresh lesson/quiz lists.');
            setMessageType('error');
            if (error.response?.status === 401 || error.response?.status === 403) logout();
        }
    }, [logout]);


    // Toggle lesson selection
    const handleLessonToggle = (lessonId) => {
        setSelectedLessons(prev =>
            prev.includes(lessonId) ? prev.filter(id => id !== lessonId) : [...prev, lessonId]
        );
    };

    // Toggle quiz selection
    const handleQuizToggle = (quizId) => {
        setSelectedQuizzes(prev =>
            prev.includes(quizId) ? prev.filter(id => id !== quizId) : [...prev, quizId]
        );
    };

    // Handle cover image change and preview
    const handleCoverImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setMessage('Cover image cannot exceed 5MB.');
                setMessageType('error');
                return;
            }
            setCoverImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            setCoverImage(null);
            setCoverImagePreview(null);
        }
    };

    // Clear cover image
    const clearCoverImage = () => {
        setCoverImage(null);
        setCoverImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = null; // Reset file input
        }
    };

    const handleLessonCreated = (newLesson) => {
      setIsLessonModalOpen(false);
      setMessage(`Lesson "${newLesson?.title || 'New Lesson'}" created successfully!`);
      setMessageType('success');
      refreshContentLists(); // Refresh lists
      if (newLesson?.id) { // Optionally auto-select
         setSelectedLessons(prev => [...prev, newLesson.id]);
      }
      setTimeout(() => setMessage(''), 3000);
    };

    const handleQuizCreated = (newQuiz) => {
      setIsQuizModalOpen(false);
      setMessage(`Quiz "${newQuiz?.title || 'New Quiz'}" created successfully!`);
      setMessageType('success');
      refreshContentLists(); // Refresh lists
      if (newQuiz?.id) { // Optionally auto-select
          setSelectedQuizzes(prev => [...prev, newQuiz.id]);
      }
      setTimeout(() => setMessage(''), 3000);
    };

    // Save Course Handler
    const handleSaveCourse = async () => {
        setMessage('');
        setMessageType('error');

        if (!localStorage.getItem('token')) {
            setMessage('Authentication error. Please log in again.'); router.push('/login'); return;
        }
        const editorContent = editorRef.current?.getContent();
        if (!title.trim()) { setMessage('Course Title is required.'); return; }
        if (!subject) { setMessage('Please select a Subject.'); return; }
        if (!editorContent || !editorContent.trim()) { setMessage('Course Description cannot be empty.'); return; }
        if (courseType === 'premium' && (!price || parseFloat(price) <= 0)) { setMessage('Valid Price is required for Premium courses.'); return; }
        
        const testerList = testers.split(',').map(t => t.trim()).filter(Boolean);
        if (testerList.length > 3) { setMessage('You can only assign a maximum of 3 testers.'); return; }

        setSubmitting(true);

        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('description', editorContent);
        formData.append('subject', subject);
        formData.append('is_draft', isDraft);
        formData.append('course_type', courseType);
        formData.append('price', courseType === 'premium' ? parseFloat(price).toFixed(2) : '0.00');
        if (coverImage) formData.append('cover_image', coverImage);

        let courseData = null;
        let attachmentErrors = [];

        try {
            setMessage('Creating course...');
            const response = await apiClient.post('/courses/', formData);
            courseData = response.data;
            const coursePermalink = courseData?.permalink;

            if (!coursePermalink) {
                throw new Error("Failed to get course identifier after creation.");
            }
            
            setMessage('Course base created! Attaching items...');

            const attachmentPromises = [];

            if (selectedLessons.length > 0) {
                 selectedLessons.forEach(lessonId => {
                    attachmentPromises.push(
                        apiClient.post(`/courses/${coursePermalink}/add-lesson/`, { lesson_id: lessonId })
                            .catch(err => ({ type: 'Lesson', id: lessonId, error: err }))
                    );
                });
            }

            if (selectedQuizzes.length > 0) {
                 selectedQuizzes.forEach(quizId => {
                    attachmentPromises.push(
                        apiClient.post(`/courses/${coursePermalink}/add-quiz/`, { quiz_id: quizId })
                            .catch(err => ({ type: 'Quiz', id: quizId, error: err }))
                    );
                });
            }

            if (testerList.length > 0 && !isDraft) {
                 attachmentPromises.push(
                    apiClient.post(`/courses/${coursePermalink}/assign-testers/`, { testers: testerList })
                        .catch(err => ({ type: 'Testers', id: testerList.join(', '), error: err }))
                 );
            }

            if (attachmentPromises.length > 0) {
                setMessage('Attaching Lessons/Quizzes/Testers...');
                const results = await Promise.allSettled(attachmentPromises);
                results.forEach(result => {
                    if (result.status === 'rejected') {
                        const failedItem = result.reason;
                        console.error(`Error attaching ${failedItem.type} ${failedItem.id}:`, failedItem.error?.response?.data || failedItem.error?.message);
                        attachmentErrors.push(`${failedItem.type} (${failedItem.id || 'item'})`);
                    }
                });
            }

            if (attachmentErrors.length > 0) {
                setMessage(`Course ${isDraft ? 'saved as draft' : 'published'}, but failed to attach/assign: ${attachmentErrors.join(', ')}. You can edit the course to try again.`);
                setMessageType('error'); 
                setTimeout(() => router.push(`/admin/courses/edit/${coursePermalink}`), 4000);
            } else {
                setMessage(`Course ${isDraft ? 'saved as draft' : 'published'} successfully!`);
                setMessageType('success');
                setTimeout(() => {
                    if (isDraft) {
                        router.push(`/admin/courses/edit/${coursePermalink}`);
                    } else {
                        router.push(`/courses/${coursePermalink}`);
                    }
                }, 2000);
            }

        } catch (error) {
            console.error('Error during course save process:', error.response ? error.response.data : error.message);
            let errorMsg = 'Failed to create course.';
            if (error.response?.data) {
                 if (typeof error.response.data === 'object' && error.response.data !== null) {
                    errorMsg = Object.entries(error.response.data)
                                     .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : String(messages)}`)
                                     .join(' | ');
                 } else if (typeof error.response.data === 'string') {
                    errorMsg = error.response.data;
                 }
            } else if (error.message) {
                 errorMsg = error.message;
            }
            setMessage(errorMsg);
            setMessageType('error');
            if (error.response?.status === 401 || error.response?.status === 403) logout();
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingInitial) {
        return <div className={styles.loading}>Loading course creation tools...</div>;
    }

    return (
        <div className={styles.createCourseContainer}>
            <h2>Create New Course</h2>

            {message && (
                <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
                    {message}
                </p>
            )}

            <form className={styles.courseForm} onSubmit={(e) => e.preventDefault()}>

                {/* Section 1: Course Details */}
                <fieldset className={styles.formSection}>
                    <legend>Course Details</legend>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label htmlFor="courseTitle">Title <span className={styles.required}>*</span></label>
                            <input
                                id="courseTitle"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                disabled={submitting}
                                placeholder="e.g., Introduction to Web Development"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="courseSubject">Subject <span className={styles.required}>*</span></label>
                            <select
                                id="courseSubject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                required
                                disabled={submitting}
                            >
                                <option value="">Select a Subject</option>
                                {subjects.map((subj) => (
                                    <option key={subj.id} value={subj.id}>
                                        {subj.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="courseType">Type <span className={styles.required}>*</span></label>
                            <select
                                id="courseType"
                                value={courseType}
                                onChange={(e) => setCourseType(e.target.value)}
                                required
                                disabled={submitting}
                            >
                                <option value="free">Free</option>
                                <option value="premium">Premium</option>
                            </select>
                        </div>

                        {courseType === "premium" && (
                            <div className={styles.formGroup}>
                                <label htmlFor="coursePrice">Price <span className={styles.required}>*</span></label>
                                <input
                                    id="coursePrice"
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    step="0.01"
                                    min="0.01"
                                    required
                                    disabled={submitting}
                                    placeholder="e.g., 19.99"
                                />
                            </div>
                        )}

                         <div className={styles.formGroup}>
                             <label htmlFor="coverImage">Cover Image (Optional, max 5MB)</label>
                             <input
                                 id="coverImage"
                                 type="file"
                                 ref={fileInputRef}
                                 accept="image/jpeg, image/png, image/webp"
                                 onChange={handleCoverImageChange}
                                 disabled={submitting}
                                 style={{ display: 'none' }}
                             />
                             <button
                                 type="button"
                                 className={styles.fileInputButton}
                                 onClick={() => fileInputRef.current?.click()}
                                 disabled={submitting}
                             >
                                 Choose Image
                             </button>
                             {coverImagePreview && (
                                <div className={styles.imagePreviewContainer}>
                                    <img src={coverImagePreview} alt="Cover preview" className={styles.imagePreview} />
                                    <button type="button" onClick={clearCoverImage} className={styles.clearImageButton} disabled={submitting} title="Remove image">
                                        &times;
                                    </button>
                                    <span className={styles.fileName}>{coverImage?.name}</span>
                                </div>
                             )}
                             {!coverImagePreview && coverImage && (
                                 <span className={styles.fileName}>{coverImage.name}</span>
                             )}
                         </div>
                    </div>
                </fieldset>

                {/* Section 2: Content (Description) */}
                <fieldset className={styles.formSection}>
                    <legend>Course Description <span className={styles.required}>*</span></legend>
                    <div className={styles.editorContainer}>
                         {!submitting && <CustomEditor ref={editorRef} mediaCategory="course" />}
                         {submitting && <div className={styles.editorPlaceholder}>Editor disabled during submission.</div>}
                    </div>
                </fieldset>


                {/* Section 3: Lessons & Quizzes */}
                <fieldset className={styles.formSection}>
                     <legend>Attach Content</legend>
                     <div className={styles.contentSelectionGrid}>
                              {/* Lessons Selection */}
                              <div className={styles.addContentSection}>
                                  <div className={styles.contentSectionHeader}>
                                      <h3>Available Lessons</h3>
                                      <button
                                          type="button"
                                          onClick={() => setIsLessonModalOpen(true)}
                                          className={styles.createContentBtn}
                                          disabled={submitting}
                                      >
                                          + Create New Lesson
                                      </button>
                                  </div>
                                  <div className={styles.contentListArea}>
                                      {lessons.length > 0 ? (
                                          <div className={styles.scrollableBox}>
                                              {lessons.map((lesson) => (
                                                  <div key={lesson.id} className={styles.contentItem}>
                                                      <input
                                                          type="checkbox"
                                                          id={`lesson-${lesson.id}`}
                                                          checked={selectedLessons.includes(lesson.id)}
                                                          onChange={() => handleLessonToggle(lesson.id)}
                                                          disabled={submitting || !!lesson.course} // Disable if part of ANY course
                                                      />
                                                      <label htmlFor={`lesson-${lesson.id}`}>
                                                          {lesson.title}
                                                          {lesson.course ? <span className={styles.alreadyAttached}> (In another course)</span> : ""}
                                                      </label>
                                                  </div>
                                              ))}
                                          </div>
                                      ) : (
                                          <p className={styles.noContentMessage}>No lessons available or created yet.</p>
                                      )}
                                  </div>
                              </div>
                              
                              {/* Quizzes Selection */}
                              <div className={styles.addContentSection}>
                                  <div className={styles.contentSectionHeader}>
                                      <h3>Available Quizzes</h3>
                                      <button
                                          type="button"
                                          onClick={() => setIsQuizModalOpen(true)}
                                          className={styles.createContentBtn}
                                          disabled={submitting}
                                      >
                                          + Create New Quiz
                                      </button>
                                  </div>
                                  <div className={styles.contentListArea}>
                                      {quizzes.length > 0 ? (
                                          <div className={styles.scrollableBox}>
                                              {quizzes.map((quiz) => (
                                                  <div key={quiz.id} className={styles.contentItem}>
                                                      <input
                                                          type="checkbox"
                                                          id={`quiz-${quiz.id}`}
                                                          checked={selectedQuizzes.includes(quiz.id)}
                                                          onChange={() => handleQuizToggle(quiz.id)}
                                                          disabled={submitting || !!quiz.course || !!quiz.lesson} // Disable if part of ANY course or lesson
                                                      />
                                                      <label htmlFor={`quiz-${quiz.id}`}>
                                                          {quiz.title}
                                                          {(quiz.course || quiz.lesson) ? <span className={styles.alreadyAttached}> (In use)</span> : ""}
                                                      </label>
                                                  </div>
                                              ))}
                                          </div>
                                      ) : (
                                          <p className={styles.noContentMessage}>No quizzes available or created yet.</p>
                                      )}
                                  </div>
                              </div>
                     </div>
                </fieldset>


                {/* Section 4: Settings */}
                <fieldset className={styles.formSection}>
                    <legend>Settings</legend>
                     <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                             <label htmlFor="testers">Assign Testers (Optional, up to 3)</label>
                             <input
                                 id="testers"
                                 type="text"
                                 placeholder="Usernames, comma-separated (e.g., user1, test_user2)"
                                 value={testers}
                                 onChange={(e) => setTesters(e.target.value)}
                                 disabled={submitting || isDraft}
                             />
                              {isDraft && <small className={styles.fieldNote}>Testers can only be assigned when publishing the course.</small>}
                         </div>

                         <div className={styles.formGroup}>
                             <label>Course Status <span className={styles.required}>*</span></label>
                             <div className={styles.radioGroup}>
                                 <label className={styles.radioLabel}>
                                     <input
                                         type="radio"
                                         name="courseStatus"
                                         value="draft"
                                         checked={isDraft === true}
                                         onChange={() => setIsDraft(true)}
                                         disabled={submitting}
                                     />
                                     Save as Draft
                                 </label>
                                 <label className={styles.radioLabel}>
                                     <input
                                         type="radio"
                                         name="courseStatus"
                                         value="published"
                                         checked={isDraft === false}
                                         onChange={() => setIsDraft(false)}
                                         disabled={submitting}
                                     />
                                     Publish Course
                                 </label>
                             </div>
                         </div>
                     </div>
                </fieldset>

                {/* Save Button Area */}
                <div className={styles.formActions}>
                    <button
                        type="button"
                        className={`${styles.zportaBtn} ${styles.zportaBtnPrimary} ${submitting ? styles.disabledBtn : ''}`}
                        onClick={handleSaveCourse}
                        disabled={submitting}
                    >
                        {submitting ? 'Saving...' : (isDraft ? 'Save Draft' : 'Publish Course')}
                    </button>
                </div>
            </form>

            <Modal isOpen={isLessonModalOpen} onClose={() => setIsLessonModalOpen(false)} title="Create New Lesson">
                <CreateLesson
                    onSuccess={handleLessonCreated}
                    onClose={() => setIsLessonModalOpen(false)}
                    isModalMode={true}
                />
            </Modal>

            <Modal isOpen={isQuizModalOpen} onClose={() => setIsQuizModalOpen(false)} title="Create New Quiz">
                <CreateQuiz
                    onSuccess={handleQuizCreated}
                    onClose={() => setIsQuizModalOpen(false)}
                    isModalMode={true}
                />
            </Modal>

        </div>
    );
};

export default CreateCourse;