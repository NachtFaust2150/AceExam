/**
 * exam.js — Exam engine for AceExam Flask frontend.
 * Uses QUESTIONS, EXAM_ID, DISABILITY_TYPE, TIME_MULTIPLIER, BASE_DURATION
 * injected from the Jinja template.
 */

let currentIndex = 0;
let answers = {};
let totalDuration = Math.round(BASE_DURATION * TIME_MULTIPLIER);
let timeLeft = totalDuration;
let timerInterval = null;
let submitted = false;

// Accessibility state
const a11y = {
  largeText: false, highContrast: false, tts: false,
  voice: false, dyslexia: false,
  reduceMotion: false, colorOverlay: false, colorBlind: false,
  zoom: false, readingRuler: false, focusMode: false,
  visualAlerts: false, captions: false
};


// Auto-enable accessibility based on disability mapper
const autoProfiles = {
  blind: ['tts', 'voice', 'highContrast', 'zoom'],
  visual_impairment: ['largeText', 'zoom', 'colorOverlay'], // focus highlight -> colorOverlay
  dyslexia: ['dyslexia', 'largeText', 'readingRuler'],
  motor: ['voice', 'largeText', 'focusMode'],
  adhd: ['focusMode', 'colorOverlay', 'reduceMotion'], // distraction free + focus highlight
  hearing: ['visualAlerts', 'captions'],
  none: []
};
(autoProfiles[DISABILITY_TYPE] || []).forEach(k => {
  a11y[k] = true;
});

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  renderQuestion();
  renderPalette();
  startTimer();
  applyA11y();

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
});

// ===================== RENDER =====================
function renderQuestion() {
  const q = QUESTIONS[currentIndex];
  if (!q) return;

  document.getElementById('q-counter').textContent =
    `Question ${currentIndex + 1} of ${QUESTIONS.length}`;
  document.getElementById('q-text').textContent = q.text;

  const diffEl = document.getElementById('q-difficulty');
  diffEl.textContent = q.difficulty || 'medium';
  diffEl.className = `badge badge-${q.difficulty || 'medium'}`;

  const labels = ['A', 'B', 'C', 'D'];
  const optList = document.getElementById('options-list');
  optList.innerHTML = q.options.map((opt, i) => {
    const sel = answers[q.id] === labels[i] ? 'selected' : '';
    return `<button class="option-btn ${sel}" onclick="selectOption('${labels[i]}')"
              aria-label="Option ${labels[i]}: ${opt}">
      <span class="option-label">${labels[i]}</span>
      <span class="option-text">${opt}</span>
    </button>`;
  }).join('');

  // Nav buttons
  document.getElementById('btn-prev').disabled = currentIndex === 0;
  document.getElementById('btn-next').disabled = currentIndex === QUESTIONS.length - 1;

  // TTS auto-read
  if (a11y.tts) {
    const text = `Question ${currentIndex + 1}. ${q.text}. Options: ${q.options.map((o,i) => labels[i]+', '+o).join('. ')}`;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  // Voice status
  const vs = document.getElementById('voice-status');
  if (vs) vs.style.display = a11y.voice ? 'flex' : 'none';
}

function renderPalette() {
  const grid = document.getElementById('palette-grid');
  grid.innerHTML = QUESTIONS.map((q, i) => {
    let cls = '';
    if (i === currentIndex) cls = 'current';
    if (answers[q.id]) cls += ' answered';
    return `<button class="palette-btn ${cls}" onclick="goTo(${i})"
              aria-label="Question ${i+1}${answers[q.id]?' (answered)':''}">${i+1}</button>`;
  }).join('');
}

// ===================== ACTIONS =====================
function selectOption(label) {
  if (submitted) return;
  const q = QUESTIONS[currentIndex];
  answers[q.id] = label;
  renderQuestion();
  renderPalette();
}

function goNext() { if (currentIndex < QUESTIONS.length - 1) { currentIndex++; renderQuestion(); renderPalette(); } }
function goPrev() { if (currentIndex > 0) { currentIndex--; renderQuestion(); renderPalette(); } }
function goTo(i) { currentIndex = i; renderQuestion(); renderPalette(); }

// ===================== TIMER =====================
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitExam();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const el = document.getElementById('timer-display');
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const timer = document.getElementById('exam-timer');
  if (timeLeft < 300) timer.classList.add('warning');
  else timer.classList.remove('warning');
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

// ===================== REVIEW / CONFIRM / SUBMIT =====================
function showReview() {
  const answered = Object.keys(answers).length;
  const unanswered = QUESTIONS.length - answered;
  document.getElementById('review-summary').innerHTML =
    `<span class="badge badge-success">${answered} Answered</span> ` +
    `<span class="badge badge-danger">${unanswered} Unanswered</span> ` +
    `<span>⏱️ ${formatTime(timeLeft)} remaining</span>`;

  const labels = ['A','B','C','D'];
  document.getElementById('review-grid').innerHTML = QUESTIONS.map((q, i) => {
    const ans = answers[q.id];
    const cls = ans ? 'badge-success' : 'badge-danger';
    const text = q.text.length > 60 ? q.text.slice(0,60)+'…' : q.text;
    return `<div class="review-item" onclick="closeReview();goTo(${i});">
      <span class="review-item-num">${i+1}</span>
      <span class="review-item-text">${text}</span>
      <span class="review-item-badge ${cls}">${ans ? '✓ '+ans : '✗ Skip'}</span>
    </div>`;
  }).join('');

  document.getElementById('review-modal').style.display = 'flex';
}

function closeReview() { document.getElementById('review-modal').style.display = 'none'; }

function showConfirm() {
  document.getElementById('review-modal').style.display = 'none';
  document.getElementById('confirm-text').innerHTML =
    `You have answered <strong>${Object.keys(answers).length}</strong> of <strong>${QUESTIONS.length}</strong> questions.<br>
     Time remaining: <strong>${formatTime(timeLeft)}</strong>`;
  document.getElementById('confirm-modal').style.display = 'flex';
}

function closeConfirm() { document.getElementById('confirm-modal').style.display = 'none'; }

async function submitExam() {
  if (submitted) return;
  submitted = true;
  clearInterval(timerInterval);
  document.getElementById('confirm-modal').style.display = 'none';

  const timeTaken = totalDuration - timeLeft;

  try {
    const res = await fetch('/api/submit-exam', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ exam_id: EXAM_ID, answers, time_taken: timeTaken })
    });
    const data = await res.json();

    // Show result
    document.getElementById('exam-root').innerHTML = '';
    const pct = data.total > 0 ? Math.round((data.score / data.total) * 100) : 0;
    document.getElementById('result-screen').style.display = 'flex';
    document.getElementById('result-stats').innerHTML = `
      <div class="result-stat"><span class="result-value">${data.score}</span><span class="result-label">Correct</span></div>
      <div class="result-stat"><span class="result-value">${data.total}</span><span class="result-label">Total</span></div>
      <div class="result-stat"><span class="result-value">${pct}%</span><span class="result-label">Score</span></div>
      <div class="result-stat"><span class="result-value">${formatTime(data.time_taken)}</span><span class="result-label">Time</span></div>`;
  } catch (err) {
    alert('Submission failed: ' + err.message);
    submitted = false;
  }
}

// ===================== ACCESSIBILITY =====================
function toggleA11y(key) {
  a11y[key] = !a11y[key];
  applyA11y();

  // Voice toggle
  if (key === 'voice') {
    if (a11y.voice) startVoice();
    else stopVoice();
  }
}

function applyA11y() {
  document.body.classList.toggle('large-text', a11y.largeText);
  document.body.classList.toggle('high-contrast', a11y.highContrast);
  document.body.classList.toggle('dyslexia-font', a11y.dyslexia);
  document.body.classList.toggle('reduce-motion', a11y.reduceMotion);
  document.body.classList.toggle('color-blind', a11y.colorBlind);
  document.body.classList.toggle('focus-mode', a11y.focusMode);
  document.body.classList.toggle('zoom-enabled', a11y.zoom);
  document.body.classList.toggle('visual-alerts', a11y.visualAlerts);
  document.body.classList.toggle('captions-enabled', a11y.captions);

  // Update toolbar button active states
  document.getElementById('btn-large-text')?.classList.toggle('active', a11y.largeText);
  document.getElementById('btn-contrast')?.classList.toggle('active', a11y.highContrast);
  document.getElementById('btn-tts')?.classList.toggle('active', a11y.tts);
  document.getElementById('btn-voice')?.classList.toggle('active', a11y.voice);
  document.getElementById('btn-dyslexia')?.classList.toggle('active', a11y.dyslexia);

  const vs = document.getElementById('voice-status');
  if (vs) vs.style.display = a11y.voice ? 'flex' : 'none';

  // Auto-start voice if enabled at init
  if (a11y.voice && typeof startVoice === 'function') {
    startVoice();
  }

  // Reading Ruler logic
  if (a11y.readingRuler) {
    document.addEventListener('mousemove', updateRuler);
    let ruler = document.getElementById('reading-ruler-overlay');
    if (!ruler) {
      ruler = document.createElement('div');
      ruler.id = 'reading-ruler-overlay';
      ruler.innerHTML = `
        <div class="reading-ruler-dim reading-ruler-top"></div>
        <div class="reading-ruler-band" id="reading-ruler-band"></div>
        <div class="reading-ruler-dim reading-ruler-bottom"></div>
      `;
      document.body.appendChild(ruler);
    }
    ruler.style.display = 'block';
  } else {
    document.removeEventListener('mousemove', updateRuler);
    const ruler = document.getElementById('reading-ruler-overlay');
    if (ruler) ruler.style.display = 'none';
  }

  // Color Overlay logic
  if (a11y.colorOverlay) {
    let overlay = document.getElementById('color-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'color-overlay';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
  } else {
    const overlay = document.getElementById('color-overlay');
    if (overlay) overlay.style.display = 'none';
  }
}

function updateRuler(e) {
  const y = e.clientY;
  const top = document.querySelector('.reading-ruler-top');
  const band = document.getElementById('reading-ruler-band');
  const bottom = document.querySelector('.reading-ruler-bottom');
  if (top && band && bottom) {
    top.style.height = `${Math.max(0, y - 40)}px`;
    band.style.top = `${Math.max(0, y - 40)}px`;
    bottom.style.top = `${y + 40}px`;
  }
}

function toggleShortcutsPanel() {
  const p = document.getElementById('shortcuts-panel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

// ===================== KEYBOARD =====================
function handleKeyboard(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const key = e.key.toLowerCase();

  if (key === 'arrowright' || key === 'n') goNext();
  else if (key === 'arrowleft' || key === 'p') goPrev();
  else if (key === 'a') selectOption('A');
  else if (key === 'b') selectOption('B');
  else if (key === 'c' && !e.ctrlKey) toggleA11y('colorBlind');
  else if (key === 'd') selectOption('D');
  else if (key === 'm') toggleA11y('reduceMotion');
  else if (key === 'z') toggleA11y('zoom');
  else if (key === 'r') toggleA11y('readingRuler');
  else if (key === 'f') toggleA11y('focusMode');
  else if (key === 'o') toggleA11y('colorOverlay');
}
