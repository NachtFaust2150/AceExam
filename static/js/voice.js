/**
 * voice.js — Audio Recording & STT mapping for AceExam Flask frontend.
 * Uses Web Audio API for Voice Activity Detection (VAD) to eliminate delay.
 * Records audio when speech starts, stops immediately on silence, and sends to backend.
 */

let mediaRecorder = null;
let voiceRunning = false;
let audioChunks = [];
let audioContext = null;
let reqFrame = null;

async function startVoice() {
  if (voiceRunning) return;
  voiceRunning = true;

  const dot = document.getElementById('voice-dot');
  const label = document.getElementById('voice-label');
  const transcript = document.getElementById('voice-transcript');

  if (dot) dot.classList.add('active');
  if (label) label.textContent = 'Voice Active (Say a command)';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Setup MediaRecorder
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (audioChunks.length === 0) return;
      
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = []; // clear
      
      if (transcript) transcript.textContent = "Processing...";
      const formData = new FormData();
      formData.append('audio', audioBlob, 'command.webm');

      try {
        const res = await fetch('/api/stt/predict/', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.success && data.command && data.command !== 'silence' && data.command !== 'error') {
          const spoken = data.command.toLowerCase().trim();
          if (transcript) transcript.textContent = `"${spoken}"`;
          
          if (spoken === 'option a' || spoken === 'option_a' || spoken === 'a') selectOption('A');
          else if (spoken === 'option b' || spoken === 'option_b' || spoken === 'b') selectOption('B');
          else if (spoken === 'option c' || spoken === 'option_c' || spoken === 'c') selectOption('C');
          else if (spoken === 'option d' || spoken === 'option_d' || spoken === 'd') selectOption('D');
          else if (spoken === 'next') goNext();
          else if (spoken === 'previous' || spoken === 'back') goPrev();
          else if (spoken === 'submit') showReview();
          else if (spoken === 'confirm') {
            const cm = document.getElementById('confirm-modal');
            if (cm && cm.style.display === 'flex') submitExam();
          }
          else if (spoken === 'cancel') {
            closeReview();
            closeConfirm();
          }
          else if (spoken === 'read') {
            if (typeof renderQuestion === 'function') {
              const q = QUESTIONS[currentIndex];
              const labels = ['A','B','C','D'];
              const text = `Question ${currentIndex+1}. ${q.text}. ${q.options.map((o,i)=>labels[i]+', '+o).join('. ')}`;
              speechSynthesis.cancel();
              speechSynthesis.speak(new SpeechSynthesisUtterance(text));
            }
          }
        } else {
           if (transcript && transcript.textContent === "Processing...") {
               transcript.textContent = "Waiting for speech...";
           }
        }
      } catch (err) {
        console.error('[STT] Voice API Fetch Error:', err);
      }
    };

    // Setup Web Audio VAD
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.minDecibels = -70; // lower threshold
    source.connect(analyser);

    const pcmData = new Float32Array(analyser.fftSize);
    let isSpeaking = false;
    let silenceTimer = null;

    function checkAudioLevel() {
      if (!voiceRunning) return;
      
      analyser.getFloatTimeDomainData(pcmData);
      let sumSquares = 0.0;
      for (let i = 0; i < pcmData.length; i++) {
        sumSquares += pcmData[i] * pcmData[i];
      }
      let rms = Math.sqrt(sumSquares / pcmData.length);
      
      const threshold = 0.015; // Tuning volume trigger

      if (rms > threshold) {
        if (!isSpeaking) {
          isSpeaking = true;
          if (mediaRecorder.state === 'inactive') {
            mediaRecorder.start();
          }
          if (transcript) transcript.textContent = "Listening...";
        }
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      } else {
        if (isSpeaking) {
          if (!silenceTimer) {
            // End recording 800ms after user stops speaking
            silenceTimer = setTimeout(() => {
              isSpeaking = false;
              silenceTimer = null;
              if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
              }
            }, 800);
          }
        }
      }
      reqFrame = requestAnimationFrame(checkAudioLevel);
    }
    
    checkAudioLevel();
    if (transcript) transcript.textContent = 'Waiting for speech...';

  } catch (err) {
    console.warn('[Voice] Init failed:', err);
    if (label) label.textContent = 'Microphone blocked';
    voiceRunning = false;
  }
}

function stopVoice() {
  voiceRunning = false;
  
  if (reqFrame) cancelAnimationFrame(reqFrame);
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch (e) { /* ignore */ }
  }
  
  mediaRecorder = null;
  audioChunks = [];
  
  const dot = document.getElementById('voice-dot');
  const label = document.getElementById('voice-label');
  if (dot) dot.classList.remove('active');
  if (label) label.textContent = 'Voice off';
  const transcript = document.getElementById('voice-transcript');
  if (transcript) transcript.textContent = '';
}

