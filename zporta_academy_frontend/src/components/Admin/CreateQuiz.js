import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../api';
import { AuthContext } from '../../context/AuthContext';
import CustomEditor from '../Editor/CustomEditor';
import CreateSubjectSelect from './CreateSubjectSelect';
import styles from './CreateQuiz.module.css';

const CreateQuiz = ({ onSuccess, onClose, isModalMode = false }) => {
  const { quizId } = useParams();
  const navigate    = useNavigate();
  const { logout }  = useContext(AuthContext);

  // --- Step / form state ---
  const [currentStep , setCurrentStep ] = useState(1);
  const [title       , setTitle       ] = useState('');
  const [quizType    , setQuizType    ] = useState('free');
  const [subjectOption, setSubjectOption] = useState(null);
  const [questions, setQuestions] = useState([
    {
      question_text: '',
      question_image: null,
      question_audio: null,
      option1: '', option1_image: null, option1_audio: null,
      option2: '', option2_image: null, option2_audio: null,
      option3: '', option3_image: null, option3_audio: null,
      option4: '', option4_image: null, option4_audio: null,
      correct_option: 1,
      hint1: '', hint2: ''
    }
  ]);
  
  const [hint1       , setHint1       ] = useState('');
  const [hint2       , setHint2       ] = useState('');
  const [tags        , setTags        ] = useState('');
  const [content     , setContent     ] = useState('');
  const [message     , setMessage     ] = useState('');
  const [messageType , setMessageType ] = useState('error');
  const [submitting  , setSubmitting  ] = useState(false);

  // --- Helpers for questions array ---
  const addNewQuestion = () => {
    setQuestions(qs => [
      ...qs,
      { question_text:'', option1:'', option2:'', option3:'', option4:'', correct_option:1, hint1:'', hint2:'' }
    ]);
  };
  const removeQuestion = i => {
    setQuestions(qs => qs.length > 1 ? qs.filter((_, idx) => idx !== i) : qs);
  };
  const updateQuestion = (i, field, val) => {
    setQuestions(qs => {
      const copy = [...qs];
      copy[i][field] = val;
      return copy;
    });
  };

  // --- Navigation ---
  const handleNext = ()  => setCurrentStep(s => Math.min(3, s+1));
  const handleBack = ()  => setCurrentStep(s => Math.max(1, s-1));

  // --- Load existing quiz in edit mode ---
  useEffect(() => {
    if (!quizId) return;

    apiClient.get(`/quizzes/${quizId}/edit/`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    .then(({ data }) => {
      setTitle(data.title);
      setQuizType(data.quiz_type);
      setSubjectOption({ value: data.subject, label: data.subject, isNew: false });
      setContent(data.content);
      setHint1(data.questions[0]?.hint1 || '');
      setHint2(data.questions[0]?.hint2 || '');
      setTags(Array.isArray(data.tags) ? data.tags.join(',') : data.tags || '');
      setQuestions(data.questions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3 || '',
        option4: q.option4 || '',
        correct_option: q.correct_option,
        hint1: q.hint1 || '',
        hint2: q.hint2 || ''
      })));
    })
    .catch(err => {
      console.error('Failed to load quiz for edit:', err);
      logout();
      navigate('/login');
    });
  }, [quizId, logout, navigate]);

  // --- Handle editor content ---
  const handleSaveContent = html => setContent(html);

  // --- Final submit (create or patch) ---
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    // --- Basic validations ---
    if (!localStorage.getItem('token')) {
      setMessage('You must be logged in to create a quiz.');
      setSubmitting(false);
      return;
    }
    if (!subjectOption) {
      setMessage('Please select or create a subject.');
      setSubmitting(false);
      return;
    }
        // Build multipart form data:
        const formData = new FormData();
        formData.append('title', title);
        formData.append('quiz_type', quizType);
        formData.append('content', content);
        formData.append(
          'subject',
          subjectOption.isNew ? subjectOption.label : subjectOption.value
        );

        // tags as an array field:
        tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)
          .forEach((tag, idx) => {
            formData.append(`tags[${idx}]`, tag);
          });

        // questions (including files):
        questions.forEach((q, qi) => {


          if (q.question_image)
            formData.append(
              `questions[${qi}][question_image]`,
              q.question_image
            );
          if (q.question_audio)
            formData.append(
              `questions[${qi}][question_audio]`,
              q.question_audio
            );

          [1, 2, 3, 4].forEach(n => {
            formData.append(
              `questions[${qi}][option${n}]`,
              q[`option${n}`] || ''
            );
            if (q[`option${n}_image`])
              formData.append(
                `questions[${qi}][option${n}_image]`,
                q[`option${n}_image`]
              );
            if (q[`option${n}_audio`])
              formData.append(
                `questions[${qi}][option${n}_audio]`,
                q[`option${n}_audio`]
              );
          });
        });

        questions.forEach((q, qi) => {
          formData.append(`questions[${qi}]question_text`, q.question_text);
          formData.append(`questions[${qi}]option1`, q.option1);
          formData.append(`questions[${qi}]option2`, q.option2);
          formData.append(`questions[${qi}]option3`, q.option3 || '');
          formData.append(`questions[${qi}]option4`, q.option4 || '');
          formData.append(`questions[${qi}]correct_option`, q.correct_option);
          formData.append(`questions[${qi}]hint1`, q.hint1 || '');
          formData.append(`questions[${qi}]hint2`, q.hint2 || '');
        
          if (q.question_image) {
            formData.append(`questions[${qi}]question_image`, q.question_image);
          }
        
          if (q.question_audio) {
            formData.append(`questions[${qi}]question_audio`, q.question_audio);
          }
        
          [1, 2, 3, 4].forEach(opt => {
            if (q[`option${opt}_image`]) {
              formData.append(`questions[${qi}]option${opt}_image`, q[`option${opt}_image`]);
            }
            if (q[`option${opt}_audio`]) {
              formData.append(`questions[${qi}]option${opt}_audio`, q[`option${opt}_audio`]);
            }
          });
        });
        
            try {
                // 1) Prepare headers for multipart/form-data:
                const config = {
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'multipart/form-data'
                  }
                };
          
                // 2) Use formData (not payload) when sending:
                const res = quizId
                ? await apiClient.patch(
                    `/quizzes/${quizId}/edit/`,
                    formData,
                    config
                  )
                : await apiClient.post(
                    '/quizzes/',
                    formData,
                    config
                  );
    

      const newQuiz = res.data;
      setMessageType('success');
      setMessage(isModalMode ? 'Quiz saved!' : 'Quiz created successfully!');

      if (isModalMode && onSuccess) {
        onSuccess(newQuiz);
      } else {
        navigate(`/quizzes/${newQuiz.permalink}`);
      }

    } catch (err) {
      console.error('Error saving quiz:', err);
      let errMsg = 'Failed to save quiz.';
      if (err.response?.data) {
        const d = err.response.data;
        if (typeof d === 'object') {
          errMsg = Object.entries(d).map(([f, m]) =>
            `${f}: ${Array.isArray(m) ? m.join(' ') : m}`
          ).join(' | ');
        } else {
          errMsg = d.detail || d.error || errMsg;
        }
      } else if (err.request) {
        errMsg = 'Network error.';
      }
      setMessageType('error');
      setMessage(errMsg);

      if (err.response?.status === 401) {
        logout();
        navigate('/login');
      } else if (err.response?.status === 403) {
        setMessageType('error');
        setMessage("You don't have permission to edit this quiz.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- Progress bar percent ---
  const progressPercent = (currentStep / 3) * 100;

  return (
    <div className={styles.createQuizContainer}>
      <h3 className={styles.modalFormTitle}>
        {quizId ? 'Edit Quiz' : 'Create New Quiz'}
      </h3>

      <div className={styles.progressContainer}>
        <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
      </div>

      {message && (
        <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
          {message}
        </p>
      )}

      <form onSubmit={handleSubmit} className={styles.quizForm}>
        {/* --- STEP 1: Details --- */}
        {currentStep === 1 && (
          <div className={`${styles.step} ${styles.step1}`}>
                {/* Info text in edit mode */}
              {quizId && (
                <p className={styles.infoText}>
                  ⚠️ Title cannot be changed after creation.
                </p>
              )}
            <div className={styles.formGroup}>
              <label htmlFor="quizTitle">Title: <span className={styles.required}>*</span></label>
              <input
                id="quizTitle"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                disabled={submitting || Boolean(quizId)}    // ← disable if editing
                className={styles.inputField}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="quizType">Quiz Type:</label>
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
              <label htmlFor="quizSubject">Subject: <span className={styles.required}>*</span></label>
              <CreateSubjectSelect
                onChange={setSubjectOption}
                value={subjectOption}
                isDisabled={submitting}
                aria-labelledby="quizSubject"
              />
            </div>
          </div>
        )}

        {/* --- STEP 2: Questions (with image/audio) --- */}
        {currentStep === 2 && (
          <div className={`${styles.step} ${styles.step2}`}>
            {questions.map((q, i) => (
              <div key={i} className={styles.formGroup}>
                <h4>Question {i + 1}</h4>

                {/* Question Text */}
                <textarea
                  className={styles.textAreaField}
                  placeholder="Question text"
                  value={q.question_text}
                  onChange={e => updateQuestion(i, 'question_text', e.target.value)}
                  required
                  disabled={submitting}
                />

                {/* Question Image Upload */}
                <label className={styles.fileLabel}>
                  📷 Question Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => updateQuestion(i, 'question_image', e.target.files[0])}
                    disabled={submitting}
                  />
                </label>

                {/* Question Audio Upload */}
                <label className={styles.fileLabel}>
                  🔊 Question Audio
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={e => updateQuestion(i, 'question_audio', e.target.files[0])}
                    disabled={submitting}
                  />
                </label>

                {/* Options 1–4 */}
                {[1,2,3,4].map(n => (
                  <div key={n} className={styles.optionGroup}>
                    <input
                      className={styles.inputField}
                      placeholder={`Option ${n}${n<=2 ? '' : ' (optional)'}`}
                      value={q[`option${n}`]}
                      onChange={e => updateQuestion(i, `option${n}`, e.target.value)}
                      required={n<=2}
                      disabled={submitting}
                    />

                    {/* Option Image */}
                    <label className={styles.fileLabel}>
                      📷 Option {n} Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => updateQuestion(i, `option${n}_image`, e.target.files[0])}
                        disabled={submitting}
                      />
                    </label>

                    {/* Option Audio */}
                    <label className={styles.fileLabel}>
                      🔊 Option {n} Audio
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={e => updateQuestion(i, `option${n}_audio`, e.target.files[0])}
                        disabled={submitting}
                      />
                    </label>
                  </div>
                ))}

                {/* Correct answer selector */}
                <select
                  className={styles.selectField}
                  value={q.correct_option}
                  onChange={e => updateQuestion(i, 'correct_option', +e.target.value)}
                  disabled={submitting}
                >
                  <option value={1}>Option 1</option>
                  <option value={2}>Option 2</option>
                  <option value={3}>Option 3</option>
                  <option value={4}>Option 4</option>
                </select>

                {/* Hints */}
                <textarea
                  className={styles.textAreaField}
                  placeholder="Hint 1 (optional)"
                  value={q.hint1}
                  onChange={e => updateQuestion(i, 'hint1', e.target.value)}
                  disabled={submitting}
                />
                <textarea
                  className={styles.textAreaField}
                  placeholder="Hint 2 (optional)"
                  value={q.hint2}
                  onChange={e => updateQuestion(i, 'hint2', e.target.value)}
                  disabled={submitting}
                />

                {/* Remove this question */}
                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={submitting || questions.length <= 1}
                >
                  Remove Question
                </button>
              </div>
            ))}

            {/* Add another question */}
            <button
              type="button"
              onClick={addNewQuestion}
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={submitting}
            >
              + Add Another Question
            </button>
          </div>
        )}


        {/* --- STEP 3: Hints, Tags & Explanation --- */}
        {currentStep === 3 && (
          <div className={`${styles.step} ${styles.step3}`}>
            <div className={styles.formGroup}>
              <label htmlFor="quizHint1">Hint 1:</label>
              <textarea
                id="quizHint1"
                className={styles.textAreaField}
                placeholder="Hint 1 (optional)"
                value={hint1}
                onChange={e => setHint1(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="quizHint2">Hint 2:</label>
              <textarea
                id="quizHint2"
                className={styles.textAreaField}
                placeholder="Hint 2 (optional)"
                value={hint2}
                onChange={e => setHint2(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="quizTags">Tags:</label>
              <input
                id="quizTags"
                className={styles.inputField}
                placeholder="e.g. javascript, react"
                value={tags}
                onChange={e => setTags(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Explanation / Content:</label>
              <CustomEditor onSave={handleSaveContent} isDisabled={submitting} />
            </div>
          </div>
        )}

        {/* --- Navigation Buttons --- */}
        <div className={styles.navigationButtons}>
          {currentStep > 1 && (
            <button type="button" onClick={handleBack} className={`${styles.btn} ${styles.btnBack}`} disabled={submitting}>
              Back
            </button>
          )}
          {currentStep < 3 && (
            <button type="button" onClick={handleNext} className={`${styles.btn} ${styles.btnNext}`} disabled={submitting}>
              Next
            </button>
          )}
          {currentStep === 3 && (
            <button type="submit" className={`${styles.btn} ${styles.btnSubmit}`} disabled={submitting}>
              {submitting ? 'Submitting...' : (quizId ? 'Save Changes' : 'Create Quiz')}
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
  );
};

export default CreateQuiz;
