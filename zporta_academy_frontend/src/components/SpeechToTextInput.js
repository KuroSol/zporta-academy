import React, { useState, useEffect, useCallback } from 'react';

const SpeechToTextInput = ({ onTranscriptReady }) => {
  // 1) Detect “installed” iOS PWA (hooks-free logic)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isiOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isPWAonIOS = isStandalone && isiOS;

  // 2) Hooks: always declared in the same order
  const [listening, setListening]   = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError]           = useState('');
  const memoizedOnTranscriptReady   = useCallback(onTranscriptReady, [onTranscriptReady]);

  useEffect(() => {
    // Web Speech API feature detect
    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechAPI) {
      setError("Your browser doesn't support speech recognition. Please try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechAPI();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = event => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      memoizedOnTranscriptReady?.(text);
    };

    recognition.onerror = event => {
      let msg = `Error: ${event.error}`;
      if (event.error === 'no-speech') msg = 'No speech detected. Please try again.';
      else if (event.error === 'audio-capture') msg = 'Microphone not found or permission denied.';
      else if (event.error === 'not-allowed') msg = 'Permission to use microphone was denied.';
      else if (event.error === 'network') msg = 'Network error. Check your connection.';
      setError(msg);
      setListening(false);
    };

    if (listening) {
      try {
        recognition.start();
        setError('');
      } catch {
        setError('Could not start speech recognition.');
        setListening(false);
      }
    } else {
      recognition.stop();
    }

    return () => recognition.stop();
  }, [listening, memoizedOnTranscriptReady]);

  // 3) If in iOS PWA, show banner and exit "window.location.href"""
  if (isPWAonIOS) {
    const currentUrl = "https://zportaacademy.com/learn";
    return (
      <div
        style={{
          padding: '1rem',
          border: '1px solid orange',
          borderRadius: 8,
          background: '#fff8e1',
          color: '#663c00',
          textAlign: 'center'
        }}
      >
        ⚠️ Microphone access isn’t supported in iOS PWAs.<br/>
        Please open this quiz in Safari to use voice dictation:
        <br/><br/>
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            background: '#007bff',
            color: 'white',
            borderRadius: 4,
            textDecoration: 'none'
          }}
        >
          Open in Safari
        </a>
      </div>
    );
  }

  // 4) Normal Web Speech UI
  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1rem',
        border: '1px solid #eee',
        borderRadius: 8,
        background: '#f9f9f9'
      }}
    >
      <div style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
        <button
          onClick={() => setListening(true)}
          disabled={listening}
          style={{
            padding: '0.5rem 1rem',
            marginRight: '0.5rem',
            backgroundColor: listening ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: listening ? 'not-allowed' : 'pointer'
          }}
        >
          🎙️ Start Speaking
        </button>
        <button
          onClick={() => setListening(false)}
          disabled={!listening}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: !listening ? '#ccc' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: listening ? 'pointer' : 'not-allowed'
          }}
        >
          ✋ Stop
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            backgroundColor: '#ffebee',
            color: 'red',
            borderRadius: 4,
            textAlign: 'center'
          }}
        >
          {error}
        </div>
      )}

      {transcript && !error && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: 4
          }}
        >
          <strong>Transcript:&nbsp;</strong>
          <span style={{ fontStyle: 'italic' }}>{transcript}</span>
        </div>
      )}
    </div>
  );
};

export default SpeechToTextInput;
// src/components/SpeechToTextInput.js
