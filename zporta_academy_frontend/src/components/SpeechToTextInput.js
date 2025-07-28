import React, { useState, useEffect, useCallback, useRef } from 'react';

const SpeechToTextInput = ({ onTranscriptReady }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // uploading/transcribing state

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Detect PWA standalone mode
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  // Memoize callback
  const memoizedOnTranscriptReady = useCallback(onTranscriptReady, [onTranscriptReady]);

  useEffect(() => {
    if (!listening) return;

    if (!isPWA) {
      // ── Browser: Web Speech API ───────────────────────────
      if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        setError("Your browser doesn't support speech recognition. Try Chrome or Edge.");
        setListening(false);
        return;
      }

      const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechAPI();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const resultText = event.results[0][0].transcript;
        setTranscript(resultText);
        memoizedOnTranscriptReady?.(resultText);
      };

      recognition.onerror = (event) => {
        let msg = 'An unknown error occurred.';
        switch (event.error) {
          case 'no-speech': msg = 'No speech detected. Please try again.'; break;
          case 'audio-capture': msg = 'Audio capture failed. Check mic & permissions.'; break;
          case 'not-allowed': msg = 'Microphone access denied.'; break;
          case 'network': msg = 'Network error. Check your connection.'; break;
          default: msg = `Error: ${event.error}`;
        }
        setError(msg);
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      try {
        recognition.start();
        setError('');
      } catch (e) {
        console.error('Start recognition failed:', e);
        setError('Could not start speech recognition.');
        setListening(false);
      }

      return () => {
        recognition.stop();
      };
    } else {
      // ── PWA: MediaRecorder + server ──────────────────────
      const startRec = async () => {
        setError('');
        setTranscript('');
        setLoading(true);
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
          setError('Audio recording not supported.');
          setListening(false);
          setLoading(false);
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mr = new MediaRecorder(stream);
          mediaRecorderRef.current = mr;
          audioChunksRef.current = [];

          mr.ondataavailable = e => audioChunksRef.current.push(e.data);
          mr.onstop = async () => {
            try {
              const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const form = new FormData();
              form.append('file', blob, 'recording.webm');
              const res = await fetch('/api/speech-to-text/', { method: 'POST', body: form });
              if (!res.ok) throw new Error(`Server responded ${res.status}`);
              const { text } = await res.json();
              setTranscript(text);
              memoizedOnTranscriptReady?.(text);
            } catch (err) {
              console.error('Transcription error:', err);
              setError(err.message || 'Server error');
            } finally {
              setLoading(false);
              setListening(false);
            }
          };
          mr.start();
        } catch (err) {
          console.error('MediaRecorder error:', err);
          setError('Could not access microphone.');
          setListening(false);
          setLoading(false);
        }
      };
      startRec();

      return;
    }
  }, [listening, isPWA, memoizedOnTranscriptReady]);

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      setListening(false);
    }
  };

  const handleStart = () => {
    setTranscript('');
    setError('');
    setListening(true);
  };

  const handleStop = () => {
    stopRecording();
  };

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <button
          onClick={handleStart}
          disabled={listening || loading}
          style={{ padding: '0.5rem 1rem', marginRight: '0.5rem', cursor: listening || loading ? 'not-allowed' : 'pointer', backgroundColor: listening || loading ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {isPWA ? '🔴 Start Recording' : '🎙️ Start Speaking'}
        </button>
        <button
          onClick={handleStop}
          disabled={!listening}
          style={{ padding: '0.5rem 1rem', cursor: !listening ? 'not-allowed' : 'pointer', backgroundColor: !listening ? '#ccc' : '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {isPWA ? '⏹️ Stop & Transcribe' : '✋ Stop'}
        </button>
      </div>

      {loading && (
        <div style={{ marginTop: '0.5rem', color: '#555' }}>Transcribing audio…</div>
      )}

      {error && (
        <div style={{ marginTop: '0.5rem', color: 'red', backgroundColor: '#ffebee', padding: '0.5rem', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <textarea
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        placeholder="Transcript appears here..."
        style={{ width: '100%', minHeight: '80px', marginTop: '0.5rem', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
      />
    </div>
  );
};

export default SpeechToTextInput;
