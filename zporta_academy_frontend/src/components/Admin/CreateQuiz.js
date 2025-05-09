// src/components/Admin/CreateQuiz.js
import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../api'; // Ensure this path is correct
import { AuthContext } from '../../context/AuthContext'; // Ensure this path is correct
import CustomEditor from '../Editor/CustomEditor'; // Assuming this component exists
import CreateSubjectSelect from './CreateSubjectSelect'; // Assuming this component exists
import styles from './CreateQuiz.module.css';
import { Plus, Trash2, ArrowDown, ArrowUp } from 'lucide-react'; // Added icons

// Helper component for managing lists (e.g., words for sort, items for drag&drop)
const EditableListItem = ({ item, index, onUpdate, onRemove, onMove, canMoveUp, canMoveDown, isDraggable = false }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px', gap: '5px' }}>
      {isDraggable && <span style={{ cursor: 'grab' }}>⠿</span>}
      <input
        type="text"
        value={item.text || item} // Adjust if item is an object
        onChange={(e) => onUpdate(index, e.target.value)}
        className={styles.inputField}
        style={{ flexGrow: 1 }}
        placeholder={`Item ${index + 1}`}
      />
      {onMove && (
        <>
          <button type="button" onClick={() => onMove(index, index - 1)} disabled={!canMoveUp} className={styles.btnMicro}> <ArrowUp size={14} /> </button>
          <button type="button" onClick={() => onMove(index, index + 1)} disabled={!canMoveDown} className={styles.btnMicro}> <ArrowDown size={14} /> </button>
        </>
      )}
      <button type="button" onClick={() => onRemove(index)} className={styles.btnMicroDelete}> <Trash2 size={14} /> </button>
    </div>
  );
};

// Moved and refactored media upload component
const RenderMediaUploads = ({ q, questionIndex, baseName, onUpdate, submittingStatus }) => {
  // q: the question object
  // questionIndex: index of the question (for unique IDs)
  // baseName: e.g., "question", "option1", "option2"
  // onUpdate: the updateQuestionField function
  // submittingStatus: boolean

  const imageUrlField = `${baseName}_image_url`; // e.g., question_image_url, option1_image_url
  const audioUrlField = `${baseName}_audio_url`;
  const imageFileField = `${baseName}_image`;   // e.g., question_image, option1_image
  const audioFileField = `${baseName}_audio`;

  return (
    <div className={styles.mediaUploadRow}>
      <div className={styles.formGroup}>
        <label className={styles.fileLabel} htmlFor={`${baseName}-img-${questionIndex}`}>
          📷 {q[imageFileField]?.name || (q[imageUrlField] ? 'Change Image' : 'Upload Image')}
          <input
            id={`${baseName}-img-${questionIndex}`}
            type="file"
            accept="image/*"
            onChange={e => onUpdate(questionIndex, imageFileField, e.target.files[0])}
            disabled={submittingStatus}
          />
        </label>
        {q[imageUrlField] && !q[imageFileField] && <span className={styles.existingFile}>(Current: <a href={q[imageUrlField]} target="_blank" rel="noopener noreferrer">Image</a>)</span>}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.fileLabel} htmlFor={`${baseName}-aud-${questionIndex}`}>
          🔊 {q[audioFileField]?.name || (q[audioUrlField] ? 'Change Audio' : 'Upload Audio')}
          <input
            id={`${baseName}-aud-${questionIndex}`}
            type="file"
            accept="audio/*"
            onChange={e => onUpdate(questionIndex, audioFileField, e.target.files[0])}
            disabled={submittingStatus}
          />
        </label>
        {q[audioUrlField] && !q[audioFileField] && <span className={styles.existingFile}>(Current: <a href={q[audioUrlField]} target="_blank" rel="noopener noreferrer">Audio</a>)</span>}
      </div>
    </div>
  );
};


const CreateQuiz = ({ onSuccess, onClose, isModalMode = false }) => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  // Removed 'user' as it was not used
  const { token, logout } = useContext(AuthContext);

  const initialQuestionState = useMemo(() => ({
    id: null, // For existing questions during edit
    question_type: 'mcq', // Default type
    question_text: '',
    question_image: null, question_audio: null,
    question_image_url: null, question_audio_url: null, // For displaying existing media
    allow_speech_to_text: false,

    // MCQ/Multi Options
    option1: '', option1_image: null, option1_audio: null, option1_image_url: null, option1_audio_url: null,
    option2: '', option2_image: null, option2_audio: null, option2_image_url: null, option2_audio_url: null,
    option3: '', option3_image: null, option3_audio: null, option3_image_url: null, option3_audio_url: null,
    option4: '', option4_image: null, option4_audio: null, option4_image_url: null, option4_audio_url: null,

    // Answers
    correct_option: 1, // For mcq (1-based index)
    correct_options: [], // For multi (array of 1-based indices)
    correct_answer: '', // For short_answer, speech_input

    question_data: {
      items: [], 
      dropZones: [],
    },
    hint1: '',
    hint2: '',
  }), []);

  const [currentStep, setCurrentStep] = useState(1);
  const [title, setTitle] = useState('');
  const [quizType, setQuizType] = useState('free');
  const [subjectOption, setSubjectOption] = useState(null);
  const [questions, setQuestions] = useState([{ ...initialQuestionState, temp_id: Date.now() }]);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [submitting, setSubmitting] = useState(false);

  const addNewQuestion = () => {
    setQuestions(qs => [...qs, { ...initialQuestionState, temp_id: Date.now() }]);
  };

  const removeQuestion = index => {
    if (questions.length <= 1) {
      setMessage("A quiz must have at least one question.");
      setMessageType('error');
      return;
    }
    setQuestions(qs => qs.filter((_, idx) => idx !== index));
  };

  const updateQuestionField = (qIndex, field, value) => {
    setQuestions(qs => qs.map((q, idx) => idx === qIndex ? { ...q, [field]: value } : q));
  };

  const updateQuestionDataField = (qIndex, field, value) => {
    setQuestions(qs => qs.map((q, idx) => {
      if (idx === qIndex) {
        return { ...q, question_data: { ...q.question_data, [field]: value } };
      }
      return q;
    }));
  };

  const handleQuestionDataItemUpdate = (qIndex, itemIndex, newValue) => {
    const currentItems = questions[qIndex].question_data.items || [];
    const updatedItems = currentItems.map((item, idx) =>
      idx === itemIndex ? (typeof item === 'object' ? {...item, text: newValue} : newValue) : item
    );
    updateQuestionDataField(qIndex, 'items', updatedItems);
  };

  const handleQuestionDataItemRemove = (qIndex, itemIndex) => {
    const currentItems = questions[qIndex].question_data.items || [];
    updateQuestionDataField(qIndex, 'items', currentItems.filter((_, idx) => idx !== itemIndex));
  };

  const addQuestionDataItem = (qIndex, type) => {
      const currentItems = questions[qIndex].question_data[type] || [];
      const newItem = type === 'items' ? { id: `item_${Date.now()}`, text: '' } : { id: `zone_${Date.now()}`, label: '' };
      updateQuestionDataField(qIndex, type, [...currentItems, newItem]);
    };

  const handleQuestionDataMoveItem = (qIndex, itemIndex, direction) => {
    const currentItems = [...(questions[qIndex].question_data.items || [])];
    const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentItems.length) return;
    [currentItems[itemIndex], currentItems[targetIndex]] = [currentItems[targetIndex], currentItems[itemIndex]];
    updateQuestionDataField(qIndex, 'items', currentItems);
  };

  const handleNext = () => setCurrentStep(s => Math.min(3, s + 1));
  const handleBack = () => setCurrentStep(s => Math.max(1, s - 1));

  useEffect(() => {
    if (!quizId || !token) return;
    setSubmitting(true);
    apiClient.get(`/quizzes/${quizId}/edit/`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(({ data }) => {
      const quiz = data.quiz || data;
      setTitle(quiz.title);
      setQuizType(quiz.quiz_type || 'free');
      if (quiz.subject) {
        setSubjectOption({ value: quiz.subject.id, label: quiz.subject.name, isNew: false });
      }
      setContent(quiz.content || '');
      setTags(Array.isArray(quiz.tags) ? quiz.tags.map(t => t.name || t).join(',') : quiz.tags || '');

      setQuestions((quiz.questions || []).map(q => ({
        ...initialQuestionState, // Start with defaults
        id: q.id,
        question_type: q.question_type || 'mcq',
        question_text: q.question_text || '',
        question_image_url: q.question_image || null, // Field for existing image URL
        question_audio_url: q.question_audio || null, // Field for existing audio URL
        question_image: null, // Field for new image file
        question_audio: null, // Field for new audio file
        allow_speech_to_text: q.allow_speech_to_text || false,

        option1: q.option1 || '', option1_image_url: q.option1_image || null, option1_audio_url: q.option1_audio || null, option1_image: null, option1_audio: null,
        option2: q.option2 || '', option2_image_url: q.option2_image || null, option2_audio_url: q.option2_audio || null, option2_image: null, option2_audio: null,
        option3: q.option3 || '', option3_image_url: q.option3_image || null, option3_audio_url: q.option3_audio || null, option3_image: null, option3_audio: null,
        option4: q.option4 || '', option4_image_url: q.option4_image || null, option4_audio_url: q.option4_audio || null, option4_image: null, option4_audio: null,

        correct_option: q.correct_option || 1,
        correct_options: q.correct_options || [],
        correct_answer: q.correct_answer || '',
        
        question_data: {
            items: (q.question_data?.items && Array.isArray(q.question_data.items)) ? q.question_data.items : [],
            dropZones: (q.question_data?.dropZones && Array.isArray(q.question_data.dropZones)) ? q.question_data.dropZones : [],
        },
        hint1: q.hint1 || '',
        hint2: q.hint2 || '',
      })));
      setSubmitting(false);
    })
    .catch(err => {
      console.error('Failed to load quiz for edit:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        if (typeof logout === 'function') logout();
        navigate('/login');
      } else {
        setMessage('Failed to load quiz data for editing.');
        setMessageType('error');
      }
      setSubmitting(false);
    });
  }, [quizId, token]);

  const handleSaveContent = useCallback(html => setContent(html), []);

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    if (!token) {
      setMessage('Authentication error. Please log in again.'); setSubmitting(false); return;
    }
    if (!title.trim()) {
      setMessage('Quiz title is required.'); setCurrentStep(1); setSubmitting(false); return;
    }
    if (!subjectOption) {
      setMessage('Subject is required.'); setCurrentStep(1); setSubmitting(false); return;
    }

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.question_text?.trim()) {
            setMessage(`Text for Question ${i + 1} is required.`); setCurrentStep(2); setSubmitting(false); return;
        }
        if (['mcq', 'multi'].includes(q.question_type) && (!q.option1?.trim() || !q.option2?.trim())) {
            setMessage(`Option 1 and Option 2 for Question ${i + 1} are required.`); setCurrentStep(2); setSubmitting(false); return;
        }
        if (q.question_type === 'short' && !q.correct_answer?.trim() && !q.allow_speech_to_text) {
            // Consider if empty correct_answer is valid if speech is not allowed.
            // setMessage(`Correct answer for short answer Question ${i + 1} is required.`); setCurrentStep(2); setSubmitting(false); return;
        }
        if (q.question_type === 'word_sort' && (!q.question_data?.items || q.question_data.items.length < 2)) {
            setMessage(`At least two words are required for word sort Question ${i + 1}.`); setCurrentStep(2); setSubmitting(false); return;
        }
        if (q.question_type === 'dragdrop') {
            if (!q.question_data?.items || q.question_data.items.length === 0) {
                setMessage(`At least one draggable item is required for Question ${i + 1}.`); setCurrentStep(2); setSubmitting(false); return;
            }
            if (!q.question_data?.dropZones || q.question_data.dropZones.length === 0) {
                setMessage(`At least one drop zone is required for Question ${i + 1}.`); setCurrentStep(2); setSubmitting(false); return;
            }
        }
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('quiz_type', quizType);
    formData.append('content', content);
    formData.append('subject_name', subjectOption.label);
    if (!subjectOption.isNew && subjectOption.value) {
      formData.append('subject_id', subjectOption.value);
    }
    (tags.split(',').map(t => t.trim()).filter(Boolean)).forEach(tag => formData.append('tags', tag));

    questions.forEach((q, qi) => {
      if (q.id) formData.append(`questions[${qi}]id`, q.id);

      formData.append(`questions[${qi}]question_type`, q.question_type);
      formData.append(`questions[${qi}]question_text`, q.question_text);
      formData.append(`questions[${qi}]allow_speech_to_text`, q.allow_speech_to_text);
      formData.append(`questions[${qi}]hint1`, q.hint1 || '');
      formData.append(`questions[${qi}]hint2`, q.hint2 || '');

      if (q.question_image instanceof File) formData.append(`questions[${qi}]question_image`, q.question_image);
      if (q.question_audio instanceof File) formData.append(`questions[${qi}]question_audio`, q.question_audio);

      if (['mcq', 'multi'].includes(q.question_type)) {
        formData.append(`questions[${qi}]option1`, q.option1);
        formData.append(`questions[${qi}]option2`, q.option2);
        formData.append(`questions[${qi}]option3`, q.option3 || '');
        formData.append(`questions[${qi}]option4`, q.option4 || '');

        if (q.option1_image instanceof File) formData.append(`questions[${qi}]option1_image`, q.option1_image);
        if (q.option1_audio instanceof File) formData.append(`questions[${qi}]option1_audio`, q.option1_audio);
        if (q.option2_image instanceof File) formData.append(`questions[${qi}]option2_image`, q.option2_image);
        if (q.option2_audio instanceof File) formData.append(`questions[${qi}]option2_audio`, q.option2_audio);
        if (q.option3_image instanceof File) formData.append(`questions[${qi}]option3_image`, q.option3_image);
        if (q.option3_audio instanceof File) formData.append(`questions[${qi}]option3_audio`, q.option3_audio);
        if (q.option4_image instanceof File) formData.append(`questions[${qi}]option4_image`, q.option4_image);
        if (q.option4_audio instanceof File) formData.append(`questions[${qi}]option4_audio`, q.option4_audio);

        if (q.question_type === 'mcq') {
          formData.append(`questions[${qi}]correct_option`, q.correct_option);
        } else if (q.question_type === 'multi') {
          const validCorrectOptions = (q.correct_options || []).map(Number).filter(n => !isNaN(n) && n > 0);
          formData.append(`questions[${qi}]correct_options`, JSON.stringify(validCorrectOptions));
        }
      } else if (q.question_type === 'short' || q.question_type === 'speech_input') {
        formData.append(`questions[${qi}]correct_answer`, q.correct_answer);
      } else if (q.question_type === 'sort') {
        formData.append(`questions[${qi}]question_data`, JSON.stringify({ items: q.question_data.items.map(item => typeof item === 'object' ? item.text : item) }));
        formData.append(`questions[${qi}]correct_options`, JSON.stringify( (q.correct_options && q.correct_options.length > 0) ? q.correct_options : q.question_data.items.map(item => typeof item === 'object' ? item.text : item) ));
      } else if (q.question_type === 'dragdrop') {
        formData.append(`questions[${qi}]question_data`, JSON.stringify(q.question_data));
        formData.append(`questions[${qi}]correct_options`, JSON.stringify(q.correct_options || {solution: []}));
      }
    });

    try {
      const config = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } };
      const res = quizId
        ? await apiClient.patch(`/quizzes/${quizId}/edit/`, formData, config)
        : await apiClient.post('/quizzes/', formData, config);

      const savedQuiz = res.data.quiz || res.data;
      setMessageType('success');
      setMessage(`Quiz '${savedQuiz.title}' ${quizId ? 'updated' : 'created'} successfully!`);

      if (typeof onSuccess === 'function') onSuccess(savedQuiz);
      if (typeof onClose === 'function') setTimeout(onClose, 1500);

      if (!isModalMode && savedQuiz.permalink) {
        setTimeout(() => navigate(`/quizzes/${savedQuiz.permalink}`), 1500);
      } else if (!isModalMode) {
        setTimeout(() => navigate('/dashboard'), 1500);
      }

    } catch (err) {
      console.error('Error saving quiz:', err.response || err);
      let errMsg = `Failed to ${quizId ? 'update' : 'create'} quiz.`;
        if (err.response?.data) {
        const errors = err.response.data;
        const detailedMessages = [];
        if (typeof errors === 'object' && errors !== null) {
            for (const key in errors) {
                if (key === 'questions' && Array.isArray(errors[key])) {
                    errors[key].forEach((qError, qIndex) => {
                        if (typeof qError === 'object' && qError !== null) {
                            for (const qField in qError) {
                                detailedMessages.push(`Q${qIndex+1} ${qField}: ${qError[qField]}`);
                            }
                        } else if (typeof qError === 'string') {
                            detailedMessages.push(`Q${qIndex+1}: ${qError}`);
                        }
                    });
                } else {
                    detailedMessages.push(`${key}: ${Array.isArray(errors[key]) ? errors[key].join(', ') : errors[key]}`);
                }
            }
        }
        if (detailedMessages.length > 0) errMsg = detailedMessages.join('; ');
        else if (errors.detail) errMsg = errors.detail;
      } else if (err.request) {
        errMsg = 'Network error. Please check your connection.';
      }
      setMessageType('error');
      setMessage(errMsg);
      if (err.response?.status === 401) { if (typeof logout === 'function') logout(); navigate('/login'); }
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercent = (currentStep / 3) * 100;

  const renderQuestionSpecificFields = (q, i) => {
    // Helper for rendering option text and media inputs
    const renderOptionInputs = (optNum) => (
        <div key={optNum} className={styles.optionGroup}>
            <label className={styles.inputLabel} htmlFor={`q-${i}-opt${optNum}-text`}>
            Option {optNum}: {optNum <= 2 ? <span className={styles.required}>*</span> : '(Optional)'}
            </label>
            <div className={styles.fileInputGroup}> {/* This div groups text input and media labels */}
                <input 
                    id={`q-${i}-opt${optNum}-text`} 
                    className={styles.inputField} 
                    placeholder={`Text for Option ${optNum}`} 
                    value={q[`option${optNum}`] || ''} 
                    onChange={e => updateQuestionField(i, `option${optNum}`, e.target.value)} 
                    required={optNum <= 2 && ['mcq', 'multi'].includes(q.question_type)} 
                    disabled={submitting} 
                />
                {/* Use RenderMediaUploads for option media */}
                <RenderMediaUploads
                    q={q}
                    questionIndex={i} // Keep questionIndex for unique IDs in RenderMediaUploads if it uses it for element IDs
                    baseName={`option${optNum}`} // e.g., option1, option2
                    onUpdate={updateQuestionField}
                    submittingStatus={submitting}
                />
            </div>
        </div>
    );

    switch (q.question_type) {
      case 'mcq':
      case 'multi':
        return (
          <>
            {[1, 2, 3, 4].map(optNum => renderOptionInputs(optNum))}
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Correct Answer(s):</label>
              {q.question_type === 'mcq' ? (
                <select className={styles.selectField} value={q.correct_option} onChange={e => updateQuestionField(i, 'correct_option', parseInt(e.target.value))} disabled={submitting} required>
                  {[1, 2, 3, 4].map(n => q[`option${n}`]?.trim() && <option key={n} value={n}>Option {n}</option>)}
                </select>
              ) : (
                <div className={styles.checkboxGroup}>
                  {[1, 2, 3, 4].map(n => q[`option${n}`]?.trim() && (
                    <label key={n} className={styles.checkboxLabel}>
                      <input type="checkbox" checked={q.correct_options.includes(n)} onChange={e => {
                        const newCorrectOptions = e.target.checked
                          ? [...q.correct_options, n]
                          : q.correct_options.filter(opt => opt !== n);
                        updateQuestionField(i, 'correct_options', newCorrectOptions.sort((a,b) => a-b));
                      }} disabled={submitting} /> Option {n}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        );
      case 'short':
        return (
          <div className={styles.formGroup}>
            <label className={styles.inputLabel} htmlFor={`q-${i}-correctanswer`}>Expected Correct Answer: <span className={styles.required}>*</span></label>
            <input id={`q-${i}-correctanswer`} type="text" className={styles.inputField} placeholder="Enter the exact correct answer" value={q.correct_answer} onChange={e => updateQuestionField(i, 'correct_answer', e.target.value)} disabled={submitting} required={!q.allow_speech_to_text} />
          </div>
        );
        case 'sort':
        return (
          <>
            <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Words to Sort (Enter one per line. Define correct order below or assume current order is correct):</label>
                {(q.question_data.items || []).map((item, itemIdx) => (
                    <EditableListItem
                        key={item.id || itemIdx}
                        item={item}
                        index={itemIdx}
                        onUpdate={(idx, val) => handleQuestionDataItemUpdate(i, idx, val)}
                        onRemove={() => handleQuestionDataItemRemove(i, itemIdx)}
                        onMove={(idx, newIdx) => handleQuestionDataMoveItem(i, idx, newIdx > idx ? 'down' : 'up')}
                        canMoveUp={itemIdx > 0}
                        canMoveDown={itemIdx < (q.question_data.items || []).length - 1}
                    />
                ))}
                <button type="button" onClick={() => addQuestionDataItem(i, 'items')} className={styles.btnAddItem}> <Plus size={16} /> Add Word </button>
            </div>
            <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Correctly Sorted Order (JSON array of texts):</label>
                <textarea
                    className={styles.textAreaField}
                    placeholder='e.g., ["First correct word", "Second correct word"]'
                    value={Array.isArray(q.correct_options) ? JSON.stringify(q.correct_options) : ""}
                    onChange={e => {
                        try { updateQuestionField(i, 'correct_options', JSON.parse(e.target.value)); }
                        catch (_) { /* Optionally handle invalid JSON, e.g., set an error message */ }
                    }}
                    rows={3}
                    disabled={submitting}
                />
                <small>If empty, the order of words entered above will be assumed correct upon submission.</small>
            </div>
          </>
        );
      case 'dragdrop':
        return (
          <>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Draggable Items:</label>
              {(q.question_data.items || []).map((item, itemIdx) => (
                <EditableListItem
                    key={item.id || itemIdx}
                    item={item}
                    index={itemIdx}
                    onUpdate={(idx, val) => handleQuestionDataItemUpdate(i, idx, val)}
                    onRemove={() => handleQuestionDataItemRemove(i, itemIdx)}
                />
              ))}
              <button type="button" onClick={() => addQuestionDataItem(i, 'items')} className={styles.btnAddItem}> <Plus size={16} /> Add Draggable Item </button>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Drop Zones:</label>
              {(q.question_data.dropZones || []).map((zone, zoneIdx) => (
                   <EditableListItem
                      key={zone.id || zoneIdx}
                      item={zone.label} // Assuming zone has a label property
                      index={zoneIdx}
                      onUpdate={(idx, val) => {
                          const updatedZones = (q.question_data.dropZones || []).map((z, zIdx) => zIdx === idx ? {...z, label: val} : z);
                          updateQuestionDataField(i, 'dropZones', updatedZones);
                      }}
                      onRemove={() => {
                          const updatedZones = (q.question_data.dropZones || []).filter((_, zIdx) => zIdx !== zoneIdx);
                          updateQuestionDataField(i, 'dropZones', updatedZones);
                      }}
                  />
              ))}
              <button type="button" onClick={() => addQuestionDataItem(i, 'dropZones')} className={styles.btnAddItem}> <Plus size={16} /> Add Drop Zone </button>
            </div>
            <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Correct Item-to-Zone Mapping (JSON: {`{"solution": [{"itemId": "id_of_item", "zoneId": "id_of_zone"}, ...]}`}):</label>
                <textarea
                    className={styles.textAreaField}
                    placeholder='e.g., {"solution": [{"itemId": "item_xyz", "zoneId": "zone_abc"}]}'
                    value={typeof q.correct_options === 'object' && q.correct_options !== null ? JSON.stringify(q.correct_options) : ""}
                    onChange={e => {
                        try { updateQuestionField(i, 'correct_options', JSON.parse(e.target.value)); }
                        catch (_) { /* Optionally handle invalid JSON */ }
                    }}
                    rows={4}
                    disabled={submitting}
                />
                <small>Ensure `itemId` and `zoneId` match the IDs generated for items/zones (these are auto-generated if not loaded from DB).</small>
            </div>
          </>
        );
      default:
        return <p>Unsupported question type.</p>;
    }
  };

  return (
    <div className={!isModalMode ? styles.pageWrapper : ''}>
      <div className={styles.createQuizContainer}>
        <h3 className={styles.modalFormTitle}>{quizId ? 'Edit Quiz' : 'Create New Quiz'}</h3>
        <div className={styles.progressContainer}><div className={styles.progressBar} style={{ width: `${progressPercent}%` }} /></div>
        {message && <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>{message}</p>}

        <form onSubmit={handleSubmit} className={styles.quizForm}>
          {currentStep === 1 && (
            <div className={`${styles.step} ${styles.step1}`}>
              {quizId && <p className={styles.infoText}>⚠️ Title cannot be changed after creation. Subject can be changed.</p>}
              <div className={styles.formGroup}>
                <label htmlFor="quizTitle" className={styles.inputLabel}>Title: <span className={styles.required}>*</span></label>
                <input id="quizTitle" type="text" value={title} onChange={e => setTitle(e.target.value)} required disabled={submitting || Boolean(quizId)} className={styles.inputField} placeholder="Enter a clear and concise quiz title" />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="quizType" className={styles.inputLabel}>Quiz Type:</label>
                <select id="quizType" value={quizType} onChange={e => setQuizType(e.target.value)} disabled={submitting} className={styles.selectField}>
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="quizSubject" className={styles.inputLabel}>Subject: <span className={styles.required}>*</span></label>
                <CreateSubjectSelect onChange={setSubjectOption} value={subjectOption} isDisabled={submitting} aria-labelledby="quizSubject" />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className={`${styles.step} ${styles.step2}`}>
              {questions.map((q, i) => (
                <div key={q.id || q.temp_id || i} className={styles.questionBlock}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h4>Question {i + 1}</h4>
                    <button type="button" onClick={() => removeQuestion(i)} className={styles.removeQuestionButton} disabled={submitting || questions.length <= 1} title="Remove Question"> <Trash2 size={18} /> </button>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.inputLabel} htmlFor={`q-type-${i}`}>Question Type:</label>
                    <select id={`q-type-${i}`} className={styles.selectField} value={q.question_type} onChange={e => updateQuestionField(i, 'question_type', e.target.value)} disabled={submitting}>
                      <option value="mcq">Multiple Choice (Single Correct)</option>
                      <option value="multi">Multiple Select (Multiple Correct)</option>
                      <option value="short">Short Answer</option>
                      <option value="sort">Word Sort</option>
                      <option value="dragdrop">Drag and Drop</option>
                      {/* <option value="speech_input">Speech Input</option> */}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.inputLabel} htmlFor={`q-text-${i}`}>Question Text: <span className={styles.required}>*</span></label>
                    <textarea id={`q-text-${i}`} className={styles.textAreaField} placeholder="Enter the question text..." value={q.question_text} onChange={e => updateQuestionField(i, 'question_text', e.target.value)} required disabled={submitting} rows={3} />
                  </div>

                  {/* Render media inputs for the question itself */}
                  <RenderMediaUploads
                    q={q}
                    questionIndex={i}
                    baseName="question" // For fields like question_image, question_audio
                    onUpdate={updateQuestionField}
                    submittingStatus={submitting}
                  />
                  
                  <div className={styles.formGroup}>
                      <label className={styles.checkboxLabel}>
                          <input type="checkbox" checked={q.allow_speech_to_text} onChange={e => updateQuestionField(i, 'allow_speech_to_text', e.target.checked)} disabled={submitting} />
                          Allow Speech Input for this question (requires student microphone)
                      </label>
                  </div>

                  {renderQuestionSpecificFields(q, i)}

                  <div className={styles.formGroup}>
                    <label className={styles.inputLabel} htmlFor={`q-${i}-hint1`}>Hint 1 (Optional):</label>
                    <input id={`q-${i}-hint1`} type="text" className={styles.inputField} placeholder="Enter first hint" value={q.hint1} onChange={e => updateQuestionField(i, 'hint1', e.target.value)} disabled={submitting} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.inputLabel} htmlFor={`q-${i}-hint2`}>Hint 2 (Optional):</label>
                    <input id={`q-${i}-hint2`} type="text" className={styles.inputField} placeholder="Enter second hint" value={q.hint2} onChange={e => updateQuestionField(i, 'hint2', e.target.value)} disabled={submitting} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addNewQuestion} className={`${styles.btn} ${styles.btnAddQuestion}`} disabled={submitting}> <Plus size={16} /> Add Question </button>
            </div>
          )}

          {currentStep === 3 && (
            <div className={`${styles.step} ${styles.step3}`}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Explanation / Main Quiz Content (Optional):</label>
                <div className={styles.editorContainer}>
                  <CustomEditor initialContent={content} onSave={handleSaveContent} isDisabled={submitting} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="quizTags" className={styles.inputLabel}>Tags (Optional, comma-separated):</label>
                <input id="quizTags" className={styles.inputField} placeholder="e.g. javascript, react, web development" value={tags} onChange={e => setTags(e.target.value)} disabled={submitting} />
              </div>
            </div>
          )}

          <div className={styles.navigationButtons}>
            {currentStep > 1 && <button type="button" onClick={handleBack} className={`${styles.btn} ${styles.btnBack}`} disabled={submitting}>Back</button>}
            <div style={{ flexGrow: 1 }}></div> {/* Spacer */}
            {currentStep < 3 && <button type="button" onClick={handleNext} className={`${styles.btn} ${styles.btnNext}`} disabled={submitting}>Next</button>}
            {currentStep === 3 && <button type="submit" className={`${styles.btn} ${styles.btnSubmit}`} disabled={submitting}>{submitting ? 'Saving...' : (quizId ? 'Save Changes' : 'Create Quiz')}</button>}
            {isModalMode && <button type="button" onClick={onClose} className={`${styles.btn} ${styles.btnSecondary}`} disabled={submitting}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQuiz;
