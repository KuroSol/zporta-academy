import React, { useState, useEffect, useCallback, useRef } from 'react';

const SpeechToTextInput = ({ onTranscriptReady }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);

  const recognitionRef = useRef(null);

  // Memoize callback
  const memoizedOnTranscriptReady = useCallback(onTranscriptReady, [onTranscriptReady]);
  const addLog = msg => setLogs(prev => [...prev, msg]);

  useEffect(() => {
    if (!listening) return;

    // Check API support
    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechAPI) {
      const msg = "Speech recognition not supported in this environment.";
      setError(msg);
      addLog(msg);
      setListening(false);
      return;
    }

    const recognition = new SpeechAPI();
    recognitionRef.current = recognition;

    // Configure
    recognition.lang = 'en-US';
    recognition.continuous = true;       // keep listening
    recognition.interimResults = true;   // get interim transcripts

    recognition.onstart = () => addLog('Recognition started');

    recognition.onresult = event => {
      let interim = '';
      let finalTranscript = transcript;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          addLog(`Final: ${result[0].transcript}`);
        } else {
          interim += result[0].transcript;
          addLog(`Interim: ${result[0].transcript}`);
        }
      }
      const combined = finalTranscript + interim;
      setTranscript(combined);
      memoizedOnTranscriptReady?.(combined);
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

    // Start
    try {
      recognition.start();
      setError('');
      addLog('recognition.start() called');
    } catch (e) {
      const msg = `Could not start recognition: ${e.message}`;
      setError(msg);
      addLog(msg);
      setListening(false);
    }

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        addLog('recognition.stop() called');
      }
    };
  }, [listening, memoizedOnTranscriptReady]);

  const handleStart = () => {
    setTranscript('');
    setError('');
    setLogs([]);
    setListening(true);
  };

  const handleStop = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  };

  return (
    <div style={{ margin: '1rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px', background: '#f9f9f9' }}>
      <div style={{ marginBottom: '.75rem' }}>
        <button onClick={handleStart} disabled={listening} style={{ padding: '.5rem 1rem', marginRight: '.5rem' }}>
          🎙️ Start Speaking
        </button>
        <button onClick={handleStop} disabled={!listening} style={{ padding: '.5rem 1rem' }}>
          ✋ Stop
        </button>
      </div>
      {error && <div style={{ color: 'red', background: '#fee', padding: '.5rem' }}>{error}</div>}
      <textarea
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        placeholder="Transcript here…"
        style={{ width: '100%', minHeight: '80px', marginTop: '.5rem' }}
      />
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
