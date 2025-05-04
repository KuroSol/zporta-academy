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
  const [questions   , setQuestions   ] = useState([
    { question_text: '', option1:'', option2:'', option3:'', option4:'', correct_option:1, hint1:'', hint2:'' }
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

    // --- Build payload ---
    const tagsArray = tags
      ? tags.split(',').map(t => t.trim()).filter(t => t)
      : [];
    const payload = {
      title,
      quiz_type: quizType,
      content,
      subject: subjectOption.isNew ? subjectOption.label : subjectOption.value,
      questions,
      tags: tagsArray,
    };

    try {
      const res = quizId
      ? await apiClient.patch(
          `/quizzes/${quizId}/edit/`,         // ← correct endpoint
          payload,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        )
      : await apiClient.post(
          '/quizzes/',
          payload,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
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

      if ([401,403].includes(err.response?.status)) {
        logout();
        navigate('/login');
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

        {/* --- STEP 2: Questions --- */}
        {currentStep === 2 && (
          <div className={`${styles.step} ${styles.step2}`}>
            {questions.map((q, i) => (
              <div key={i} className={styles.formGroup}>
                <h4>Question {i + 1}</h4>
                <textarea
                  className={styles.textAreaField}
                  placeholder="Question text"
                  value={q.question_text}
                  onChange={e => updateQuestion(i, 'question_text', e.target.value)}
                  required
                  disabled={submitting}
                />
                <input
                  className={styles.inputField}
                  placeholder="Option 1"
                  value={q.option1}
                  onChange={e => updateQuestion(i, 'option1', e.target.value)}
                  required disabled={submitting}
                />
                <input
                  className={styles.inputField}
                  placeholder="Option 2"
                  value={q.option2}
                  onChange={e => updateQuestion(i, 'option2', e.target.value)}
                  required disabled={submitting}
                />
                <input
                  className={styles.inputField}
                  placeholder="Option 3 (optional)"
                  value={q.option3}
                  onChange={e => updateQuestion(i, 'option3', e.target.value)}
                  disabled={submitting}
                />
                <input
                  className={styles.inputField}
                  placeholder="Option 4 (optional)"
                  value={q.option4}
                  onChange={e => updateQuestion(i, 'option4', e.target.value)}
                  disabled={submitting}
                />
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
