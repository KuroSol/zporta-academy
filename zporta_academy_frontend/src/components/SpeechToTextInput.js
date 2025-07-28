import React, { useState, useEffect, useCallback, useRef } from 'react';

const SpeechToTextInput = ({ onTranscriptReady }) => {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');

  // Use a ref to hold the recognition object instance
  // This prevents it from being re-created on every render
  const recognitionRef = useRef(null);

  // Detect if the app is running in standalone (PWA) mode on iOS/other platforms
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  const memoizedOnTranscriptReady = useCallback(onTranscriptReady, [onTranscriptReady]);

  useEffect(() => {
    // If in PWA mode, we can't use the Web Speech API, so we just show an error and stop.
    if (isPWA) {
      setError("Speech-to-text is not available in the app mode. Please use your regular web browser for this feature.");
      return;
    }

    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please try Chrome on desktop or Android.");
      return;
    }

    // Initialize the recognition object only once
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      
      recognition.lang = 'en-US';
      // Set to true for live, continuous transcription
      recognition.continuous = true; 
      // Set to true to get results as the user is speaking
      recognition.interimResults = true; 

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        
        setInterimTranscript(interim);
        if (final) {
          // Append the new final transcript to the existing one
          setFinalTranscript(prevTranscript => prevTranscript + final);
          if (memoizedOnTranscriptReady) {
            memoizedOnTranscriptReady(finalTranscript + final);
          }
        }
      };

      recognition.onerror = (event) => {
        let errorMessage = `An error occurred: ${event.error}`;
        if (event.error === 'not-allowed') {
          errorMessage = "Permission to use the microphone was denied. Please enable it in your browser settings.";
        } else if (event.error === 'no-speech') {
          errorMessage = "No speech was detected. Please try again.";
        }
        setError(errorMessage);
      };
      
      recognition.onend = () => {
        // When recognition ends, update the listening state
        setIsListening(false);
        // Clear the interim transcript
        setInterimTranscript('');
      };
    }

    // Start or stop listening based on the state
    const recognition = recognitionRef.current;
    if (isListening) {
      // Clear previous transcripts and errors before starting
      setFinalTranscript('');
      setInterimTranscript('');
      setError('');
      try {
        recognition.start();
      } catch (e) {
        console.error("Error starting speech recognition:", e);
        setError("Could not start speech recognition.");
      }
    } else {
      try {
        recognition.stop();
      } catch (e) {
        console.error("Error stopping speech recognition:", e);
      }
    }

    // Cleanup function to ensure recognition is stopped when the component unmounts
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening, isPWA, memoizedOnTranscriptReady, finalTranscript]);

  // If it's a PWA, we only show the error message.
  if (isPWA) {
    return (
      <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#fffbe6' }}>
        <div style={{ color: '#f59e0b', padding: '0.5rem', borderRadius: '4px' }}>
          <strong>Feature Not Available</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <button 
          onClick={() => setIsListening(true)} 
          disabled={isListening}
          style={{ padding: '0.5rem 1rem', marginRight: '0.5rem', cursor: 'pointer', backgroundColor: isListening ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', transition: 'background-color 0.3s' }}
        >
          🎙️ Start Speaking
        </button>
        <button 
          onClick={() => setIsListening(false)} 
          disabled={!isListening}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: !isListening ? '#ccc' : '#dc3545', color: 'white', border: 'none', borderRadius: '4px', transition: 'background-color 0.3s' }}
        >
          ✋ Stop
        </button>
      </div>
      
      {error && (
        <div style={{ marginTop: '0.5rem', color: 'red', backgroundColor: '#ffebee', padding: '0.5rem', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: 'white', minHeight: '100px' }}>
        <p>
          {finalTranscript}
          <span style={{ color: '#999' }}>{interimTranscript}</span>
        </p>
      </div>
    </div>
  );
};

export default SpeechToTextInput;
