import React, { useState, useEffect, useRef, useContext } from 'react'; // Added useContext
import { useNavigate } from 'react-router-dom';
import CustomEditor from '../Editor/CustomEditor'; // Assuming path is correct
import CreateSubjectSelect from './CreateSubjectSelect'; // Assuming path is correct
import apiClient from '../../api'; // <-- ADD apiClient import (Adjust path ../../api if needed)
import { AuthContext } from '../../context/AuthContext'; // <-- ADD AuthContext import (Adjust path)
import styles from './CreateQuiz.module.css'; 
import { useParams } from 'react-router-dom';

const CreateQuiz = ({ onSuccess, onClose, isModalMode = false }) => {
  const { quizId } = useParams(); 
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state
  const [title, setTitle] = useState('');
  const [quizType, setQuizType] = useState('free');
  const [subjectOption, setSubjectOption] = useState(null);

  // Step 2 state
  // Step 2 state: dynamic questions array
  const [questions, setQuestions] = useState([
    { question_text: '', option1: '', option2: '', option3: '', option4: '', correct_option: 1, hint1: '', hint2: '' }
  ]);

  // Add a blank question
  const addNewQuestion = () => {
    setQuestions([
      ...questions,
      { question_text: '', option1: '', option2: '', option3: '', option4: '', correct_option: 1, hint1: '', hint2: '' }
    ]);
  };
  
  // ←– ADD BELOW addNewQuestion
    // Remove a question at `index`
    const removeQuestion = (index) => {
      // keep at least one question
      if (questions.length <= 1) return;
      setQuestions(questions.filter((_, i) => i !== index));
    };
  // ←– END ADD

  // Update a single question field
  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };


  // Step 3 state
  const [hint1, setHint1] = useState('');
  const [hint2, setHint2] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  
  // Message state for errors / confirmations
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false); // To track final submission
  const [messageType, setMessageType] = useState('error'); // To style messages
  const { logout } = useContext(AuthContext);
  // Called by CustomEditor to update the content state
  const handleSaveContent = (editorContent) => {
    setContent(editorContent);
  };

  // Navigate to next/previous steps
  const handleNext = () => {
    // (Optional) You could add per‑step validations here
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  // Submit the complete form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); // Indicate final submission has started

    // Check for token and subject selection (you can add more validations as needed)
   
    if (!localStorage.getItem('token')) {
      setMessage('You must be logged in to create a quiz.');
      // Optionally navigate('/login');
      return;
    }
    // Keep subject check
    if (!subjectOption) {
        setMessage('Please select or create a subject.');
        return;
    }

    // Determine the subject value
    const subjectValue = subjectOption.isNew
      ? subjectOption.label
      : subjectOption.value;

    // Convert comma‑separated tags to an array
    const tagsArray = tags
      ? tags.split(',').map((tag) => tag.trim()).filter((tag) => tag !== '')
      : [];

          const payload = {
              title,
              quiz_type: quizType,
              content,
              subject: subjectOption.isNew
                       ? subjectOption.label
                       : subjectOption.value,
              questions,
              tags: tagsArray,
            };
      

    // Inside handleSubmit, after payload definition
    setMessage(''); // Clear message before trying

    try {
        // Use apiClient.post, relative URL '/quizzes/', payload object. Auth/JSON handled.
           const response = quizId
              // EDIT mode
              ? await apiClient.patch(
                  `/quizzes/${quizId}/edit/`,
                  payload,
                  { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                )
              // CREATE mode
              : await apiClient.post(
                  '/quizzes/',
                  payload,
                  { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                );

        // *** START REPLACEMENT ***
        const newQuizData = response.data; // Get the created quiz data

        if (isModalMode && onSuccess) {
            // --- Modal Mode ---
            // Call the callback passed from CreateCourse
            setMessage('Quiz saved!'); // Optional: Show temporary success in modal
            setMessageType('success');
            onSuccess(newQuizData); // Pass data back to parent (which handles closing)
        } else {
            // --- Standalone Mode ---
            // Keep the original behavior for the standalone page
            setMessage('Quiz created successfully!');
            setMessageType('success'); // Set message type for styling
            console.log('Quiz created:', newQuizData);
            // Keep your original navigation for standalone mode
            navigate('/admin/quizzes'); // Or navigate to the new quiz detail page, etc.
        }
        // *** END REPLACEMENT ***

    } catch (error) {
        // Handle Axios errors
        console.error('Error creating quiz:', error.response ? error.response.data : error.message);
        let errorMsg = 'Failed to create quiz.';
        if (error.response && error.response.data) {
            if (typeof error.response.data === 'object') {
                errorMsg = Object.entries(error.response.data)
                    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
                    .join(' | ');
            } else {
                errorMsg = error.response.data.error || error.response.data.detail || errorMsg;
            }
        } else if (error.request) {
            errorMsg = 'Network error.';
        } else {
            errorMsg = 'An unexpected error occurred while creating the quiz.';
        }
        setMessageType('error'); // Ensure message type is set correctly on error
        setMessage(errorMsg); // Show error
        // Optionally logout on auth errors
        if (error.response?.status === 401 || error.response?.status === 403) {
            logout();
        }
      } // closing brace of catch
      finally { // Add this finally block
          setSubmitting(false); // Indicate submission attempt has finished
      }
  }; // closing brace of handleSubmit function

  // Calculate progress percentage (for three steps)
  const progressPercentage = (currentStep / 3) * 100;
  useEffect(() => {
    if (!quizId) return;
    apiClient
      .get(`/quizzes/${quizId}/edit/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => {
        const data = res.data;
        setTitle(data.title);
        setQuizType(data.quiz_type);
        setSubjectOption({ value: data.subject, label: data.subject, isNew: false });
        setContent(data.content);
        setHint1(data.questions[0]?.hint1 || '');
        setHint2(data.questions[0]?.hint2 || '');
        setTags(Array.isArray(data.tags) ? data.tags.join(',') : (data.tags || ''));
        setQuestions(
          data.questions.map(q => ({
            id: q.id,                 // IMPORTANT: preserve id for update
            question_text: q.question_text,
            option1: q.option1,
            option2: q.option2,
            option3: q.option3 || '',
            option4: q.option4 || '',
            correct_option: q.correct_option,
            hint1: q.hint1 || '',
            hint2: q.hint2 || ''
          }))
        );
      })
      .catch(err => {
        console.error('Load for edit failed', err);
        logout();
        navigate('/login');
      });
  }, [quizId]);
  
  return (
    <div className={styles.createQuizContainer}>
      <h3 className={styles.modalFormTitle}>Create New Quiz</h3>
      {/* Progress Bar */}
      <div className={styles.progressContainer}>
        <div
          className={styles.progressBar}
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      
      {/* Updated Message Display */}
      {message && (
          <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
              {message}
          </p>
      )}

      {/* ======== START: Replace block from here ======== */}
      <form onSubmit={handleSubmit} className={styles.quizForm}> {/* Use CSS module */}

      {/* --- Step 1: Quiz Details --- */}
      {currentStep === 1 && (
        // Apply step and animation classes from module
        <div className={`${styles.step} ${styles.step1} ${styles.animateFadeIn}`}>
          {/* Apply formGroup style, add label htmlFor/id, inputField style, required span, disable */}
          <div className={styles.formGroup}>
            <label htmlFor="quizTitle">Title: <span className={styles.required}>*</span></label>
            <input
              id="quizTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={styles.inputField} // Use module style
              disabled={submitting} // Disable during final submission
            />
          </div>
          {/* Apply formGroup style, add label htmlFor/id, selectField style, disable */}
          <div className={styles.formGroup}>
            <label htmlFor="quizType">Quiz Type:</label>
            <select
              id="quizType"
              value={quizType}
              onChange={(e) => setQuizType(e.target.value)}
              className={styles.selectField} // Use module style
              disabled={submitting} // Disable during final submission
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          {/* Apply formGroup style, add label htmlFor/id, required span, pass disabled prop */}
          <div className={styles.formGroup}>
            <label id="quizSubjectLabel">Subject: <span className={styles.required}>*</span></label> {/* Label for accessibility */}
            {/* Pass isDisabled prop - CreateSubjectSelect needs to handle it */}
            <CreateSubjectSelect
                onChange={setSubjectOption}
                value={subjectOption}
                isDisabled={submitting} // Pass submitting state down
                aria-labelledby="quizSubjectLabel" // Link label to select component
            />
          </div>
        </div>
      )}

      {/* --- Step 2: Question and Options --- */}
      {currentStep === 2 && (
        <div className={`${styles.step} ${styles.step2} ${styles.animateFadeIn}`}>
          {questions.map((q, i) => (
            <div key={i} className={styles.formGroup}>
              <h4>Question {i + 1}</h4>
              <textarea
                value={q.question_text}
                onChange={e => updateQuestion(i, 'question_text', e.target.value)}
                placeholder="Enter question"
                required
                className={styles.textAreaField}
              />
  

                {/* ←– ADD: remove button for this question */}
                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={submitting || questions.length <= 1}
                  style={{ alignSelf: 'flex-end', marginTop: '8px' }}
                >
                  Remove Question
                </button>



              <input
                type="text"
                value={q.option1}
                onChange={e => updateQuestion(i, 'option1', e.target.value)}
                placeholder="Option 1"
                required
                className={styles.inputField}
              />
              <input
                type="text"
                value={q.option2}
                onChange={e => updateQuestion(i, 'option2', e.target.value)}
                placeholder="Option 2"
                required
                className={styles.inputField}
              />
              <input
                type="text"
                value={q.option3}
                onChange={e => updateQuestion(i, 'option3', e.target.value)}
                placeholder="Option 3 (optional)"
                className={styles.inputField}
              />
              <input
                type="text"
                value={q.option4}
                onChange={e => updateQuestion(i, 'option4', e.target.value)}
                placeholder="Option 4 (optional)"
                className={styles.inputField}
              />
              <select
                value={q.correct_option}
                onChange={e => updateQuestion(i, 'correct_option', parseInt(e.target.value))}
                className={styles.selectField}
              >
                <option value={1}>Option 1</option>
                <option value={2}>Option 2</option>
                <option value={3}>Option 3</option>
                <option value={4}>Option 4</option>
              </select>
              <textarea
                value={q.hint1}
                onChange={e => updateQuestion(i, 'hint1', e.target.value)}
                placeholder="Hint 1 (optional)"
                className={styles.textAreaField}
              />
              <textarea
                value={q.hint2}
                onChange={e => updateQuestion(i, 'hint2', e.target.value)}
                placeholder="Hint 2 (optional)"
                className={styles.textAreaField}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addNewQuestion}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            + Add Another Question
          </button>
        </div>
      )}


      {/* --- Step 3: Hints, Tags and Explanation --- */}
      {currentStep === 3 && (
        <div className={`${styles.step} ${styles.step3} ${styles.animateFadeIn}`}>
          {/* Apply updates to hint textareas */}
          <div className={styles.formGroup}>
            <label htmlFor="quizHint1">Hint 1 (optional):</label>
            <textarea
              id="quizHint1"
              value={hint1}
              onChange={(e) => setHint1(e.target.value)}
              placeholder="Enter first hint (optional)"
              className={styles.textAreaField}
              disabled={submitting}
            ></textarea>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="quizHint2">Hint 2 (optional):</label>
            <textarea
              id="quizHint2"
              value={hint2}
              onChange={(e) => setHint2(e.target.value)}
              placeholder="Enter second hint (optional)"
              className={styles.textAreaField}
              disabled={submitting}
            ></textarea>
          </div>
          {/* Apply updates to tags input */}
          <div className={styles.formGroup}>
            <label htmlFor="quizTags">Tags (comma separated):</label>
            <input
              id="quizTags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. javascript, react"
              className={styles.inputField}
              disabled={submitting}
            />
          </div>
          {/* Apply updates to editor container */}
          <div className={styles.editorContainer}>
            {/* Use label style if defined */}
            <label className={styles.editorLabel} htmlFor="quizExplanation">Explanation / Content:</label>
            {/* Pass isDisabled prop if CustomEditor supports it */}
            <CustomEditor onSave={handleSaveContent} isDisabled={submitting} />
            {/* Add hidden input for accessibility if needed */}
            <input type="hidden" id="quizExplanation" />
          </div>
        </div>
      )}

      {/* --- Navigation buttons --- */}
      <div className={styles.navigationButtons}> {/* Use module style */}
        {/* ADD Cancel Button for Modal mode */}
        {isModalMode && (
              <button
                  type="button"
                  onClick={onClose}
                  className={`${styles.btn} ${styles.btnSecondary}`} // Use secondary style
                  disabled={submitting} // Disable if submitting
                  // Add margin-right to push other buttons over if needed
                  style={{ marginRight: 'auto' }}
              >
                  Cancel
              </button>
          )}

        {/* Back Button */}
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className={`${styles.btn} ${styles.btnBack}`} // Apply module style
            disabled={submitting} // Disable during final submission
          >
            Back
          </button>
        )}

        {/* Spacer to push Next/Submit to the right if Cancel isn't shown */}
        {!isModalMode && currentStep > 1 && (
              <div style={{ flexGrow: 1 }}></div> /* Spacer */
          )}


        {/* Next Button */}
        {currentStep < 3 && (
          <button
            type="button"
            onClick={handleNext}
            className={`${styles.btn} ${styles.btnNext}`} // Apply module style
            disabled={submitting} // Disable during final submission
          >
            Next
          </button>
        )}

        {/* Submit Button */}
        {currentStep === 3 && (
          <button
            type="submit" // Keep type="submit" to trigger form's onSubmit
            className={`${styles.btn} ${styles.btnSubmit}`} // Apply module style
            disabled={submitting} // Disable while submitting
          >
            {submitting ? 'Submitting...' : 'Submit Quiz'} {/* Change text */}
          </button>
        )}
      </div>
      </form>
      {/* ======== END: Replace block up to here ======== */}
    </div>
  );
};

export default CreateQuiz;
