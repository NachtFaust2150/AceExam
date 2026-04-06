import { useCallback, useRef, useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000/api/predict/';
const CHUNK_DURATION_MS = 2000; // 2 seconds — long enough for a full spoken word
const MIN_BLOB_SIZE = 1000;    // Reject blobs smaller than ~1KB (too short to contain speech)

/**
 * Custom hook for Text-to-Speech and ML-based Speech Recognition.
 * Records audio in chunks via MediaRecorder, sends to Django PyTorch backend.
 */
export function useSpeech({ onCommand } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');

  const streamRef = useRef(null);
  const isListeningRef = useRef(false);
  const timeoutRef = useRef(null);
  const recorderRef = useRef(null);
  const isSendingRef = useRef(false);       // prevent overlapping fetches

  // -------- Text-to-Speech --------
  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  // -------- ML Command Mapping --------
  const handleMLCommand = useCallback((command) => {
    if (!command || command === 'silence' || command === 'error') return;

    setLastTranscript(`[AI]: ${command}`);
    console.log('[useSpeech] Executing command:', command);

    if (command.startsWith('option_')) {
      const val = command.split('_')[1].toUpperCase();
      onCommand?.({ type: 'select', value: val });
    } else {
      onCommand?.({ type: command });
    }
  }, [onCommand]);

  // -------- Send audio blob to backend --------
  const sendAudioBlob = useCallback(async (blob) => {
    // Guard: skip if blob is too small (silence / partial chunk)
    if (blob.size < MIN_BLOB_SIZE) {
      console.log(`[useSpeech] Skipping tiny blob (${blob.size} bytes)`);
      return;
    }

    // Guard: skip if a previous request is still in flight
    if (isSendingRef.current) {
      console.log('[useSpeech] Skipping — previous request still pending');
      return;
    }

    isSendingRef.current = true;
    console.log(`[useSpeech] Sending ${blob.size} byte audio chunk to ${API_URL}`);

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'chunk.webm');

      const res = await fetch(API_URL, { method: 'POST', body: formData });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[useSpeech] Server error:', res.status, errText);
        setLastTranscript('[Error] Server returned ' + res.status);
        return;
      }

      const data = await res.json();
      console.log('[useSpeech] Server response:', data);

      if (data.command) {
        handleMLCommand(data.command);
      }
    } catch (err) {
      console.error('[useSpeech] Fetch failed:', err);
      setLastTranscript('[Error] Connection failed');
    } finally {
      isSendingRef.current = false;
    }
  }, [handleMLCommand]);

  // -------- Cyclic MediaRecorder --------
  const startListening = useCallback(async () => {
    if (isListeningRef.current) return; // already running

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      isListeningRef.current = true;
      setIsListening(true);
      setLastTranscript('Listening...');
      console.log('[useSpeech] Microphone stream acquired — starting recorder loop');

      const runCycle = () => {
        if (!isListeningRef.current || !streamRef.current) return;

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : undefined;

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        const chunks = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          if (chunks.length > 0 && isListeningRef.current) {
            const blob = new Blob(chunks, { type: recorder.mimeType });
            sendAudioBlob(blob);
          }
          // Schedule the next cycle
          if (isListeningRef.current) {
            timeoutRef.current = setTimeout(runCycle, 200); // small gap between cycles
          }
        };

        recorder.onerror = (e) => {
          console.error('[useSpeech] MediaRecorder error:', e);
        };

        recorderRef.current = recorder;
        recorder.start();       // collect all data until stop()

        // Stop after CHUNK_DURATION_MS to flush as one blob
        timeoutRef.current = setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, CHUNK_DURATION_MS);
      };

      runCycle();
    } catch (err) {
      console.error('[useSpeech] Microphone access denied:', err);
      setIsListening(false);
      isListeningRef.current = false;
      setLastTranscript('[Error] Mic access denied');
    }
  }, [sendAudioBlob]);

  // -------- Stop everything --------
  const stopListening = useCallback(() => {
    console.log('[useSpeech] Stopping listener');
    isListeningRef.current = false;
    setIsListening(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  return {
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    isListening,
    lastTranscript,
  };
}
