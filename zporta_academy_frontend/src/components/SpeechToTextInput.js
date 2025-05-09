import React, { useState, useEffect, useCallback } from 'react';

const SpeechToTextInput = ({ onTranscriptReady }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(''); // Added for non-alert error handling

  // Memoize onTranscriptReady if it's a function prop that might change.
  // This is good practice, though the primary fix is adding it to the useEffect deps.
  // If the parent component already uses useCallback for onTranscriptReady, this isn't strictly necessary here
  // but doesn't hurt.
  const memoizedOnTranscriptReady = useCallback(onTranscriptReady, [onTranscriptReady]);

  useEffect(() => {
    // Check if the browser supports the Web Speech API
    if (!('webkitSpeechRecognition' in window)) {
      setError("Your browser doesn't support speech recognition. Please try Chrome or Edge.");
      // console.warn("Your browser doesn't support speech recognition."); // Log a warning instead of alert
      return;
    }

    // Create a new speech recognition instance
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US'; // Set language
    recognition.continuous = false; // Stop listening after the first pause
    recognition.interimResults = false; // Get final results only

    // Event handler for when speech is recognized
    recognition.onresult = (event) => {
      const resultText = event.results[0][0].transcript;
      setTranscript(resultText);
      // Call the callback function passed as a prop with the transcript
      // Use the memoized version if you prefer, or onTranscriptReady directly
      if (memoizedOnTranscriptReady) {
        memoizedOnTranscriptReady(resultText);
      }
    };

    // Event handler for speech recognition errors
    recognition.onerror = (event) => {
      let errorMessage = "An unknown error occurred during speech recognition.";
      if (event.error) {
        switch (event.error) {
          case 'no-speech':
            errorMessage = "No speech was detected. Please try again.";
            break;
          case 'audio-capture':
            errorMessage = "Audio capture failed. Please ensure your microphone is working and permissions are granted.";
            break;
          case 'not-allowed':
            errorMessage = "Speech recognition permission denied. Please enable microphone access in your browser settings.";
            break;
          case 'network':
            errorMessage = "A network error occurred. Please check your internet connection.";
            break;
          default:
            errorMessage = `Error: ${event.error}`;
        }
      }
      setError(errorMessage);
      // console.error("Speech recognition error:", event.error); // Log the error
    };

    // Start or stop listening based on the 'listening' state
    if (listening) {
      try {
        recognition.start();
        setError(''); // Clear any previous errors when starting
      } catch (e) {
        // This can happen if recognition is already started
        console.error("Error starting speech recognition:", e);
        setError("Could not start speech recognition.");
      }
    } else {
      recognition.stop();
    }

    // Cleanup function: stop recognition when the component unmounts or dependencies change
    return () => {
      recognition.stop();
    };
  }, [listening, memoizedOnTranscriptReady]); // Added memoizedOnTranscriptReady (which depends on onTranscriptReady) to the dependency array

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <button 
          onClick={() => setListening(true)} 
          disabled={listening}
          style={{ padding: '0.5rem 1rem', marginRight: '0.5rem', cursor: 'pointer', backgroundColor: listening ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          🎙️ Start Speaking
        </button>
        <button 
          onClick={() => setListening(false)} 
          disabled={!listening}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: !listening ? '#ccc' : '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          ✋ Stop
        </button>
      </div>
      {error && (
        <div style={{ marginTop: '0.5rem', color: 'red', backgroundColor: '#ffebee', padding: '0.5rem', borderRadius: '4px' }}>
          {error}
        </div>
      )}
      {transcript && !error && ( // Only show transcript if there's no error overriding it
         <div style={{ marginTop: '0.5rem', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: 'white' }}>
            <strong>Transcript:</strong> <span style={{ fontStyle: 'italic' }}>{transcript}</span>
         </div>
      )}
    </div>
  );
};

export default SpeechToTextInput;
