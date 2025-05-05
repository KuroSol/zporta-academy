// Add useCallback to the import list
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../api';
import { AuthContext } from '../../context/AuthContext';
import CustomEditor from '../Editor/CustomEditor'; // Assuming this component exists
import CreateSubjectSelect from './CreateSubjectSelect'; // Assuming this component exists
import styles from './CreateQuiz.module.css';
import { Plus, Trash2 } from 'lucide-react'; // Import icons

const CreateQuiz = ({ onSuccess, onClose, isModalMode = false }) => {
  const { quizId } = useParams();
  const navigate    = useNavigate();
  const { user, token, logout } = useContext(AuthContext); // Added user for potential checks

  // --- Step / form state ---
  const [currentStep , setCurrentStep ] = useState(1);
  const [title       , setTitle       ] = useState('');
  const [quizType    , setQuizType    ] = useState('free');
  const [subjectOption, setSubjectOption] = useState(null);
  const [questions, setQuestions] = useState([
    {
      question_text: '', question_image: null, question_audio: null,
      option1: '', option1_image: null, option1_audio: null,
      option2: '', option2_image: null, option2_audio: null,
      option3: '', option3_image: null, option3_audio: null,
      option4: '', option4_image: null, option4_audio: null,
      correct_option: 1,
      // Hints are now top-level, remove from question object if not per-question
      // hint1: '', hint2: ''
    }
  ]);

  // Top-level hints and tags
  // const [hint1       , setHint1       ] = useState(''); // Removed if hints are per-question
  // const [hint2       , setHint2       ] = useState(''); // Removed if hints are per-question
  const [tags        , setTags        ] = useState('');
  const [content     , setContent     ] = useState(''); // For explanation/content
  const [message     , setMessage     ] = useState('');
  const [messageType , setMessageType ] = useState('error'); // 'error' or 'success'
  const [submitting  , setSubmitting  ] = useState(false);

  // --- Helpers for questions array ---
  const addNewQuestion = () => {
    setQuestions(qs => [
      ...qs,
      // Initialize new question object - ensure all fields exist
      {
        question_text: '', question_image: null, question_audio: null,
        option1: '', option1_image: null, option1_audio: null,
        option2: '', option2_image: null, option2_audio: null,
        option3: '', option3_image: null, option3_audio: null,
        option4: '', option4_image: null, option4_audio: null,
        correct_option: 1,
        // Add hints here if they are per-question
        // hint1: '', hint2: ''
      }
    ]);
  };
  const removeQuestion = i => {
    // Prevent removing the last question
    if (questions.length <= 1) {
        setMessage("A quiz must have at least one question.");
        setMessageType('error');
        return;
    }
    setQuestions(qs => qs.filter((_, idx) => idx !== i));
  };

  const updateQuestion = (i, field, val) => {
    setQuestions(qs => {
      const copy = qs.map((q, index) => {
          if (index === i) {
              return { ...q, [field]: val };
          }
          return q;
      });
      return copy;
    });
  };

  // --- Navigation ---
  const handleNext = ()  => setCurrentStep(s => Math.min(3, s+1));
  const handleBack = ()  => setCurrentStep(s => Math.max(1, s-1));

  // --- Load existing quiz in edit mode ---
  useEffect(() => {
    if (!quizId) return;

    apiClient.get(`/quizzes/${quizId}/edit/`, { // Ensure endpoint matches your API
      headers: { Authorization: `Bearer ${token}` } // Use token from context
    })
    .then(({ data }) => {
      const quiz = data.quiz || data; // Adjust based on API response structure

      setTitle(quiz.title);
      setQuizType(quiz.quiz_type);
      // Assuming subject is an object { id, name } or similar
      if (quiz.subject) {
          setSubjectOption({ value: quiz.subject.id, label: quiz.subject.name, isNew: false });
      }
      setContent(quiz.content || ''); // Handle potential null/undefined content
      setTags(Array.isArray(quiz.tags) ? quiz.tags.map(t => t.name || t).join(',') : quiz.tags || ''); // Handle tags array or string

      // Map questions carefully, providing defaults for optional fields
      setQuestions((quiz.questions || []).map(q => ({
        id: q.id, // Keep ID if editing
        question_text: q.question_text || '',
        question_image: null, // Don't pre-fill file inputs
        question_audio: null, // Don't pre-fill file inputs
        question_image_url: q.question_image || null, // Store existing URL
        question_audio_url: q.question_audio || null, // Store existing URL
        option1: q.option1 || '', option1_image: null, option1_audio: null, option1_image_url: q.option1_image || null, option1_audio_url: q.option1_audio || null,
        option2: q.option2 || '', option2_image: null, option2_audio: null, option2_image_url: q.option2_image || null, option2_audio_url: q.option2_audio || null,
        option3: q.option3 || '', option3_image: null, option3_audio: null, option3_image_url: q.option3_image || null, option3_audio_url: q.option3_audio || null,
        option4: q.option4 || '', option4_image: null, option4_audio: null, option4_image_url: q.option4_image || null, option4_audio_url: q.option4_audio || null,
        correct_option: q.correct_option || 1,
        // Add hints if they are per-question
        // hint1: q.hint1 || '',
        // hint2: q.hint2 || ''
      })));
       // Set top-level hints if they exist
       // setHint1(quiz.hint1 || '');
       // setHint2(quiz.hint2 || '');
    })
    .catch(err => {
      console.error('Failed to load quiz for edit:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
          if(typeof logout === 'function') logout();
          navigate('/login');
      } else {
          setMessage('Failed to load quiz data for editing.');
          setMessageType('error');
          // Optionally navigate back or disable form
      }
    });
  }, [quizId, token, logout, navigate]); // Added token dependency

  // --- Handle editor content ---
  // Now useCallback is imported and can be used
  const handleSaveContent = useCallback(html => setContent(html), []);

  // --- Final submit (create or patch) ---
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setMessageType('error'); // Default to error

    if (!token) {
      setMessage('Authentication error. Please log in again.');
      setSubmitting(false);
      return;
    }
    if (!subjectOption) {
      setMessage('Please select or create a subject.');
      setSubmitting(false);
      setCurrentStep(1); // Go back to step 1
      return;
    }
    if (!title.trim()) {
        setMessage('Please enter a quiz title.');
        setSubmitting(false);
        setCurrentStep(1); // Go back to step 1
        return;
    }
     // Validate questions
     for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.question_text?.trim()) {
            setMessage(`Please enter text for Question ${i + 1}.`);
            setSubmitting(false);
            setCurrentStep(2);
            return;
        }
        if (!q.option1?.trim() || !q.option2?.trim()) {
            setMessage(`Please enter text for at least Option 1 and Option 2 for Question ${i + 1}.`);
            setSubmitting(false);
            setCurrentStep(2);
            return;
        }
    }


    const formData = new FormData();
    formData.append('title', title);
    formData.append('quiz_type', quizType);
    formData.append('content', content); // Explanation/Content
    formData.append('subject_name', subjectOption.label); // Send label for new/existing
    if (!subjectOption.isNew) {
        formData.append('subject_id', subjectOption.value); // Send ID only if existing
    }
    // Append tags correctly
    tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
        formData.append('tags', tag); // Append each tag individually
    });

    // Append questions with nested structure for DRF-nested-routers or similar backend
    questions.forEach((q, qi) => {
        // Append text fields
        formData.append(`questions[${qi}]question_text`, q.question_text);
        formData.append(`questions[${qi}]option1`, q.option1);
        formData.append(`questions[${qi}]option2`, q.option2);
        formData.append(`questions[${qi}]option3`, q.option3 || '');
        formData.append(`questions[${qi}]option4`, q.option4 || '');
        formData.append(`questions[${qi}]correct_option`, q.correct_option);
        // Add hints if per-question
        // formData.append(`questions[${qi}]hint1`, q.hint1 || '');
        // formData.append(`questions[${qi}]hint2`, q.hint2 || '');
         // Include question ID if editing
         if (q.id) {
            formData.append(`questions[${qi}]id`, q.id);
        }

        // Append files if they exist (newly selected files)
        if (q.question_image instanceof File) formData.append(`questions[${qi}]question_image`, q.question_image);
        if (q.question_audio instanceof File) formData.append(`questions[${qi}]question_audio`, q.question_audio);
        if (q.option1_image instanceof File) formData.append(`questions[${qi}]option1_image`, q.option1_image);
        if (q.option1_audio instanceof File) formData.append(`questions[${qi}]option1_audio`, q.option1_audio);
        if (q.option2_image instanceof File) formData.append(`questions[${qi}]option2_image`, q.option2_image);
        if (q.option2_audio instanceof File) formData.append(`questions[${qi}]option2_audio`, q.option2_audio);
        if (q.option3_image instanceof File) formData.append(`questions[${qi}]option3_image`, q.option3_image);
        if (q.option3_audio instanceof File) formData.append(`questions[${qi}]option3_audio`, q.option3_audio);
        if (q.option4_image instanceof File) formData.append(`questions[${qi}]option4_image`, q.option4_image);
        if (q.option4_audio instanceof File) formData.append(`questions[${qi}]option4_audio`, q.option4_audio);
    });

     // Append top-level hints if needed
     // formData.append('hint1', hint1);
     // formData.append('hint2', hint2);

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      };

      const res = quizId
        ? await apiClient.patch(`/quizzes/${quizId}/edit/`, formData, config) // Use PATCH for updates
        : await apiClient.post('/quizzes/', formData, config);

      const savedQuiz = res.data.quiz || res.data; // Adjust based on response

      setMessageType('success');
      setMessage(`Quiz '${savedQuiz.title}' ${quizId ? 'updated' : 'created'} successfully!`);

      if (typeof onSuccess === 'function') {
        onSuccess(savedQuiz); // Callback for modal mode
      }
      if (typeof onClose === 'function') {
          setTimeout(onClose, 1500); // Close modal after success message
      }

      if (!isModalMode && savedQuiz.permalink) {
        // Redirect only if not in modal mode and permalink exists
        setTimeout(() => navigate(`/quizzes/${savedQuiz.permalink}`), 1500);
      } else if (!isModalMode) {
          // Redirect to dashboard or list if no permalink (or stay?)
          setTimeout(() => navigate('/dashboard'), 1500); // Example fallback
      }

    } catch (err) {
      console.error('Error saving quiz:', err.response || err);
      let errMsg = `Failed to ${quizId ? 'update' : 'create'} quiz.`;
      if (err.response?.data) {
        // Attempt to parse DRF errors
        const errors = err.response.data;
        if (typeof errors === 'object' && errors !== null) {
            // Extract specific error messages
            const specificErrors = Object.entries(errors).map(([field, messages]) =>
                `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`
            ).join('; ');
            if (specificErrors) errMsg = specificErrors;
            else if (errors.detail) errMsg = errors.detail; // Handle non_field_errors or general detail
        } else if (typeof errors === 'string') {
            errMsg = errors; // Handle plain string errors
        }
      } else if (err.request) {
        errMsg = 'Network error. Please check your connection.';
      }
      setMessageType('error');
      setMessage(errMsg);

      if (err.response?.status === 401) {
        if(typeof logout === 'function') logout();
        navigate('/login');
      } else if (err.response?.status === 403) {
        setMessage("Permission denied.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- Progress bar percent ---
  const progressPercent = (currentStep / 3) * 100;

  return (
    // Added pageWrapper div for centering if not in modal mode
    <div className={!isModalMode ? styles.pageWrapper : ''}>
        <div className={styles.createQuizContainer}>
        <h3 className={styles.modalFormTitle}>
            {quizId ? 'Edit Quiz' : 'Create New Quiz'}
        </h3>

        {/* Progress Bar */}
        <div className={styles.progressContainer}>
            <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Message Area */}
        {message && (
            <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
            {message}
            </p>
        )}

        <form onSubmit={handleSubmit} className={styles.quizForm}>
            {/* --- STEP 1: Details --- */}
            {currentStep === 1 && (
            <div className={`${styles.step} ${styles.step1}`}>
                {quizId && (
                <p className={styles.infoText}>
                    ⚠️ Title cannot be changed after creation. Subject can be changed.
                </p>
                )}
                <div className={styles.formGroup}>
                <label htmlFor="quizTitle" className={styles.inputLabel}>Title: <span className={styles.required}>*</span></label>
                <input
                    id="quizTitle"
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                    disabled={submitting || Boolean(quizId)} // Disable title edit
                    className={styles.inputField}
                    placeholder="Enter a clear and concise quiz title"
                />
                </div>
                <div className={styles.formGroup}>
                <label htmlFor="quizType" className={styles.inputLabel}>Quiz Type:</label>
                <select
                    id="quizType"
                    value={quizType}
                    onChange={e => setQuizType(e.target.value)}
                    disabled={submitting}
                    className={styles.selectField}
                >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                </select>
                </div>
                <div className={styles.formGroup}>
                <label htmlFor="quizSubject" className={styles.inputLabel}>Subject: <span className={styles.required}>*</span></label>
                <CreateSubjectSelect
                    onChange={setSubjectOption}
                    value={subjectOption}
                    isDisabled={submitting}
                    aria-labelledby="quizSubject"
                />
                </div>
            </div>
            )}

            {/* --- STEP 2: Questions --- */}
            {currentStep === 2 && (
            <div className={`${styles.step} ${styles.step2}`}>
                {questions.map((q, i) => (
                // Added questionBlock class
                <div key={i} className={styles.questionBlock}>
                    <h4>Question {i + 1}</h4>
                     {/* Remove button absolutely positioned */}
                     <button
                        type="button"
                        onClick={() => removeQuestion(i)}
                        className={styles.removeQuestionButton}
                        disabled={submitting || questions.length <= 1}
                        title="Remove Question"
                        aria-label={`Remove question ${i + 1}`}
                    >
                        <Trash2 size={18} />
                    </button>

                    {/* Question Text */}
                    <div className={styles.formGroup}>
                        <label className={styles.inputLabel} htmlFor={`q-text-${i}`}>Question Text: <span className={styles.required}>*</span></label>
                        <textarea
                            id={`q-text-${i}`}
                            className={styles.textAreaField}
                            placeholder="Enter the question text..."
                            value={q.question_text}
                            onChange={e => updateQuestion(i, 'question_text', e.target.value)}
                            required
                            disabled={submitting}
                            rows={3} // Suggest initial rows
                        />
                    </div>

                    {/* Question Media Upload Row */}
                    <div className={styles.mediaUploadRow}>
                        <div className={styles.formGroup}>
                             <label className={styles.fileLabel} htmlFor={`q-img-${i}`}>
                                📷 {q.question_image ? q.question_image.name : (q.question_image_url ? 'Change Image' : 'Upload Image')}
                                <input
                                    id={`q-img-${i}`}
                                    type="file"
                                    accept="image/*"
                                    onChange={e => updateQuestion(i, 'question_image', e.target.files[0])}
                                    disabled={submitting}
                                />
                            </label>
                            {/* Display existing image URL if editing */}
                            {q.question_image_url && !q.question_image && <span className={styles.existingFile}>(Current: <a href={q.question_image_url} target="_blank" rel="noopener noreferrer">Image</a>)</span>}
                        </div>
                         <div className={styles.formGroup}>
                            <label className={styles.fileLabel} htmlFor={`q-aud-${i}`}>
                                🔊 {q.question_audio ? q.question_audio.name : (q.question_audio_url ? 'Change Audio' : 'Upload Audio')}
                                <input
                                    id={`q-aud-${i}`}
                                    type="file"
                                    accept="audio/*"
                                    onChange={e => updateQuestion(i, 'question_audio', e.target.files[0])}
                                    disabled={submitting}
                                />
                            </label>
                             {q.question_audio_url && !q.question_audio && <span className={styles.existingFile}>(Current: <a href={q.question_audio_url} target="_blank" rel="noopener noreferrer">Audio</a>)</span>}
                        </div>
                    </div>


                    {/* Options 1–4 */}
                    {[1,2,3,4].map(n => (
                    <div key={n} className={styles.optionGroup}>
                         <label className={styles.inputLabel} htmlFor={`q-${i}-opt${n}-text`}>
                            Option {n}: {n <= 2 ? <span className={styles.required}>*</span> : '(Optional)'}
                         </label>
                         <div className={styles.fileInputGroup}> {/* Group text and file inputs */}
                            <input
                                id={`q-${i}-opt${n}-text`}
                                className={styles.inputField}
                                placeholder={`Text for Option ${n}`}
                                value={q[`option${n}`] || ''} // Ensure value is controlled
                                onChange={e => updateQuestion(i, `option${n}`, e.target.value)}
                                required={n<=2}
                                disabled={submitting}
                            />
                            <label className={styles.fileLabel} htmlFor={`q-${i}-opt${n}-img`}>
                                📷 {q[`option${n}_image`] ? q[`option${n}_image`].name : (q[`option${n}_image_url`] ? 'Change' : 'Image')}
                                <input
                                    id={`q-${i}-opt${n}-img`}
                                    type="file"
                                    accept="image/*"
                                    onChange={e => updateQuestion(i, `option${n}_image`, e.target.files[0])}
                                    disabled={submitting}
                                />
                            </label>
                             {q[`option${n}_image_url`] && !q[`option${n}_image`] && <span className={styles.existingFile}>(<a href={q[`option${n}_image_url`]} target="_blank" rel="noopener noreferrer">Img</a>)</span>}

                            <label className={styles.fileLabel} htmlFor={`q-${i}-opt${n}-aud`}>
                                🔊 {q[`option${n}_audio`] ? q[`option${n}_audio`].name : (q[`option${n}_audio_url`] ? 'Change' : 'Audio')}
                                <input
                                    id={`q-${i}-opt${n}-aud`}
                                    type="file"
                                    accept="audio/*"
                                    onChange={e => updateQuestion(i, `option${n}_audio`, e.target.files[0])}
                                    disabled={submitting}
                                />
                            </label>
                            {q[`option${n}_audio_url`] && !q[`option${n}_audio`] && <span className={styles.existingFile}>(<a href={q[`option${n}_audio_url`]} target="_blank" rel="noopener noreferrer">Aud</a>)</span>}
                         </div>
                    </div>
                    ))}

                    {/* Correct answer selector */}
                     <div className={styles.formGroup}>
                        <label className={styles.inputLabel} htmlFor={`q-${i}-correct`}>Correct Answer: <span className={styles.required}>*</span></label>
                        <select
                            id={`q-${i}-correct`}
                            className={styles.selectField}
                            value={q.correct_option}
                            onChange={e => updateQuestion(i, 'correct_option', parseInt(e.target.value, 10))} // Ensure number
                            disabled={submitting}
                            required
                        >
                            <option value={1}>Option 1</option>
                            <option value={2}>Option 2</option>
                            {/* Only show options 3 & 4 if text is entered */}
                            {q.option3 && <option value={3}>Option 3</option>}
                            {q.option4 && <option value={4}>Option 4</option>}
                        </select>
                     </div>

                </div> // End questionBlock
                ))}

                {/* Add another question button */}
                <button
                type="button"
                onClick={addNewQuestion}
                className={`${styles.btn} ${styles.btnAddQuestion}`} // Use specific class
                disabled={submitting}
                >
                <Plus size={16} /> Add Question
                </button>
            </div>
            )}


            {/* --- STEP 3: Explanation & Tags --- */}
            {currentStep === 3 && (
            <div className={`${styles.step} ${styles.step3}`}>
                 <div className={styles.formGroup}>
                    <label className={styles.inputLabel}>Explanation / Content (Optional):</label>
                    <div className={styles.editorContainer}>
                        {/* Pass initial content for editing */}
                        <CustomEditor initialContent={content} onSave={handleSaveContent} isDisabled={submitting} />
                    </div>
                </div>
                <div className={styles.formGroup}>
                <label htmlFor="quizTags" className={styles.inputLabel}>Tags (Optional, comma-separated):</label>
                <input
                    id="quizTags"
                    className={styles.inputField}
                    placeholder="e.g. javascript, react, web development"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    disabled={submitting}
                />
                </div>
                 {/* Removed separate Hint fields - add back if needed per quiz, not per question */}
            </div>
            )}

            {/* --- Navigation Buttons --- */}
            <div className={styles.navigationButtons}>
            {currentStep > 1 && (
                <button type="button" onClick={handleBack} className={`${styles.btn} ${styles.btnBack}`} disabled={submitting}>
                Back
                </button>
            )}
            {/* Spacer to push next/submit right */}
            <div style={{ flexGrow: 1 }}></div>

            {currentStep < 3 && (
                <button type="button" onClick={handleNext} className={`${styles.btn} ${styles.btnNext}`} disabled={submitting}>
                Next
                </button>
            )}
            {currentStep === 3 && (
                <button type="submit" className={`${styles.btn} ${styles.btnSubmit}`} disabled={submitting}>
                {submitting ? 'Saving...' : (quizId ? 'Save Changes' : 'Create Quiz')}
                </button>
            )}
            {isModalMode && (
                <button type="button" onClick={onClose} className={`${styles.btn} ${styles.btnSecondary}`} disabled={submitting}>
                Cancel
                </button>
            )}
            </div>
        </form>
        </div>
    </div>
  );
};

export default CreateQuiz;
