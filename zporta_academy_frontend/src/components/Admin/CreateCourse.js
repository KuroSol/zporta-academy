import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomEditor from '../Editor/CustomEditor'; // Assuming path is correct
import apiClient from '../../api'; // Adjust path as needed
import { AuthContext } from '../../context/AuthContext'; // Adjust path as needed
import styles from './CreateCourse.module.css'; // <-- Import CSS Module
import Modal from '../Modal/Modal'; // Adjust path if Modal.js is elsewhere
import CreateLesson from './CreateLesson'; // Assumes CreateLesson.js is in the same folder
import CreateQuiz from './CreateQuiz';   // Assumes CreateQuiz.js is in the same folder


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

    const navigate = useNavigate();
    const editorRef = useRef(null);
    const { logout } = useContext(AuthContext);
    const fileInputRef = useRef(null); // Ref for file input

    // --- Data Fetching Logic ---
    // Wrap fetch logic in useCallback to avoid re-creating it on every render
    const fetchCourseData = useCallback(async (showLoading = true) => {
      // Keep only lesson/quiz fetching logic here for refreshing lists
      setMessage(''); // Clear previous messages
      try {
          // Fetch only lessons and quizzes as other course data is already in state
          const [lessonsRes, quizzesRes] = await Promise.all([
              apiClient.get('/lessons/my/'),
              apiClient.get('/quizzes/my/')
          ]);
          // Update only lessons and quizzes state
          const availableLessons = Array.isArray(lessonsRes.data) ? lessonsRes.data : [];
          setLessons(availableLessons);
          const availableQuizzes = Array.isArray(quizzesRes.data) ? quizzesRes.data : [];
          setQuizzes(availableQuizzes);

      } catch (error) {
          console.error("Error fetching course lists:", error.response?.data || error.message);
          setMessage('Failed to refresh lessons/quizzes. Please try again.');
          setMessageType('error');
          if (error.response?.status === 401) logout();
      } finally {
          // Only set loading if it was explicitly requested (for initial load)
          // This prevents the whole page showing 'loading' when just refreshing lists
          if (showLoading) setLoadingInitial(false);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logout]); // Add other stable dependencies if needed, like logout

    // Fetch subjects, lessons, and quizzes on mount
    useEffect(() => {
      // Initial fetch on mount
      if (localStorage.getItem('token')) {
          setLoadingInitial(true); // Set loading true for initial fetch
          // Fetch subjects separately only on the first load
          apiClient.get('/subjects/')
              .then(res => setSubjects(res.data || []))
              .catch(err => {
                   console.error("Failed to load subjects", err);
                   setMessage('Failed to load subject list.');
                   setMessageType('error');
               })
              .finally(() => {
                  // Fetch lessons/quizzes after subjects (or concurrently if independent)
                  // Pass true to show the loading indicator on initial load
                  fetchCourseData(true);
               });
      } else {
          setMessage("Please log in to create a course.");
          setMessageType('error');
          setLoadingInitial(false);
      }
    }, [fetchCourseData]); // Depend on the memoized fetch function

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

    // *** ADD Modal Handlers ***
    const handleLessonCreated = (newLesson) => {
      setIsLessonModalOpen(false); // Close modal
      setMessage(`Lesson "${newLesson?.title || 'New Lesson'}" created successfully!`); // Optional feedback
      setMessageType('success');
      fetchCourseData(false); // Re-fetch lessons/quizzes WITHOUT full page loading indicator
      // Optional: auto-select the new lesson
      // if (newLesson?.id) {
      //    setSelectedLessons(prev => [...prev, newLesson.id]);
      // }
      setTimeout(() => setMessage(''), 3000); // Clear message after a delay
    };

    const handleQuizCreated = (newQuiz) => {
      setIsQuizModalOpen(false); // Close modal
      setMessage(`Quiz "${newQuiz?.title || 'New Quiz'}" created successfully!`);
      setMessageType('success');
      fetchCourseData(false); // Re-fetch lessons/quizzes WITHOUT full page loading indicator
      // Optional: auto-select the new quiz
      // if (newQuiz?.id) {
      //    setSelectedQuizzes(prev => [...prev, newQuiz.id]);
      // }
      setTimeout(() => setMessage(''), 3000); // Clear message
    };

    // Save Course Handler
    const handleSaveCourse = async () => {
        setMessage('');
        setMessageType('error'); // Default to error

        // --- Basic Validation ---
        if (!localStorage.getItem('token')) {
            setMessage('Authentication error. Please log in again.'); navigate('/login'); return;
        }
        const editorContent = editorRef.current?.getContent();
        if (!title.trim()) { setMessage('Course Title is required.'); return; }
        if (!subject) { setMessage('Please select a Subject.'); return; }
        if (!editorContent || !editorContent.trim()) { setMessage('Course Description cannot be empty.'); return; }
        if (courseType === 'premium' && (!price || parseFloat(price) <= 0)) { setMessage('Valid Price is required for Premium courses.'); return; }
        // Add validation for tester format if needed (e.g., check for valid usernames/emails)
        const testerList = testers.split(',').map(t => t.trim()).filter(Boolean); // Get valid testers
        if (testerList.length > 3) { setMessage('You can only assign a maximum of 3 testers.'); return; }


        setSubmitting(true); // Start submission state

        // --- Prepare FormData ---
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
            // 1. Create the Course
            setMessage('Creating course...');
            const response = await apiClient.post('/courses/', formData);
            courseData = response.data;
            setMessage('Course created! Attaching items...'); // Intermediate success message

            const coursePermalink = courseData?.permalink;
            if (!coursePermalink) {
                throw new Error("Failed to get course identifier after creation.");
            }

            // Use Promise.allSettled for better error handling of attachments
            const attachmentPromises = [];

            // 2. Attach Lessons
            if (selectedLessons.length > 0) {
                 selectedLessons.forEach(lessonId => {
                    attachmentPromises.push(
                        apiClient.post(`/courses/${coursePermalink}/add-lesson/`, { lesson_id: lessonId })
                            .catch(err => ({ type: 'Lesson', id: lessonId, error: err }))
                    );
                });
            }

            // 3. Attach Quizzes
            if (selectedQuizzes.length > 0) {
                 selectedQuizzes.forEach(quizId => {
                    attachmentPromises.push(
                        apiClient.post(`/courses/${coursePermalink}/add-quiz/`, { quiz_id: quizId })
                            .catch(err => ({ type: 'Quiz', id: quizId, error: err }))
                    );
                });
            }

            // 4. Assign Testers (only if publishing and testers exist)
            if (testerList.length > 0 && !isDraft) {
                 attachmentPromises.push(
                    apiClient.post(`/courses/${coursePermalink}/assign-testers/`, { testers: testerList })
                        .catch(err => ({ type: 'Testers', id: testerList.join(', '), error: err }))
                 );
            }

            // Wait for all attachments/assignments to settle
            if (attachmentPromises.length > 0) {
                setMessage('Attaching Lessons/Quizzes/Testers...');
                const results = await Promise.allSettled(attachmentPromises);
                results.forEach(result => {
                    if (result.status === 'rejected') {
                        const failedItem = result.reason; // The object we created in .catch()
                        console.error(`Error attaching ${failedItem.type} ${failedItem.id}:`, failedItem.error?.response?.data || failedItem.error?.message);
                        attachmentErrors.push(`${failedItem.type} (${failedItem.id})`);
                    }
                });
            }


            // 5. Final Feedback and Navigation
            if (attachmentErrors.length > 0) {
                setMessage(`Course ${isDraft ? 'saved as draft' : 'published'}, but failed to attach/assign: ${attachmentErrors.join(', ')}.`);
                setMessageType('error'); // Indicate partial failure
                 // Navigate to edit page might be better UX here
                setTimeout(() => navigate(`/admin/courses/edit/${coursePermalink}`), 3000); // Redirect after delay
            } else {
                setMessage(`Course ${isDraft ? 'saved as draft' : 'published'} successfully!`);
                setMessageType('success');
                setTimeout(() => {
                    if (isDraft) {
                        navigate(`/admin/courses/edit/${coursePermalink}`);
                    } else {
                         navigate(`/courses/${coursePermalink}`); // Go to the published course page
                    }
                }, 2000); // Redirect after delay
            }

        } catch (error) {
            // Handle error during initial course creation or major failure
            console.error('Error during course save process:', error.response ? error.response.data : error.message);
            let errorMsg = 'Failed to create course.';
            if (error.response?.data) {
                // Try to extract specific field errors from backend response
                 if (typeof error.response.data === 'object' && error.response.data !== null) {
                    errorMsg = Object.entries(error.response.data)
                                     .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
                                     .join(' | ');
                 } else if (typeof error.response.data === 'string') {
                    errorMsg = error.response.data;
                 }
            } else if (error.message) {
                 errorMsg = error.message; // Use error message if no response data
            }
            setMessage(errorMsg);
            setMessageType('error');
            if (error.response?.status === 401 || error.response?.status === 403) logout();
        } finally {
            setSubmitting(false); // Re-enable button etc.
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

            <form className={styles.courseForm} onSubmit={(e) => e.preventDefault()}> {/* Prevent default form submission */}

                {/* Section 1: Course Details */}
                <fieldset className={styles.formSection}>
                    <legend>Course Details</legend>
                    <div className={styles.formGrid}> {/* Use grid for alignment */}
                        <div className={styles.formGroup}>
                            <label htmlFor="courseTitle">Title <span className={styles.required}>*</span></label>
                            <input
                                id="courseTitle"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                disabled={submitting}
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
                                <label htmlFor="coursePrice">Price ($) <span className={styles.required}>*</span></label>
                                <input
                                    id="coursePrice"
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    step="0.01"
                                    min="0.01" // Premium should cost something
                                    required
                                    disabled={submitting}
                                    placeholder="e.g., 19.99"
                                />
                            </div>
                        )}

                         <div className={styles.formGroup}>
                             <label htmlFor="coverImage">Cover Image (Optional)</label>
                             <input
                                 id="coverImage"
                                 type="file"
                                 ref={fileInputRef}
                                 accept="image/jpeg, image/png, image/webp" // Be specific
                                 onChange={handleCoverImageChange}
                                 disabled={submitting}
                                 style={{ display: 'none' }} // Hide default input
                             />
                             {/* Custom styled button */}
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
                                    <button type="button" onClick={clearCoverImage} className={styles.clearImageButton} disabled={submitting}>
                                        &times; {/* Clear icon */}
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
                        {/* Render editor only when not submitting to prevent issues */}
                         {!submitting && <CustomEditor ref={editorRef} />}
                         {submitting && <p>Editor disabled during submission.</p>}
                    </div>
                </fieldset>


                {/* Section 3: Lessons & Quizzes */}
                <fieldset className={styles.formSection}>
                     <legend>Attach Content</legend>
                     <div className={styles.contentSelectionGrid}>
                              {/* ======== START: Quizzes Section Replacement ======== */}
                              {/* Quizzes Selection */}
                              <div className={styles.addContentSection}>
                                  {/* Header containing Title and Create Button */}
                                  <div className={styles.contentSectionHeader}>
                                      <h3>Available Quizzes</h3>
                                      <button
                                          type="button"
                                          onClick={() => setIsQuizModalOpen(true)}
                                          className={styles.createContentBtn} // Reuse existing button style
                                          disabled={submitting}
                                      >
                                          + Create New Quiz
                                      </button>
                                  </div>

                                  {/* List Area: Scrollable box or 'No items' message */}
                                  <div className={styles.contentListArea}> {/* New wrapper */}
                                      {quizzes.length > 0 ? (
                                          <div className={styles.scrollableBox}>
                                              {quizzes.map((quiz) => (
                                                  <div key={quiz.id} className={styles.contentItem}>
                                                      <input
                                                          type="checkbox"
                                                          id={`quiz-${quiz.id}`}
                                                          checked={selectedQuizzes.includes(quiz.id)}
                                                          onChange={() => handleQuizToggle(quiz.id)}
                                                          disabled={submitting || !!quiz.course}
                                                      />
                                                      <label htmlFor={`quiz-${quiz.id}`}>
                                                          {quiz.title}
                                                          {quiz.course ? <span className={styles.alreadyAttached}> (Attached)</span> : ""}
                                                      </label>
                                                  </div>
                                              ))}
                                          </div>
                                      ) : (
                                          <p className={styles.noContentMessage}>No quizzes created yet.</p> // Simple message inside list area
                                      )}
                                  </div>
                              </div>
                              {/* ======== END: Quizzes Section Replacement ======== */}
                              {/* Lessons Selection */}
                              <div className={styles.addContentSection}>
                                  {/* Header containing Title and Create Button */}
                                  <div className={styles.contentSectionHeader}>
                                      <h3>Available Lessons</h3>
                                      <button
                                          type="button"
                                          onClick={() => setIsLessonModalOpen(true)}
                                          className={styles.createContentBtn} // Reuse existing button style
                                          disabled={submitting}
                                      >
                                          + Create New Lesson
                                      </button>
                                  </div>

                                  {/* List Area: Scrollable box or 'No items' message */}
                                  <div className={styles.contentListArea}> {/* New wrapper */}
                                      {lessons.length > 0 ? (
                                          <div className={styles.scrollableBox}>
                                              {lessons.map((lesson) => (
                                                  <div key={lesson.id} className={styles.contentItem}>
                                                      <input
                                                          type="checkbox"
                                                          id={`lesson-${lesson.id}`}
                                                          checked={selectedLessons.includes(lesson.id)}
                                                          onChange={() => handleLessonToggle(lesson.id)}
                                                          disabled={submitting || !!lesson.course}
                                                      />
                                                      <label htmlFor={`lesson-${lesson.id}`}>
                                                          {lesson.title}
                                                          {lesson.course ? <span className={styles.alreadyAttached}> (Attached)</span> : ""}
                                                      </label>
                                                  </div>
                                              ))}
                                          </div>
                                      ) : (
                                          <p className={styles.noContentMessage}>No lessons created yet.</p> // Simple message inside list area
                                      )}
                                  </div>
                              </div>
                              {/* ======== END: Lessons Section Replacement ======== */}
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
                                 placeholder="Enter usernames separated by commas (e.g., user1, test_user2)"
                                 value={testers}
                                 onChange={(e) => setTesters(e.target.value)}
                                 disabled={submitting || isDraft} // Disable if draft or submitting
                             />
                              {isDraft && <small className={styles.fieldNote}>Testers can only be assigned when publishing.</small>}
                         </div>

                         <div className={styles.formGroup}>
                             <label>Course Status <span className={styles.required}>*</span></label>
                             <div className={styles.radioGroup}>
                                 <label className={styles.radioLabel}>
                                     <input
                                         type="radio"
                                         name="courseStatus"
                                         checked={isDraft === true}
                                         onChange={() => setIsDraft(true)}
                                         disabled={submitting}
                                     />
                                     Save as Draft
                                 </label>
                             </div>
                         </div>
                     </div>
                </fieldset>

                {/* Save Button Area */}
                <div className={styles.courseSaveButtonArea}>
                    <button
                        type="button" // Important: Change type to button to prevent implicit form submission
                        className={`${styles.zportaBtn} ${submitting ? styles.disabledBtn : ''}`}
                        onClick={handleSaveCourse} // Trigger save manually
                        disabled={submitting}
                    >
                        {submitting ? 'Saving...' : (isDraft ? 'Save Draft' : 'Publish Course')}
                    </button>
                </div>
            </form>

            {/* *** ADD Modals Rendering *** */}
            <Modal isOpen={isLessonModalOpen} onClose={() => setIsLessonModalOpen(false)}>
                <CreateLesson
                    // Pass necessary props to CreateLesson
                    onSuccess={handleLessonCreated} // Callback on successful creation
                    onClose={() => setIsLessonModalOpen(false)} // Function to close modal
                    isModalMode={true} // Flag indicating it's running in a modal
                />
            </Modal>

            <Modal isOpen={isQuizModalOpen} onClose={() => setIsQuizModalOpen(false)}>
                <CreateQuiz
                    // Pass necessary props to CreateQuiz
                    onSuccess={handleQuizCreated} // Callback on successful creation
                    onClose={() => setIsQuizModalOpen(false)} // Function to close modal
                    isModalMode={true} // Flag indicating it's running in a modal
                />
            </Modal>

        </div>
    );
};

export default CreateCourse;