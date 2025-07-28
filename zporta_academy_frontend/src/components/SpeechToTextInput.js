import React, { useState, useEffect, useCallback, useRef } from 'react';

const SpeechToTextInput = ({ onTranscriptReady }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // uploading/transcribing state
  const [logs, setLogs] = useState([]); // debug logs

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Detect PWA standalone mode
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  // Memoize callback
  const memoizedOnTranscriptReady = useCallback(onTranscriptReady, [onTranscriptReady]);

  const addLog = msg => setLogs(prev => [...prev, msg]);

  useEffect(() => {
    if (!listening) return;

    addLog(`Listening started (isPWA=${isPWA})`);

    if (!isPWA) {
      // Browser: Web Speech API
      if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        const msg = "Your browser doesn't support speech recognition.";
        setError(msg);
        addLog(msg);
        setListening(false);
        return;
      }

      const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechAPI();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = event => {
        const resultText = event.results[0][0].transcript;
        setTranscript(resultText);
        addLog(`Recognized: ${resultText}`);
        memoizedOnTranscriptReady?.(resultText);
      };

      recognition.onerror = event => {
        let msg = `Error: ${event.error}`;
        setError(msg);
        addLog(msg);
        setListening(false);
      };

      recognition.onend = () => {
        addLog('Recognition ended');
        setListening(false);
      };

      try {
        recognition.start();
        setError('');
        addLog('Recognition.start() called');
      } catch (e) {
        const msg = `Start recognition failed: ${e.message}`;
        console.error(msg, e);
        setError(msg);
        addLog(msg);
        setListening(false);
      }

      return () => recognition.stop();
    } else {
      // PWA: MediaRecorder + server
      const startRec = async () => {
        setError('');
        setTranscript('');
        setLoading(true);
        addLog('Requesting microphone...');

        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
          const msg = 'Audio recording not supported.';
          setError(msg);
          addLog(msg);
          setListening(false);
          setLoading(false);
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          addLog('Microphone granted');
          const mr = new MediaRecorder(stream);
          mediaRecorderRef.current = mr;
          audioChunksRef.current = [];

          mr.ondataavailable = e => {
            audioChunksRef.current.push(e.data);
            addLog(`Chunk received: ${e.data.size} bytes`);
          };
          mr.onstop = async () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            addLog(`Recording stopped, total size: ${blob.size} bytes`);
            const form = new FormData();
            form.append('file', blob, 'recording.webm');

            try {
              addLog('Sending to server...');
              const res = await fetch('/api/speech-to-text/', { method: 'POST', body: form });
              addLog(`Server responded with status ${res.status}`);

              if (!res.ok) throw new Error(`Server ${res.status}: ${res.statusText}`);

              const { text } = await res.json();
              setTranscript(text);
              addLog(`Transcription: ${text}`);
              memoizedOnTranscriptReady?.(text);
            } catch (err) {
              const msg = `Transcription error: ${err.message}`;
              console.error(msg, err);
              setError(msg);
              addLog(msg);
            } finally {
              setLoading(false);
              setListening(false);
            }
          };
          mr.start();
          addLog('MediaRecorder.start() called');
        } catch (err) {
          const msg = `MediaRecorder error: ${err.message}`;
          console.error(msg, err);
          setError(msg);
          addLog(msg);
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
    setLogs([]);
  };

  const handleStop = () => stopRecording();

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

      {loading && <div style={{ marginTop: '0.5rem', color: '#555' }}>Transcribing audio…</div>}

      {error && <div style={{ marginTop: '0.5rem', color: 'red', backgroundColor: '#ffebee', padding: '0.5rem', borderRadius: '4px' }}>{error}</div>}

      <textarea
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        placeholder="Transcript appears here..."
        style={{ width: '100%', minHeight: '80px', marginTop: '0.5rem', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
      />

      <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666' }}>
        <strong>Debug Logs:</strong>
        <ul style={{ maxHeight: '150px', overflowY: 'auto', padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
          {logs.map((log, i) => <li key={i}>{log}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default SpeechToTextInput;
