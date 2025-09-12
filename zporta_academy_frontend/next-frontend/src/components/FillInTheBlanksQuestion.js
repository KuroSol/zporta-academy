// src/components/Quiz/FillInTheBlanksQuestion.js
import React, { useState, useEffect } from 'react';
import styles from '@/styles/QuizPage.module.css';
const FillInTheBlanksQuestion = ({ question, disabled, onSubmit, submittedAnswer, feedback }) => {
    // Destructure _fill_blank from question, providing defaults if _fill_blank or its properties are missing
    const { 
        sentence = '', 
        words: wordsFromAPI = [],  // These are the words from the DB {id (backend), text}
        solutions: backendSolutions = [] // These are solution mappings {slot_index, correct_word (backend_id)}
    } = question?._fill_blank || {};

    // Use a stable question identifier for generating unique frontend IDs
    const questionId = question?.id || question?.temp_id || 'unknown_question';

    // State for words currently placed in blanks: { "frontend_zone_id_0": "frontend_word_id_a", ... }
    const [placedWords, setPlacedWords] = useState({});
    // State for words available in the bank, augmented with frontend IDs: 
    // [{ id: "frontend_word_id", text: "Word", backendId: "db_id" }]
    const [bankWords, setBankWords] = useState([]);

    // This effect runs when the question, its ID, words from API, or submittedAnswer changes.
    // It initializes the word bank (bankWords) and the words placed in blanks (placedWords).
    useEffect(() => {
        let initialDraggableWords = [];
        if (wordsFromAPI && Array.isArray(wordsFromAPI)) {
            initialDraggableWords = wordsFromAPI.map((word, index) => ({
                id: `item_${questionId}_${index}`, // Unique frontend ID for this draggable word item
                text: word.text,
                backendId: word.id // Store the original backend DB ID of the BlankWord
            }));
            setBankWords(initialDraggableWords);
        } else {
            setBankWords([]); // Ensure bankWords is an empty array if no words from API
        }

        // If a previously submitted answer is provided (e.g., when reviewing), populate placedWords.
        // This assumes submittedAnswer is in the format { "frontend_zone_id_N": "frontend_word_id_M" }
        if (submittedAnswer && typeof submittedAnswer === 'object' && Object.keys(submittedAnswer).length > 0) {
            setPlacedWords(submittedAnswer);
        } else {
             // If no submitted answer, or if the question changes, reset placedWords.
            // This is important if the user navigates between questions.
            setPlacedWords({});
        }
    }, [questionId, wordsFromAPI, submittedAnswer]); // Rerun if these dependencies change

    // Handler for when a word drag starts (from bank or a blank)
    const handleDragStart = (e, wordFrontendId) => {
        if (disabled) return; // Do nothing if interaction is disabled (e.g., after submission)
        e.dataTransfer.setData('text/plain', wordFrontendId);
        e.dataTransfer.effectAllowed = "move";
    };

    // Handler for when a word is dropped onto a blank
    const handleDropOnBlank = (e, blankIndex) => {
        if (disabled) return;
        e.preventDefault();
        const droppedWordFrontendId = e.dataTransfer.getData('text/plain');
        const blankZoneFrontendId = `zone_${questionId}_${blankIndex}`; // Generate frontend ID for the blank

        const newPlacedWords = { ...placedWords };

        // If this word was already in another blank, remove it from that blank first
        Object.keys(newPlacedWords).forEach(zoneKey => {
            if (newPlacedWords[zoneKey] === droppedWordFrontendId) {
                delete newPlacedWords[zoneKey];
            }
        });

        // Place the word in the target blank
        newPlacedWords[blankZoneFrontendId] = droppedWordFrontendId;
        setPlacedWords(newPlacedWords);
    };

    // Handler for when a word is dropped back onto the word bank area
    const handleDropOnBank = (e) => {
        if (disabled) return;
        e.preventDefault();
        const droppedWordFrontendId = e.dataTransfer.getData('text/plain');
        
        // If the word was dragged from a blank, remove it from the placedWords state
        const newPlacedWords = { ...placedWords };
        let wordRemovedFromBlank = false;
        Object.keys(newPlacedWords).forEach(zoneKey => {
            if (newPlacedWords[zoneKey] === droppedWordFrontendId) {
                delete newPlacedWords[zoneKey];
                wordRemovedFromBlank = true;
            }
        });
        if (wordRemovedFromBlank) {
            setPlacedWords(newPlacedWords);
        }
        // If dragged from bank to bank, no state change needed for placedWords
    };

    // Handler for drag over an element (necessary to allow dropping)
    const handleDragOver = (e) => {
        if (disabled) return;
        e.preventDefault();
    };
    
    // Handler for the submit button click
    const handleSubmitClick = () => {
        if (typeof onSubmit === 'function') {
            onSubmit(placedWords); // Pass the current state of placed words
        }
    };

    // Renders the sentence with blanks as interactive drop zones
    const renderSentenceWithBlanks = () => {
        // If the sentence string is missing, show a configuration error.
        if (!sentence) {
            return <p className={styles.errorText}>Configuration Error: The sentence for blanks is missing. Please edit the quiz.</p>;
        }

        const sentenceParts = sentence.split('*'); // Split the sentence by the '*' placeholder
        return sentenceParts.map((part, index) => {
            const blankFrontendId = `zone_${questionId}_${index}`; // Unique ID for this blank's drop zone
            const placedWordFrontendId = placedWords[blankFrontendId]; // Get the frontend ID of the word placed here
            const placedWordObject = bankWords.find(w => w.id === placedWordFrontendId); // Find the full word object

            let blankClassName = styles.fillBlankDropZone; // Default class for a blank
            let textToShowInBlank = 'Drop here';

            if (placedWordObject) {
                textToShowInBlank = placedWordObject.text;
                blankClassName = `${styles.fillBlankDropZone} ${styles.filledBlank}`; // Style for a filled blank
            }

            // Apply feedback styling after submission (when 'disabled' is true and 'feedback' is available)
            if (disabled && feedback && feedback.correctValue && feedback.correctValue.solutions) {
                // Find the correct solution from the backend for this specific blank (slot_index)
                const solutionForThisSlot = feedback.correctValue.solutions.find(sol => sol.slot_index === index);

                if (solutionForThisSlot) {
                    const correctWordBackendDBId = solutionForThisSlot.correct_word; // DB ID of the correct BlankWord

                    if (placedWordObject && placedWordObject.backendId === correctWordBackendDBId) {
                        // User placed a word, AND its backendId matches the correct backendId for this slot
                        blankClassName = `${styles.fillBlankDropZone} ${styles.correctBlank}`;
                    } else if (placedWordObject) {
                        // User placed a word, but its backendId does NOT match the correct one
                        blankClassName = `${styles.fillBlankDropZone} ${styles.incorrectBlank}`;
                    } else {
                        // User did NOT place any word in this blank, but there IS a correct solution for it
                        blankClassName = `${styles.fillBlankDropZone} ${styles.incorrectBlank}`; // Mark as incorrect if not filled
                        const correctWordForDisplay = feedback.correctValue.words.find(w => w.id === correctWordBackendDBId);
                        textToShowInBlank = `Correct: ${correctWordForDisplay?.text || '??'}`; // Show the correct word
                    }
                } else if (placedWordObject) {
                    // User placed a word, but there's no defined solution for this slot (data inconsistency)
                    blankClassName = `${styles.fillBlankDropZone} ${styles.incorrectBlank}`;
                }
                // If !solutionForThisSlot && !placedWordObject, it's an empty blank with no solution defined - default style.
            }

            return (
                <React.Fragment key={`part-${index}`}>
                    {/* Render the part of the sentence before the blank */}
                    <span dangerouslySetInnerHTML={{ __html: part }} />
                    {/* Render the drop zone if this is not the last part of the sentence */}
                    {index < sentenceParts.length - 1 && (
                        <span
                            id={blankFrontendId}
                            className={blankClassName}
                            onDrop={(e) => handleDropOnBlank(e, index)}
                            onDragOver={handleDragOver}
                            // Allow dragging from a filled blank only if not disabled (to move words)
                            draggable={!!placedWordObject && !disabled}
                            onDragStart={(e) => placedWordObject && handleDragStart(e, placedWordObject.id)}
                        >
                            {textToShowInBlank}
                        </span>
                    )}
                </React.Fragment>
            );
        });
    };

    // Filter words for the bank: show only those not currently placed in any blank
    const wordsCurrentlyInBank = bankWords.filter(
        bankWordObj => !Object.values(placedWords).includes(bankWordObj.id)
    );

    // --- Initial Checks for Valid Configuration ---
    if (!question || !question._fill_blank) {
        return <p className={styles.errorText}>Fill-in-the-blanks question data is not fully loaded or missing.</p>;
    }
    if (!sentence && wordsFromAPI.length === 0) {
         return <p className={styles.errorText}>Configuration Error: Both sentence and word bank are missing. Please edit the quiz.</p>;
    }
    // If sentence is okay, but no words in the bank, it's still a configuration issue.
    if (wordsFromAPI.length === 0 && sentence) { // Check sentence truthiness here
        return (
            <div className={styles.fillInTheBlanksContainer}>
                <div className={styles.sentenceContainer}>
                    {renderSentenceWithBlanks()} {/* This will show the sentence error if sentence is also empty */}
                </div>
                <p className={styles.errorText}>Configuration Error: No words provided for the word bank. Please edit the quiz.</p>
            </div>
        );
    }

    // --- Main Render ---
    return (
        <div className={styles.fillInTheBlanksContainer}>
            <div className={styles.sentenceContainer}>
                {renderSentenceWithBlanks()}
            </div>

            <div
                className={styles.wordBank}
                onDrop={handleDropOnBank} // Allow dropping words back into the bank
                onDragOver={handleDragOver}
            >
                <h4 className={styles.wordBankTitle}>Word Bank</h4>
                {wordsCurrentlyInBank.length > 0 ? (
                    <div className={styles.wordBankItems}>
                        {wordsCurrentlyInBank.map(wordObj => (
                            <div
                                key={wordObj.id} // Use the unique frontend ID
                                draggable={!disabled}
                                onDragStart={(e) => handleDragStart(e, wordObj.id)}
                                className={styles.draggableWord}
                                title={disabled ? "Answers submitted" : "Drag this word"}
                            >
                                {wordObj.text}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className={styles.placeholderText}>
                        {bankWords.length > 0 ? "All words placed!" : "No words available in bank."}
                    </p>
                )}
            </div>

            {!disabled && (
                <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSubmitAnswer} ${styles.submitFillBlank}`}
                    onClick={handleSubmitClick}
                    // You might want to disable submission if not all blanks are filled,
                    // depending on your quiz rules.
                    // disabled={Object.keys(placedWords).length !== (sentence.split('*').length - 1)}
                >
                    Submit Answer
                </button>
            )}

            {/* Display the full correct solution sentence after an incorrect attempt */}
            {disabled && feedback && !feedback.isCorrect && feedback.correctValue?._fill_blank?.sentence && (
                <div className={styles.correctSolutionSentence}>
                    <strong>Correct Solution:</strong>
                    <p>
                        {feedback.correctValue._fill_blank.sentence.split('*').map((part, index, arr) => {
                            // Find the solution for the current slot_index
                            const solutionForThisSlot = feedback.correctValue._fill_blank.solutions.find(s => s.slot_index === index);
                            // Find the text of the correct word using its backend ID
                            const correctWordObject = solutionForThisSlot 
                                ? feedback.correctValue._fill_blank.words.find(w => w.id === solutionForThisSlot.correct_word) 
                                : null;
                            return (
                                <React.Fragment key={`sol-part-${index}`}>
                                    <span dangerouslySetInnerHTML={{ __html: part }} />
                                    {index < arr.length - 1 && (
                                        <span className={styles.correctBlankSolution}>
                                            {correctWordObject ? correctWordObject.text : '___'}
                                        </span>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </p>
                </div>
            )}
        </div>
    );
};

export default FillInTheBlanksQuestion;
