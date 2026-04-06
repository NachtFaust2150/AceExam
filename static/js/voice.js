/**
 * voice.js — Audio Recording & STT mapping for AceExam Flask frontend.
 * Records audio using MediaRecorder and sends blobs to /api/stt/predict/
 * Maps returned commands to exam actions natively.
 */

let mediaRecorder = null;
let voiceRunning = false;
let audioChunks = [];

async function startVoice() {
  if (voiceRunning) return;
  voiceRunning = true;

  const dot = document.getElementById('voice-dot');
  const label = document.getElementById('voice-label');
  const transcript = document.getElementById('voice-transcript');

  if (dot) dot.classList.add('active');
  if (label) label.textContent = 'Listening...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (!voiceRunning) return; // stopped manually
      
      if (audioChunks.length > 0) {
        console.log('[STT] Packaging audio chunks into Blob...');
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = []; // clear for next chunk
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'command.webm');

        try {
          console.log('[STT] Sending audio blob to server (/api/stt/predict/)...');
          if (transcript) transcript.textContent = "Processing chunk...";
          
          const res = await fetch('/api/stt/predict/', {
            method: 'POST',
            body: formData
          });
          
          console.log('[STT] Response arrived. HTTP Status:', res.status);
          const data = await res.json();
          console.log('[STT] Response parsed:', data);
          
          if (data.success && data.command && data.command !== 'silence' && data.command !== 'error') {
            const spoken = data.command.toLowerCase().trim();
            console.log(`[STT] Command recognized successfully: "${spoken}" (Conf: ${data.confidence || '?'})`);
            if (transcript) transcript.textContent = `"${spoken}"`;

            console.log(`[STT] Executing mapped command for: "${spoken}"`);
            
            // Map commands (as specified)
            if (spoken === 'option a' || spoken === 'option_a' || spoken === 'a') {
                console.log('[STT] Clicking mapped button: Option A');
                selectOption('A');
            }
            else if (spoken === 'option b' || spoken === 'option_b' || spoken === 'b') {
                console.log('[STT] Clicking mapped button: Option B');
                selectOption('B');
            }
            else if (spoken === 'option c' || spoken === 'option_c' || spoken === 'c') {
                console.log('[STT] Clicking mapped button: Option C');
                selectOption('C');
            }
            else if (spoken === 'option d' || spoken === 'option_d' || spoken === 'd') {
                console.log('[STT] Clicking mapped button: Option D');
                selectOption('D');
            }
            else if (spoken === 'next') {
                console.log('[STT] Clicking mapped button: Next');
                goNext();
            }
            else if (spoken === 'previous' || spoken === 'back') {
                console.log('[STT] Clicking mapped button: Previous');
                goPrev();
            }
            else if (spoken === 'submit') {
                console.log('[STT] Clicking mapped button: Submit');
                showReview();
            }
            else if (spoken === 'confirm') {
              const cm = document.getElementById('confirm-modal');
              if (cm && cm.style.display === 'flex') {
                  console.log('[STT] Clicking mapped button: Confirm Submission');
                  submitExam();
              }
            }
            else if (spoken === 'cancel') {
                console.log('[STT] Clicking mapped button: Cancel');
                closeReview();
                closeConfirm();
            }
            else if (spoken === 'read') {
              console.log('[STT] Clicking mapped button: Read Question');
              if (typeof renderQuestion === 'function') {
                const q = QUESTIONS[currentIndex];
                const labels = ['A','B','C','D'];
                const text = `Question ${currentIndex+1}. ${q.text}. ${q.options.map((o,i)=>labels[i]+', '+o).join('. ')}`;
                speechSynthesis.cancel();
                speechSynthesis.speak(new SpeechSynthesisUtterance(text));
              }
            }
            else {
                console.log('[STT] Command not mapped to any button.');
            }
          } else {
             // Revert transcript to Listening if silence was detected
             if (transcript && transcript.textContent === "Processing chunk...") {
                 transcript.textContent = "Listening...";
             }
          }
        } catch (err) {
          console.error('[STT] Voice API Fetch Error:', err);
        }
      }

      // Loop recording
      if (voiceRunning && mediaRecorder.state === 'inactive') {
        try {
          mediaRecorder.start();
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') mediaRecorder.stop();
          }, 3500); // Record chunks of 3.5 seconds
        } catch (e) {
          console.warn('Restart failed', e);
        }
      }
    };

    // Initial start
    mediaRecorder.start();
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') mediaRecorder.stop();
    }, 3500);

  } catch (err) {
    console.warn('[Voice] Init failed:', err);
    if (label) label.textContent = 'Voice error (Microphone permission?)';
    voiceRunning = false;
  }
}

function stopVoice() {
  voiceRunning = false;
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

