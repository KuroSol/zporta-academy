// To use this component:
// 1) cd zporta_academy_frontend && npm install vosk-browser
// 2) Download vosk-model-small-en-us-0.15.zip, extract its contents into:
//      public/models/vosk-model-small-en-us-0.15/
// 3) Inside that folder create a tar.gz of the files named model.tar.gz
//    so you have:
//      public/models/vosk-model-small-en-us-0.15/model.tar.gz
// 4) Restart your React dev server; the model will then be served at:
//      http://localhost:3000/models/vosk-model-small-en-us-0.15/model.tar.gz

import React, { useState, useEffect, useRef } from 'react';
import { createModel } from 'vosk-browser';

export default function SpeechToTextInput({ onTranscriptReady }) {
  const [recognizer, setRecognizer] = useState(null);
  const [transcript, setTranscript]   = useState('');
  const [listening, setListening]     = useState(false);
  const [error, setError]             = useState('');

  const audioContextRef = useRef(null);
  const processorRef    = useRef(null);
  const sourceRef       = useRef(null);

  // 1) Load Vosk model & instantiate the recognizer
  useEffect(() => {
    createModel('/models/vosk-model-small-en-us-0.15/model.tar.gz')
      .then(model => {
        // The Model exposes a KaldiRecognizer constructor
        const rec = new model.KaldiRecognizer(16000);
        rec.setWords(true); // optional: include word-level timestamps
        // Hook up interim (partial) results
        rec.on('partialresult', msg => {
          const text = msg.partial || '';
          setTranscript(prev => {
            const combined = (prev + ' ' + text).trim();
            onTranscriptReady?.(combined);
            return combined;
          });
        });
        // Hook up final results
        rec.on('result', msg => {
          const text = msg.result?.text || '';
          setTranscript(prev => {
            const combined = (prev + ' ' + text).trim();
            onTranscriptReady?.(combined);
            return combined;
          });
        });
        setRecognizer(rec);
      })
      .catch(err => setError('Failed to load model: ' + err.message));
  }, [onTranscriptReady]);

  // 2) When user clicks “Start Speaking”
  const startListening = async () => {
    if (!recognizer) {
      setError('Recognizer not ready — please wait a moment.');
      return;
    }
    setError('');
    setTranscript(''); // clear previous text

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Feed each buffer into Vosk; events fire automatically
      processor.onaudioprocess = e => {
        const input = e.inputBuffer.getChannelData(0);
        recognizer.acceptWaveformFloat(input, 16000);
      };

      setListening(true);
    } catch (err) {
      setError('Microphone access denied or unavailable: ' + err.message);
    }
  };

  // 3) Stop on “Stop” click
  const stopListening = () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    setListening(false);
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: 8, background: '#f9f9f9' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <button
          onClick={startListening}
          disabled={listening}
          style={{ marginRight: 8, padding: '0.5rem 1rem' }}
        >
          🎤 Start Speaking
        </button>
        <button
          onClick={stopListening}
          disabled={!listening}
          style={{ padding: '0.5rem 1rem' }}
        >
          ✋ Stop
        </button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>}

      <textarea
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        placeholder="Your live transcript will appear here..."
        style={{ width: '100%', minHeight: 100, padding: '0.5rem', borderRadius: 4, border: '1px solid #ddd' }}
      />
    </div>
  );
}
