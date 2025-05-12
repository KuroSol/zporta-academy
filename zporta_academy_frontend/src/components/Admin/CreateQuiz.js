// src/components/Admin/CreateQuiz.js
import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../api'; // Ensure this path is correct
import { AuthContext } from '../../context/AuthContext'; // Ensure this path is correct
import CustomEditor from '../Editor/CustomEditor'; // Assuming this component exists
import CreateSubjectSelect from './CreateSubjectSelect'; // Assuming this component exists
import styles from './CreateQuiz.module.css';
import { Plus, Trash2, HelpCircle } from 'lucide-react'; // Added HelpCircle

// Helper component for managing lists (e.g., words for sort, items for drag&drop)
const EditableListItem = ({
  item,
  index,
  onUpdate,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
  isDraggable = false, // Not used in current context but kept for potential future use
  placeholderText = "Item"
}) => (
  <div className={styles.editableListItem}>
    {/* Optional drag handle */}
    {isDraggable && <span className={styles.dragHandle}>⠿</span>}
    {/* Input field for the item text */}
    <input
      type="text"
      value={item} // item is expected to be a string for 'sort'
      onChange={e => onUpdate(index, e.target.value)}
      className={styles.inputField}
      placeholder={`${placeholderText} ${index + 1}`}
    />
    {/* Optional move up/down buttons */}
    {onMove && (
      <>
        <button type="button" onClick={() => onMove(index, index - 1)} disabled={!canMoveUp} className={styles.btnMicro}>↑</button>
        <button type="button" onClick={() => onMove(index, index + 1)} disabled={!canMoveDown} className={styles.btnMicro}>↓</button>
      </>
    )}
    {/* Remove button */}
    <button type="button" onClick={() => onRemove(index)} className={styles.btnMicroDelete} title="Remove Item"><Trash2 size={14}/></button>
  </div>
);


// Component for rendering image and audio upload inputs
const RenderMediaUploads = ({ q, questionIndex, baseName, onUpdate, submittingStatus }) => {
  // Construct field names based on the base name (e.g., 'question', 'option1')
  const imageUrlField = `${baseName}_image_url`; // Field for existing image URL
  const audioUrlField = `${baseName}_audio_url`; // Field for existing audio URL
  const imageFileField = `${baseName}_image`;   // Field for new image File object
  const audioFileField = `${baseName}_audio`;   // Field for new audio File object

  return (
    <div className={styles.mediaUploadRow}>
      {/* Image Upload */}
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
        {/* Display link to existing image or name of new file */}
        {q[imageUrlField] && !q[imageFileField] && <span className={styles.existingFile}>(Current: <a href={q[imageUrlField]} target="_blank" rel="noopener noreferrer">Image</a>)</span>}
        {q[imageFileField] && <span className={styles.newFilePreview}>New: {q[imageFileField].name}</span>}
      </div>
      {/* Audio Upload */}
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
         {/* Display link to existing audio or name of new file */}
        {q[audioUrlField] && !q[audioFileField] && <span className={styles.existingFile}>(Current: <a href={q[audioUrlField]} target="_blank" rel="noopener noreferrer">Audio</a>)</span>}
        {q[audioFileField] && <span className={styles.newFilePreview}>New: {q[audioFileField].name}</span>}
      </div>
    </div>
  );
};


// Main component for creating or editing a quiz
const CreateQuiz = ({ onSuccess, onClose, isModalMode = false }) => {
  const { quizId } = useParams(); // Get quizId from URL if editing
  const navigate = useNavigate();
  const { token, logout } = useContext(AuthContext); // Get auth token and logout function

  // Memoized initial state for a new question
  const initialQuestionState = useMemo(() => ({
    id: null, // Database ID (null for new questions)
    temp_id: Date.now() + Math.random(), // Unique temporary ID for frontend mapping (especially dragdrop)
    question_type: 'mcq',
    question_text: '',
    question_image: null, // New image file
    question_audio: null, // New audio file
    question_image_url: null, // URL of existing image
    question_audio_url: null, // URL of existing audio
    allow_speech_to_text: false,

    // Specific fields for 'dragdrop' type (kept for simpler state management initially)
    drag_sentence: '', // Sentence with '*' placeholders
    drag_words: '',    // Comma-separated list of draggable words

    // Options (primarily for MCQ/Multi)
    option1: '', option1_image: null, option1_audio: null, option1_image_url: null, option1_audio_url: null,
    option2: '', option2_image: null, option2_audio: null, option2_image_url: null, option2_audio_url: null,
    option3: '', option3_image: null, option3_audio: null, option3_image_url: null, option3_audio_url: null,
    option4: '', option4_image: null, option4_audio: null, option4_image_url: null, option4_audio_url: null,

    // Correct answers based on type
    correct_option: 1,    // For MCQ (index 1-4)
    correct_options: [],  // For Multi (array of indices [1-4]), Sort (array of strings), DragDrop (array of {zoneId, itemId})
    correct_answer: '',   // For Short Answer

    // Structured data for complex types
    question_data: {
      items: [],     // For 'sort' (array of strings), 'dragdrop' (array of {id, text})
      dropZones: [], // For 'dragdrop' (array of {id, label})
    },
    hint1: '',
    hint2: '',
  }), []);

  // --- Component State ---
  const [currentStep, setCurrentStep] = useState(1); // Form step (1: Details, 2: Questions, 3: Content)
  const [title, setTitle] = useState('');
  const [quizType, setQuizType] = useState('free');
  const [subjectOption, setSubjectOption] = useState(null); // Selected subject { value, label, isNew }
  const [questions, setQuestions] = useState([{ ...initialQuestionState, temp_id: Date.now() + '_qs1' + Math.random() }]); // Array of question states
  const [content, setContent] = useState(''); // Rich text content for the quiz explanation
  const [tags, setTags] = useState(''); // Comma-separated tags string
  const [message, setMessage] = useState(''); // Feedback message (error or success)
  const [messageType, setMessageType] = useState('error');
  const [submitting, setSubmitting] = useState(false); // Loading state during submission

  // --- Question Management Functions ---
  const addNewQuestion = () => {
    // Add a new question with a unique temp_id
    setQuestions(qs => [...qs, { ...initialQuestionState, temp_id: Date.now() + `_qs${qs.length + 1}` + Math.random() }]);
  };

  const removeQuestion = index => {
    // Prevent removing the last question
    if (questions.length <= 1) {
      setMessage("A quiz must have at least one question.");
      setMessageType('error');
      return;
    }
    setQuestions(qs => qs.filter((_, idx) => idx !== index));
  };

  // Generic function to update any field of a specific question
  const updateQuestionField = (qIndex, field, value) => {
    setQuestions(qs => qs.map((q, idx) => {
      if (idx === qIndex) {
        const updatedQ = { ...q, [field]: value };

        // --- Reset fields when question type changes ---
        if (field === 'question_type') {
            updatedQ.correct_options = []; // Reset for multi, sort, dragdrop
            updatedQ.correct_option = 1;  // Reset for mcq
            updatedQ.correct_answer = ''; // Reset for short
            updatedQ.drag_sentence = '';  // Reset dragdrop specific input fields
            updatedQ.drag_words = '';
            updatedQ.question_data = { items: [], dropZones: [] }; // Reset internal data structure
        }

        // --- Update dragdrop config if relevant fields change ---
        // This recalculates items, dropZones, and resets/preserves the solution structure
        if (updatedQ.question_type === 'dragdrop' && (field === 'drag_sentence' || field === 'drag_words' || field === 'question_type')) {
            return handleDragDropConfigChange(updatedQ);
        }
        return updatedQ;
      }
      return q;
    }));
  };

  // Recalculates question_data (items, dropZones) and correct_options structure for dragdrop
  const handleDragDropConfigChange = (questionState) => {
    const newQ = { ...questionState };
    // Create draggable items from comma-separated words
    const wordsArray = (newQ.drag_words || '').split(',')
        .map(w => w.trim())
        .filter(Boolean); // Remove empty strings

    // Count blanks in the sentence
    const blankMatches = (newQ.drag_sentence || '').match(/\*/g);
    const blankCount = blankMatches ? blankMatches.length : 0;

    // Update question_data with new items and dropZones, using temp_id for uniqueness
    newQ.question_data = {
        items: wordsArray.map((w, i) => ({ id: `item_${newQ.temp_id}_${i}`, text: w })),
        dropZones: Array.from({ length: blankCount }, (_, i) => ({ id: `zone_${newQ.temp_id}_${i}`, label: `Blank ${i + 1}` }))
    };

    // --- Preserve or Reset Solution Structure ---
    let currentSolution = Array.isArray(newQ.correct_options) ? newQ.correct_options : [];
    // Create a new solution array matching the number of blanks
    const newSolution = Array.from({ length: blankCount }, (_, i) => {
        const existingEntry = currentSolution[i];
        // Try to preserve the existing selected item if it still exists in the new words list
        if (existingEntry && newQ.question_data.items.find(item => item.id === existingEntry.itemId)) {
            return { zoneId: newQ.question_data.dropZones[i]?.id, itemId: existingEntry.itemId };
        }
        // Otherwise, reset the solution for this blank
        return { zoneId: newQ.question_data.dropZones[i]?.id, itemId: '' }; // Default to empty selection
    });
    newQ.correct_options = newSolution; // Update the state with the new solution structure

    return newQ; // Return the fully updated question state
  };

  // Updates the selected item for a specific blank in a dragdrop question's solution
  const updateDragDropSolution = (qIndex, blankIndex, selectedItemId) => {
    setQuestions(qs => qs.map((q, idx) => {
        if (idx === qIndex && q.question_type === 'dragdrop') {
            const newSolution = [...(q.correct_options || [])]; // Copy existing solution
            const zoneId = q.question_data?.dropZones?.[blankIndex]?.id; // Get the zone ID

            if (zoneId && newSolution[blankIndex]) {
                 // Update the itemId for the specific blank index
                 newSolution[blankIndex] = { ...newSolution[blankIndex], itemId: selectedItemId };
            } else if (zoneId) {
                 // Initialize if the slot didn't exist properly
                 newSolution[blankIndex] = { zoneId: zoneId, itemId: selectedItemId };
            } else {
                // Log warning if zone data is missing (shouldn't normally happen)
                console.warn("Drop zone data missing for blank index:", blankIndex, "in question:", qIndex);
                // Attempt to create a fallback zoneId (less ideal)
                newSolution[blankIndex] = { zoneId: `zone_${q.temp_id}_${blankIndex}`, itemId: selectedItemId };
            }
            return { ...q, correct_options: newSolution }; // Return updated question
        }
        return q;
    }));
  };


  // Updates nested fields within question_data (currently only used for 'sort' items)
  const updateQuestionDataField = (qIndex, field, value) => {
    setQuestions(qs => qs.map((q, idx) => {
      if (idx === qIndex) {
        return { ...q, question_data: { ...q.question_data, [field]: value } };
      }
      return q;
    }));
  };

  // --- Handlers for Word Sort Items ---
  const handleSortItemUpdate = (qIndex, itemIndex, newValue) => {
    const currentItems = questions[qIndex].question_data.items || [];
    const updatedItems = currentItems.map((item, idx) =>
      idx === itemIndex ? newValue : item // Update the specific item (string)
    );
    updateQuestionDataField(qIndex, 'items', updatedItems);
    // Also update correct_options to reflect the new text if it's the correct solution
    updateQuestionField(qIndex, 'correct_options', updatedItems);
  };

  const handleSortItemRemove = (qIndex, itemIndex) => {
    const currentItems = questions[qIndex].question_data.items || [];
    const updatedItems = currentItems.filter((_, idx) => idx !== itemIndex);
    updateQuestionDataField(qIndex, 'items', updatedItems);
     // Also update correct_options
    updateQuestionField(qIndex, 'correct_options', updatedItems);
  };

  const addSortItem = (qIndex) => {
    const currentItems = questions[qIndex].question_data.items || [];
    const updatedItems = [...currentItems, '']; // Add a new empty string
    updateQuestionDataField(qIndex, 'items', updatedItems);
     // Also update correct_options
    updateQuestionField(qIndex, 'correct_options', updatedItems);
  };

  const handleSortItemMove = (qIndex, itemIndex, newIndex) => {
    const currentItems = [...(questions[qIndex].question_data.items || [])];
    if (newIndex < 0 || newIndex >= currentItems.length) return; // Bounds check
    const itemToMove = currentItems.splice(itemIndex, 1)[0]; // Remove item
    currentItems.splice(newIndex, 0, itemToMove); // Insert item at new position
    updateQuestionDataField(qIndex, 'items', currentItems);
     // Also update correct_options to reflect the new order
    updateQuestionField(qIndex, 'correct_options', currentItems);
  };


  // --- Step Navigation ---
  const handleNext = () => setCurrentStep(s => Math.min(3, s + 1));
  const handleBack = () => setCurrentStep(s => Math.max(1, s - 1));

  // --- Load Quiz Data for Editing ---
  useEffect(() => {
    if (!quizId || !token) return; // Only run if editing and logged in
    setSubmitting(true);
    setMessage(''); // Clear previous messages
    apiClient.get(`/quizzes/${quizId}/edit/`, { // Use appropriate edit endpoint
      // Authorization header is likely handled by apiClient interceptor, but explicit here for clarity
      // headers: { Authorization: `Token ${token}` } // Use Token for Django REST Auth Token
    })
    .then(({ data }) => {
      const quiz = data.quiz || data; // Adjust based on your API response structure

      // --- Populate Basic Quiz Info ---
      setTitle(quiz.title);
      setQuizType(quiz.quiz_type || 'free');
      if (quiz.subject) {
        // Assuming subject is an object with id and name
        setSubjectOption({ value: quiz.subject.id, label: quiz.subject.name, isNew: false });
      }
      setContent(quiz.content || '');
      // Populate tags from the array of tag objects/strings
      setTags(Array.isArray(quiz.tags) ? quiz.tags.map(t => t.name || t).join(',') : (quiz.tags || ''));

      // --- Populate Questions ---
      setQuestions((quiz.questions || []).map((q, idx) => {
        // Start with initial state and override with loaded data
        let loadedQuestion = {
            ...initialQuestionState,
            id: q.id, // Keep the database ID
            temp_id: q.id || Date.now() + `_loaded_${idx}` + Math.random(), // Use DB ID or generate temp_id
            question_type: q.question_type || 'mcq',
            question_text: q.question_text || '',
            question_image_url: q.question_image || null, // URLs for existing media
            question_audio_url: q.question_audio || null,
            allow_speech_to_text: q.allow_speech_to_text || false,
            option1: q.option1 || '', option1_image_url: q.option1_image || null, option1_audio_url: q.option1_audio || null,
            option2: q.option2 || '', option2_image_url: q.option2_image || null, option2_audio_url: q.option2_audio || null,
            option3: q.option3 || '', option3_image_url: q.option3_image || null, option3_audio_url: q.option3_audio || null,
            option4: q.option4 || '', option4_image_url: q.option4_image || null, option4_audio_url: q.option4_audio || null,
            correct_option: q.correct_option !== null ? q.correct_option : 1, // Default to 1 if null
            correct_options: Array.isArray(q.correct_options) ? q.correct_options : [], // Ensure array for multi/sort
            correct_answer: q.correct_answer || '',
            question_data: { // Ensure structure exists
                items: (q.question_data?.items && Array.isArray(q.question_data.items)) ? q.question_data.items : [],
                dropZones: (q.question_data?.dropZones && Array.isArray(q.question_data.dropZones)) ? q.question_data.dropZones : [],
            },
            hint1: q.hint1 || '',
            hint2: q.hint2 || '',
            // --- Drag & Drop Specific Loading ---
            // Assume backend sends _fill_blank structure for reading dragdrop questions
            drag_sentence: q._fill_blank?.sentence || '',
            // Reconstruct drag_words from the nested _fill_blank.words array
            drag_words: (q._fill_blank?.words || []).map(w => w.text).join(','),
        };

        // --- Post-Process Drag & Drop ---
        if (loadedQuestion.question_type === 'dragdrop') {
            // Re-run config change to populate question_data.items/dropZones based on loaded sentence/words
            loadedQuestion = handleDragDropConfigChange(loadedQuestion);

            // Map the loaded solution from _fill_blank.solutions to the correct_options structure
            // The backend sends BlankSolution objects with correct_word as the ID of the BlankWord
            // We need to map this back to the temporary frontend item ID
            if (q._fill_blank?.solutions && Array.isArray(q._fill_blank.solutions)) {
                const loadedSolutionMap = {}; // Map slot_index to correct_word ID
                q._fill_blank.solutions.forEach(sol => {
                    loadedSolutionMap[sol.slot_index] = sol.correct_word; // Store backend BlankWord ID
                });

                // Find the corresponding frontend item ID for each backend BlankWord ID
                const backendWordIdToFrontendItemId = {};
                (q._fill_blank.words || []).forEach((word, wordIdx) => {
                    const frontendId = loadedQuestion.question_data.items[wordIdx]?.id;
                    if (frontendId) {
                        backendWordIdToFrontendItemId[word.id] = frontendId;
                    }
                });

                // Build the correct_options array for the frontend state
                loadedQuestion.correct_options = loadedQuestion.question_data.dropZones.map((zone, zoneIdx) => {
                    const backendWordId = loadedSolutionMap[zoneIdx];
                    const frontendItemId = backendWordId ? backendWordIdToFrontendItemId[backendWordId] : '';
                    return { zoneId: zone.id, itemId: frontendItemId || '' };
                });
            }
        }
        // --- Post-Process Sort ---
        else if (loadedQuestion.question_type === 'sort') {
             // Ensure question_data.items matches correct_options if correct_options is valid
             if (Array.isArray(loadedQuestion.correct_options) && loadedQuestion.correct_options.length > 0) {
                 loadedQuestion.question_data.items = [...loadedQuestion.correct_options];
             } else if (Array.isArray(loadedQuestion.question_data?.items)) {
                 // If correct_options is missing/invalid, use items as the default correct order
                 loadedQuestion.correct_options = [...loadedQuestion.question_data.items];
             }
        }


        return loadedQuestion;
      }));
      setSubmitting(false);
    })
    .catch(err => {
      console.error('Failed to load quiz for edit:', err);
      // Handle specific errors (auth, not found, etc.)
      if (err.response?.status === 401 || err.response?.status === 403) {
        if (typeof logout === 'function') logout(); // Logout if unauthorized
        navigate('/login');
      } else if (err.response?.status === 404) {
         setMessage('Quiz not found.');
         setMessageType('error');
         if (!isModalMode) navigate('/dashboard'); // Redirect if not found and not in modal
      }
      else {
        setMessage('Failed to load quiz data for editing.');
        setMessageType('error');
      }
      setSubmitting(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, token, initialQuestionState]); // Rerun effect if quizId or token changes

  // Callback for saving rich text content
  const handleSaveContent = useCallback(html => setContent(html), []);

  // --- Form Submission Handler ---
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(''); // Clear previous messages

    // --- Basic Validation ---
    if (!token) {
      setMessage('Authentication error. Please log in again.'); setSubmitting(false); return;
    }
    if (!title.trim()) {
      setMessage('Quiz title is required.'); setCurrentStep(1); setSubmitting(false); return;
    }
    if (!subjectOption || !subjectOption.value) { // Check for value specifically
      setMessage('Subject is required.'); setCurrentStep(1); setSubmitting(false); return;
    }
    if (!questions || questions.length === 0) {
        setMessage('At least one question is required.'); setCurrentStep(2); setSubmitting(false); return;
    }


    // --- Detailed Question Validation ---
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qNum = i + 1;
        if (!q.question_text?.trim()) {
            setMessage(`Text for Question ${qNum} is required.`); setCurrentStep(2); setSubmitting(false); return;
        }
        // MCQ/Multi specific validation
        if (['mcq', 'multi'].includes(q.question_type)) {
            if (!q.option1?.trim() || !q.option2?.trim()) {
                setMessage(`Option 1 and Option 2 text for Question ${qNum} (MCQ/Multi) are required.`); setCurrentStep(2); setSubmitting(false); return;
            }
            if (q.question_type === 'mcq' && (!q.correct_option || ![1,2,3,4].includes(q.correct_option) || !q[`option${q.correct_option}`]?.trim())) {
                 setMessage(`A valid correct option (1-4) with text must be selected for MCQ Question ${qNum}.`); setCurrentStep(2); setSubmitting(false); return;
            }
            if (q.question_type === 'multi' && (!Array.isArray(q.correct_options) || q.correct_options.length === 0 || q.correct_options.some(opt => !q[`option${opt}`]?.trim()))) {
                setMessage(`At least one valid correct option with text must be selected for Multi-Select Question ${qNum}.`); setCurrentStep(2); setSubmitting(false); return;
            }
        }
        // Short answer validation
        if (q.question_type === 'short' && !q.correct_answer?.trim() && !q.allow_speech_to_text) {
             setMessage(`Correct answer for short answer Question ${qNum} is required if speech input is not allowed.`); setCurrentStep(2); setSubmitting(false); return;
        }
        // Word sort validation
        if (q.question_type === 'sort') {
            const items = q.question_data?.items || [];
            if (items.length < 2 || items.some(item => !item?.trim())) {
                setMessage(`At least two non-empty words are required for word sort Question ${qNum}.`); setCurrentStep(2); setSubmitting(false); return;
            }
             // Ensure correct_options (the solution) exists and matches items length
            if (!Array.isArray(q.correct_options) || q.correct_options.length !== items.length) {
                setMessage(`Correct sort order definition is missing or incomplete for Question ${qNum}.`); setCurrentStep(2); setSubmitting(false); return;
            }
        }
        // Drag & Drop validation
        if (q.question_type === 'dragdrop') {
            if (!q.drag_sentence?.trim() || !q.drag_sentence.includes('*')) {
                setMessage(`Sentence with at least one blank (*) is required for drag & drop Question ${qNum}.`); setCurrentStep(2); setSubmitting(false); return;
            }
            const words = (q.question_data?.items || []);
            if (words.length === 0) {
                setMessage(`At least one draggable word is required for drag & drop Question ${qNum}.`); setCurrentStep(2); setSubmitting(false); return;
            }
            const blankCount = (q.drag_sentence.match(/\*/g) || []).length;
            const solutions = q.correct_options || [];
            if (solutions.length !== blankCount || solutions.some(sol => !sol?.itemId)) { // Check if itemId is present and non-empty
                 setMessage(`Each blank must have a correct word selected for drag & drop Question ${qNum}.`); setCurrentStep(2); setSubmitting(false); return;
            }
        }
    }

    // --- Build FormData ---
    const formData = new FormData();
    formData.append('title', title);
    formData.append('quiz_type', quizType);
    formData.append('content', content);
    if (subjectOption && subjectOption.value) {
      formData.append('subject', subjectOption.value);
    }
    // Append tags if present
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (tagList.length) {
      // Send as a JSON string array, backend ListField will handle it
      formData.append('tag_names', JSON.stringify(tagList));
    }

    // --- Append Questions Data ---
    questions.forEach((q, qi) => {
      const prefix = `questions[${qi}]`; // Prefix for DRF nested list handling

      // Always include temp_id for mapping on backend, especially for new dragdrop
      formData.append(`${prefix}temp_id`, q.temp_id);
      // Include DB id only if updating an existing question
      if (q.id) formData.append(`${prefix}id`, q.id);

      // Common fields
      formData.append(`${prefix}question_type`, q.question_type);
      formData.append(`${prefix}question_text`, q.question_text);
      formData.append(`${prefix}allow_speech_to_text`, q.allow_speech_to_text);
      formData.append(`${prefix}hint1`, q.hint1 || '');
      formData.append(`${prefix}hint2`, q.hint2 || '');

      // Append media files if they are File objects (new uploads)
      if (q.question_image instanceof File) formData.append(`${prefix}question_image`, q.question_image);
      if (q.question_audio instanceof File) formData.append(`${prefix}question_audio`, q.question_audio);

      // --- Type-Specific Fields ---
      if (['mcq', 'multi'].includes(q.question_type)) {
        formData.append(`${prefix}option1`, q.option1);
        formData.append(`${prefix}option2`, q.option2);
        formData.append(`${prefix}option3`, q.option3 || '');
        formData.append(`${prefix}option4`, q.option4 || '');

        // Append option media files
        if (q.option1_image instanceof File) formData.append(`${prefix}option1_image`, q.option1_image);
        if (q.option1_audio instanceof File) formData.append(`${prefix}option1_audio`, q.option1_audio);
        if (q.option2_image instanceof File) formData.append(`${prefix}option2_image`, q.option2_image);
        if (q.option2_audio instanceof File) formData.append(`${prefix}option2_audio`, q.option2_audio);
        if (q.option3_image instanceof File) formData.append(`${prefix}option3_image`, q.option3_image);
        if (q.option3_audio instanceof File) formData.append(`${prefix}option3_audio`, q.option3_audio);
        if (q.option4_image instanceof File) formData.append(`${prefix}option4_image`, q.option4_image);
        if (q.option4_audio instanceof File) formData.append(`${prefix}option4_audio`, q.option4_audio);

        // Append correct answers
        if (q.question_type === 'mcq') {
          formData.append(`${prefix}correct_option`, q.correct_option);
        } else { // multi
          // Ensure it's an array of numbers [1-4]
          const validCorrectOptions = (q.correct_options || []).map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 4);
          formData.append(`${prefix}correct_options`, JSON.stringify(validCorrectOptions));
        }
      } else if (q.question_type === 'short') {
        formData.append(`${prefix}correct_answer`, q.correct_answer);
      } else if (q.question_type === 'sort') {
        // Send sortable items (words) in question_data
        formData.append(`${prefix}question_data`, JSON.stringify({ items: q.question_data.items.filter(item => item?.trim()) }));
        // Send the correct order (which is stored in correct_options state for sort)
        const correctSortOrder = Array.isArray(q.correct_options) ? q.correct_options : [];
        formData.append(`${prefix}correct_options`, JSON.stringify(correctSortOrder));
      } else if (q.question_type === 'dragdrop') {
        // --- Construct the fill_blank JSON blob ---
        const fillBlob = {
          sentence: q.drag_sentence,
          // Send only the text of the words
          words: (q.question_data.items || []).map(item => ({ text: item.text })),
          // Send solutions: slot_index maps to the temporary frontend item ID
          solutions: (q.correct_options || []).map((sol, idx) => ({
            slot_index: idx, // 0-based index of the blank
            correct_word: sol.itemId // The temporary frontend ID (e.g., "item_168..._0")
          }))
        };
        // Append the JSON blob as a string field named 'fill_blank'
        formData.append(`${prefix}fill_blank`, JSON.stringify(fillBlob));
        // NOTE: Do NOT send correct_options or question_data separately for dragdrop
      }
    });

    // --- API Call ---
    try {
      // Use Authorization header if your apiClient doesn't handle it automatically
      const config = { headers: { /* 'Authorization': `Token ${token}` , */ 'Content-Type': 'multipart/form-data' } };

      const res = quizId
        ? await apiClient.patch(`/quizzes/${quizId}/edit/`, formData, config) // PATCH for update
        : await apiClient.post('/quizzes/', formData, config); // POST for create

      const savedQuiz = res.data.quiz || res.data; // Adjust based on API response
      setMessageType('success');
      setMessage(`Quiz '${savedQuiz.title}' ${quizId ? 'updated' : 'created'} successfully!`);

      // Call success/close callbacks if provided (for modal usage)
      if (typeof onSuccess === 'function') onSuccess(savedQuiz);
      if (typeof onClose === 'function' && isModalMode) setTimeout(onClose, 1500);

      // Navigate after success if not in modal mode
      if (!isModalMode && savedQuiz.permalink) {
        setTimeout(() => navigate(`/quizzes/${savedQuiz.permalink}`), 1500); // Navigate to quiz view
      } else if (!isModalMode && !quizId) { // Only navigate to dashboard on create if not modal
        setTimeout(() => navigate('/dashboard'), 1500); // Navigate to dashboard after create
      }

    } catch (err) {
      console.error('Error saving quiz:', err.response || err);
      // --- Detailed Error Handling ---
      let errMsg = `Failed to ${quizId ? 'update' : 'create'} quiz.`;
        if (err.response?.data) {
            const errors = err.response.data;
            const detailedMessages = [];
            // Helper function to recursively extract error strings
            const extractErrors = (errorData) => {
                if (typeof errorData === 'string') {
                    return [errorData];
                } else if (Array.isArray(errorData)) {
                    return errorData.flatMap(extractErrors);
                } else if (typeof errorData === 'object' && errorData !== null) {
                    return Object.entries(errorData).flatMap(([key, value]) => {
                        const nestedErrors = extractErrors(value);
                        // Prepend field name for context, handle nested questions specifically
                        if (key === 'questions' && Array.isArray(value)) {
                             return nestedErrors.map((msg, idx) => `Q${Math.floor(idx / nestedErrors.length * value.length) + 1}: ${msg}`); // Approximate index
                        } else if (!isNaN(key)) { // Handle array indices within questions
                             return nestedErrors.map(msg => `Q${parseInt(key)+1}: ${msg}`);
                        }
                        return nestedErrors.map(msg => `${key}: ${msg}`);
                    });
                }
                return [];
            };
            const messages = extractErrors(errors);
            if (messages.length > 0) {
                errMsg = messages.join('; ');
            } else if (errors.detail) { // Fallback for non_field_errors or general detail
                errMsg = errors.detail;
            }
        } else if (err.request) {
            errMsg = 'Network error. Please check your connection.';
        }
      setMessageType('error');
      setMessage(errMsg);
      // Handle auth errors
      if (err.response?.status === 401) { if (typeof logout === 'function') logout(); navigate('/login'); }
    } finally {
      setSubmitting(false); // Ensure loading state is turned off
    }
  };

  // Calculate progress bar percentage
  const progressPercent = (currentStep / 3) * 100;

  // --- Render Functions for Question Types ---
  const renderQuestionSpecificFields = (q, i) => {
    // Helper to render inputs for an option (MCQ/Multi)
    const renderOptionInputs = (optNum) => (
        <div key={optNum} className={styles.optionGroup}>
            <label className={styles.inputLabel} htmlFor={`q-${i}-opt${optNum}-text`}>
            Option {optNum}: {optNum <= 2 ? <span className={styles.required}>*</span> : '(Optional)'}
            </label>
            <div className={styles.fileInputGroup}> {/* Group text and media */}
                <input
                    id={`q-${i}-opt${optNum}-text`}
                    className={styles.inputField}
                    placeholder={`Text for Option ${optNum}`}
                    value={q[`option${optNum}`] || ''}
                    onChange={e => updateQuestionField(i, `option${optNum}`, e.target.value)}
                    required={optNum <= 2 && ['mcq', 'multi'].includes(q.question_type)} // Required for 1 & 2
                    disabled={submitting}
                />
                {/* Render media uploads for this option */}
                <RenderMediaUploads
                    q={q}
                    questionIndex={i}
                    baseName={`option${optNum}`}
                    onUpdate={updateQuestionField}
                    submittingStatus={submitting}
                />
            </div>
        </div>
    );

    // --- Switch based on question type ---
    switch (q.question_type) {
      case 'mcq': // Multiple Choice (Single Correct)
      case 'multi': // Multiple Select (Multiple Correct)
        return (
          <>
            {/* Render inputs for options 1-4 */}
            {[1, 2, 3, 4].map(optNum => renderOptionInputs(optNum))}
            {/* Render correct answer selection */}
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Correct Answer(s): <span className={styles.required}>*</span></label>
              {q.question_type === 'mcq' ? (
                // Dropdown for single correct answer (MCQ)
                <select
                    className={styles.selectField}
                    value={q.correct_option}
                    onChange={e => updateQuestionField(i, 'correct_option', parseInt(e.target.value))}
                    disabled={submitting} required
                >
                  {/* Only show options that have text */}
                  {[1, 2, 3, 4].map(n => q[`option${n}`]?.trim() && <option key={n} value={n}>Option {n}</option>)}
                </select>
              ) : (
                // Checkboxes for multiple correct answers (Multi)
                <div className={styles.checkboxGroup}>
                  {[1, 2, 3, 4].map(n => q[`option${n}`]?.trim() && ( // Only show options with text
                    <label key={n} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={(Array.isArray(q.correct_options) ? q.correct_options : []).includes(n)}
                        onChange={e => {
                          const currentCorrectOptions = Array.isArray(q.correct_options) ? q.correct_options : [];
                          const newCorrectOptions = e.target.checked
                            ? [...currentCorrectOptions, n] // Add option if checked
                            : currentCorrectOptions.filter(opt => opt !== n); // Remove if unchecked
                          // Update state, keeping options sorted
                          updateQuestionField(i, 'correct_options', newCorrectOptions.sort((a,b) => a-b));
                        }}
                        disabled={submitting}
                      /> Option {n}
                    </label>
                  ))}
                  {/* Validation message if no option is selected */}
                  {(!Array.isArray(q.correct_options) || q.correct_options.length === 0) && <span className={styles.errorText}>At least one option must be selected.</span>}
                </div>
              )}
            </div>
          </>
        );
      case 'short': // Short Answer
        return (
          <div className={styles.formGroup}>
            <label className={styles.inputLabel} htmlFor={`q-${i}-correctanswer`}>
                Expected Correct Answer: {!q.allow_speech_to_text && <span className={styles.required}>*</span>}
            </label>
            <input
                id={`q-${i}-correctanswer`}
                type="text"
                className={styles.inputField}
                placeholder="Enter the exact correct answer"
                value={q.correct_answer}
                onChange={e => updateQuestionField(i, 'correct_answer', e.target.value)}
                disabled={submitting}
                required={!q.allow_speech_to_text} // Required only if speech input is disabled
            />
          </div>
        );
      case 'sort': // Word Sorting
            return (
              <>
                <div className={styles.formGroup}>
                    <label className={styles.inputLabel}>
                        Words to Sort: <span className={styles.required}>*</span>
                        <span className={styles.tooltipContainer}>
                            <HelpCircle size={14} className={styles.tooltipIcon}/>
                            <span className={styles.tooltipText}>Define the words/phrases to be sorted. Arrange them in the CORRECT order here. The user will see them shuffled.</span>
                        </span>
                    </label>
                    {/* List of editable words */}
                    <div className={styles.questionDataItemList}>
                        {(q.question_data.items || []).map((itemText, itemIdx) => (
                            <EditableListItem
                                key={itemIdx} // Index is acceptable here as we manipulate the array directly
                                item={itemText}
                                index={itemIdx}
                                onUpdate={handleSortItemUpdate} // Updates item text and correct_options
                                onRemove={() => handleSortItemRemove(i, itemIdx)} // Removes item and updates correct_options
                                onMove={(idx, newIdx) => handleSortItemMove(i, idx, newIdx)} // Moves item and updates correct_options
                                canMoveUp={itemIdx > 0}
                                canMoveDown={itemIdx < (q.question_data.items || []).length - 1}
                                placeholderText="Word/Phrase"
                            />
                        ))}
                    </div>
                    {/* Add new word button */}
                    <button type="button" onClick={() => addSortItem(i)} className={`${styles.btn} ${styles.btnAddItem}`} disabled={submitting}> <Plus size={16} /> Add Word </button>
                     {/* Validation message */}
                     {(!Array.isArray(q.question_data?.items) || q.question_data.items.length < 2) && <span className={styles.errorText}>At least two words are required.</span>}
                </div>
                {/* Preview of the correct order (which is the current order of items) */}
                <div className={styles.formGroup}>
                    <label className={styles.inputLabel}>Correctly Sorted Order (Preview):</label>
                    <p className={styles.previewText}>
                        {(q.correct_options && q.correct_options.length > 0)
                            ? q.correct_options.join(' → ')
                            : '(Define at least two words above)'}
                    </p>
                </div>
              </>
            );
      case 'dragdrop': { // Fill-in-the-blanks (Drag & Drop)
            // Get current state for rendering UI elements
            const currentWords = q.question_data?.items || []; // Draggable words: {id, text}
            const currentBlanks = q.question_data?.dropZones || []; // Blank areas: {id, label}
            const currentSolution = q.correct_options || []; // Solution mapping: {zoneId, itemId}

            return (
              <>
                {/* Input for the sentence with blanks */}
                <div className={styles.formGroup}>
                  <label className={styles.inputLabel} htmlFor={`q-${i}-dragsentence`}>
                      Sentence with Blanks: <span className={styles.required}>*</span>
                      <span className={styles.tooltipContainer}>
                          <HelpCircle size={14} className={styles.tooltipIcon}/>
                          <span className={styles.tooltipText}>Use one asterisk `*` for each blank space where a word should be dragged.</span>
                      </span>
                  </label>
                 <textarea
                    id={`q-${i}-dragsentence`}
                    className={styles.textAreaField}
                    value={q.drag_sentence}
                    onChange={e => updateQuestionField(i, 'drag_sentence', e.target.value)}
                    placeholder="Example: The quick brown * jumps over the lazy *."
                    rows={3}
                    disabled={submitting}
                    required
                  />
                </div>

                {/* Input for the comma-separated draggable words */}
                <div className={styles.formGroup}>
                  <label className={styles.inputLabel} htmlFor={`q-${i}-dragwords`}>
                    Draggable Words (comma-separated): <span className={styles.required}>*</span>
                     <span className={styles.tooltipContainer}>
                        <HelpCircle size={14} className={styles.tooltipIcon}/>
                        <span className={styles.tooltipText}>Enter ALL words available for dragging (correct answers and distractors), separated by commas.</span>
                    </span>
                  </label>
                  <input
                    id={`q-${i}-dragwords`}
                    type="text"
                    className={styles.inputField}
                    value={q.drag_words}
                    onChange={e => updateQuestionField(i, 'drag_words', e.target.value)}
                    placeholder="e.g., fox, dog, cat, jumps, runs"
                    disabled={submitting}
                    required
                  />
                </div>

                {/* Section to define the correct word for each blank */}
                {currentBlanks.length > 0 && currentWords.length > 0 && (
                    <div className={styles.defineSolutionSection}>
                        <h5 className={styles.subHeading}>Define Correct Answers for Blanks: <span className={styles.required}>*</span></h5>
                        {currentBlanks.map((blank, blankIdx) => (
                            <div key={blank.id || blankIdx} className={styles.formGroupInline}>
                                {/* Label for the blank */}
                                <label htmlFor={`q-${i}-blank-${blankIdx}-solution`} className={styles.inputLabelMinor}>
                                    {blank.label || `Blank ${blankIdx + 1}`}:
                                </label>
                                {/* Dropdown to select the correct word for this blank */}
                                <select
                                    id={`q-${i}-blank-${blankIdx}-solution`}
                                    className={styles.selectFieldSmall}
                                    // Value is the temporary frontend ID of the selected word item
                                    value={currentSolution[blankIdx]?.itemId || ''}
                                    onChange={e => updateDragDropSolution(i, blankIdx, e.target.value)}
                                    disabled={submitting}
                                    required // Each blank needs a solution
                                >
                                    <option value="">-- Select Correct Word --</option>
                                    {/* Options are the available draggable words */}
                                    {currentWords.map(word => (
                                        <option key={word.id} value={word.id}>{word.text}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                        {/* Validation message if not all blanks have solutions */}
                        {currentSolution.length !== currentBlanks.length || currentSolution.some(sol => !sol?.itemId) && <span className={styles.errorText}>Please select a correct word for every blank.</span>}
                    </div>
                )}
                 {/* Helper messages if configuration is incomplete */}
                 {currentBlanks.length === 0 && q.drag_sentence?.includes('*') && (
                    <p className={styles.infoTextSmall}>Enter draggable words above to enable solution definition.</p>
                )}
                 {currentWords.length === 0 && q.drag_words && (
                    <p className={styles.infoTextSmall}>Define blanks (*) in the sentence above to enable solution definition.</p>
                )}

              </>
            );
          }
      default: // Fallback for unknown type
        return <p>Unsupported question type selected.</p>;
    }
  };

  // --- Main JSX Render ---
  return (
    // Conditionally apply page wrapper styles if not in modal mode
    <div className={!isModalMode ? styles.pageWrapper : ''}>
      <div className={styles.createQuizContainer}>
        {/* Title and Progress Bar */}
        <h3 className={styles.modalFormTitle}>{quizId ? 'Edit Quiz' : 'Create New Quiz'}</h3>
        <div className={styles.progressContainer}><div className={styles.progressBar} style={{ width: `${progressPercent}%` }} /></div>

        {/* Feedback Message Area */}
        {message && (
          <div className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}
               role={messageType === 'error' ? 'alert' : 'status'}>
            {message}
          </div>
        )}

        {/* Form Element */}
        <form onSubmit={handleSubmit} className={styles.quizForm} noValidate>
          {/* --- Step 1: Quiz Details --- */}
          {currentStep === 1 && (
            <div className={`${styles.step} ${styles.step1}`}>
              {/* Info text when editing */}
              {quizId && <p className={styles.infoText}>Quiz title cannot be changed after creation. Subject can be changed.</p>}
              {/* Title Input */}
              <div className={styles.formGroup}>
                <label htmlFor="quizTitle" className={styles.inputLabel}>Title: <span className={styles.required}>*</span></label>
                <input id="quizTitle" type="text" value={title} onChange={e => setTitle(e.target.value)} required disabled={submitting || Boolean(quizId && title)} className={styles.inputField} placeholder="Enter a clear and concise quiz title" />
              </div>
              {/* Quiz Type Select */}
              <div className={styles.formGroup}>
                <label htmlFor="quizType" className={styles.inputLabel}>Quiz Type:</label>
                <select id="quizType" value={quizType} onChange={e => setQuizType(e.target.value)} disabled={submitting} className={styles.selectField}>
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              {/* Subject Select/Create */}
              <div className={styles.formGroup}>
                <label htmlFor="quizSubject" className={styles.inputLabel}>Subject: <span className={styles.required}>*</span></label>
                <CreateSubjectSelect onChange={setSubjectOption} value={subjectOption} isDisabled={submitting} aria-labelledby="quizSubject" />
              </div>
            </div>
          )}

          {/* --- Step 2: Questions --- */}
          {currentStep === 2 && (
            <div className={`${styles.step} ${styles.step2}`}>
              {/* Map through questions array */}
              {questions.map((q, i) => (
                <div key={q.temp_id || q.id || i} className={styles.questionBlock}>
                  {/* Question Header */}
                  <div className={styles.questionHeader}>
                    <h4 className={styles.questionTitle}>Question {i + 1}</h4>
                    <button type="button" onClick={() => removeQuestion(i)} className={styles.removeQuestionButton} disabled={submitting || questions.length <= 1} title="Remove Question"> <Trash2 size={18} /> </button>
                  </div>
                  {/* Question Type Select */}
                  <div className={styles.formGroup}>
                    <label className={styles.inputLabel} htmlFor={`q-type-${i}`}>Question Type:</label>
                    <select id={`q-type-${i}`} className={styles.selectField} value={q.question_type} onChange={e => updateQuestionField(i, 'question_type', e.target.value)} disabled={submitting}>
                      <option value="mcq">Multiple Choice (Single Correct)</option>
                      <option value="multi">Multiple Select (Multiple Correct)</option>
                      <option value="short">Short Answer</option>
                      {/*<option value="sort">Word Sort</option>} Will Add this latter*/}
                      <option value="dragdrop">Fill in the Blanks (Drag & Drop)</option>
                      {/* <option value="speech_input">Speech Input</option> */}
                    </select>
                  </div>
                  {/* Question Text Input */}
                  <div className={styles.formGroup}>
                    <label className={styles.inputLabel} htmlFor={`q-text-${i}`}>Question Text/Instructions: <span className={styles.required}>*</span></label>
                    <textarea id={`q-text-${i}`} className={styles.textAreaField} placeholder="Enter the main question text or instructions..." value={q.question_text} onChange={e => updateQuestionField(i, 'question_text', e.target.value)} required disabled={submitting} rows={3} />
                  </div>

                  {/* Question Media Uploads */}
                  <RenderMediaUploads
                    q={q}
                    questionIndex={i}
                    baseName="question"
                    onUpdate={updateQuestionField}
                    submittingStatus={submitting}
                  />

                  {/* Allow Speech Input Checkbox */}
                  <div className={styles.formGroup}>
                      <label className={styles.checkboxLabel}>
                          <input type="checkbox" checked={q.allow_speech_to_text} onChange={e => updateQuestionField(i, 'allow_speech_to_text', e.target.checked)} disabled={submitting || q.question_type === 'dragdrop' || q.question_type === 'sort'} />
                          Allow Speech Input for this question (not applicable for Sort/Drag&Drop)
                      </label>
                  </div>

                  {/* Render fields specific to the selected question type */}
                  {renderQuestionSpecificFields(q, i)}

                  {/* Hint Inputs */}
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
              {/* Add Question Button */}
              <button type="button" onClick={addNewQuestion} className={`${styles.btn} ${styles.btnAddQuestion}`} disabled={submitting}> <Plus size={16} /> Add Another Question </button>
            </div>
          )}

          {/* --- Step 3: Content & Tags --- */}
          {currentStep === 3 && (
            <div className={`${styles.step} ${styles.step3}`}>
              {/* Rich Text Editor for Quiz Content */}
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Explanation / Main Quiz Content (Optional):</label>
                <div className={styles.editorContainer}>
                  <CustomEditor initialContent={content} onSave={handleSaveContent} isDisabled={submitting} />
                </div>
              </div>
              {/* Tags Input */}
              <div className={styles.formGroup}>
                <label htmlFor="quizTags" className={styles.inputLabel}>Tags (Optional, comma-separated):</label>
                <input id="quizTags" className={styles.inputField} placeholder="e.g. javascript, react, web development" value={tags} onChange={e => setTags(e.target.value)} disabled={submitting} />
              </div>
            </div>
          )}

          {/* --- Navigation Buttons --- */}
          <div className={styles.navigationButtons}>
            {/* Back Button */}
            {currentStep > 1 && <button type="button" onClick={handleBack} className={`${styles.btn} ${styles.btnBack}`} disabled={submitting}>Back</button>}
            <div style={{ flexGrow: 1 }}></div> {/* Spacer */}
            {/* Next Button */}
            {currentStep < 3 && <button type="button" onClick={handleNext} className={`${styles.btn} ${styles.btnNext}`} disabled={submitting}>Next</button>}
            {/* Submit/Save Button */}
            {currentStep === 3 && <button type="submit" className={`${styles.btn} ${styles.btnSubmit}`} disabled={submitting}>{submitting ? (quizId ? 'Saving Changes...' : 'Creating Quiz...') : (quizId ? 'Save Changes' : 'Create Quiz')}</button>}
            {/* Cancel Button (only in modal mode) */}
            {isModalMode && <button type="button" onClick={onClose} className={`${styles.btn} ${styles.btnSecondary}`} disabled={submitting}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQuiz;
