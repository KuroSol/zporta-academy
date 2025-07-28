import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api';  // use configured Axios instance

const SpeechToTextInput = ({ onTranscriptReady }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const memoizedOnTranscriptReady = useCallback(onTranscriptReady, [onTranscriptReady]);

  const addLog = msg => setLogs(prev => [...prev, msg]);

  useEffect(() => {
    if (!listening) return;

    addLog(`Listening started (isPWA=${isPWA})`);

    if (!isPWA) {
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
        const msg = `Error: ${event.error}`;
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
        addLog('recognition.start() called');
      } catch (e) {
        const msg = `Start recognition failed: ${e.message}`;
        console.error(msg, e);
        setError(msg);
        addLog(msg);
        setListening(false);
      }

      return () => recognition.stop();
    } else {
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
            addLog(`Chunk: ${e.data.size} bytes`);
          };
          mr.onstop = async () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            addLog(`Recording stopped, size: ${blob.size} bytes`);
            const form = new FormData();
            form.append('file', blob, 'rec.webm');

            try {
              addLog('Uploading...');
              const res = await apiClient.post('/speech-to-text/', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
              addLog(`HTTP ${res.status}`);
              const { text } = res.data;
              setTranscript(text);
              addLog(`Transcribed: ${text}`);
              memoizedOnTranscriptReady?.(text);
            } catch (err) {
              const status = err.response?.status;
              const msg = status
                ? `Transcription failed: ${status} ${err.response.statusText}`
                : `Network error: ${err.message}`;
              console.error(err);
              setError(msg);
              addLog(msg);
            } finally {
              setLoading(false);
              setListening(false);
            }
          };
          mr.start();
          addLog('mediaRecorder.start() called');
        } catch (err) {
          const msg = `MediaRecorder error: ${err.message}`;
          console.error(err);
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
    setLogs([]);
    setListening(true);
  };
  const handleStop = () => stopRecording();

  return (
    <div style={{ margin: '1rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px', background: '#f9f9f9' }}>
      <div style={{ marginBottom: '.75rem' }}>
        <button onClick={handleStart} disabled={listening || loading} style={{ padding: '.5rem 1rem', marginRight: '.5rem' }}>
          {isPWA ? '🔴 Start Recording' : '🎙️ Start Speaking'}
        </button>
        <button onClick={handleStop} disabled={!listening} style={{ padding: '.5rem 1rem' }}>
          {isPWA ? '⏹️ Stop & Transcribe' : '✋ Stop'}
        </button>
      </div>
      {loading && <div style={{ color: '#555' }}>Transcribing…</div>}
      {error && <div style={{ color: 'red', background: '#fee', padding: '.5rem' }}>{error}</div>}
      <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Transcript here…" style={{ width: '100%', minHeight: '80px', marginTop: '.5rem' }} />
      <div style={{ marginTop: '1rem', fontSize: '.85rem' }}>
        <strong>Logs:</strong>
        <ul style={{ maxHeight: '150px', overflowY: 'auto', background: '#fff', padding: '.5rem', border: '1px solid #ddd' }}>
          {logs.map((l,i)=><li key={i}>{l}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default SpeechToTextInput;
