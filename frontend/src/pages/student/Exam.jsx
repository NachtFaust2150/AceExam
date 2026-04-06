import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility, getTimeMultiplier } from '../../context/AccessibilityContext';
import { useSpeech } from '../../hooks/useSpeech';
import { GET_QUESTIONS, SUBMIT_EXAM } from '../../lib/graphql';
import AccessibilityToolbar from '../../components/AccessibilityToolbar';
import './Exam.css';

const BASE_EXAM_DURATION = 30 * 60; // 30 minutes in seconds

export default function Exam() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { user, logout } = useAuth();
  const { ttsEnabled, voiceEnabled, visualAlerts, highContrast, zoomLevel, readingRuler, distractionFree, applyProfileDefaults, toggle, setSetting } = useAccessibility();
  const { data, loading } = useQuery(GET_QUESTIONS, { variables: { examId } });
  const [submitExam] = useMutation(SUBMIT_EXAM);

  // Compute exam duration with time multiplier for the student's disability
  const timeMultiplier = getTimeMultiplier(user?.disabilityType);
  const EXAM_DURATION = Math.round(BASE_EXAM_DURATION * timeMultiplier);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [result, setResult] = useState(null);
  const [visualAlert, setVisualAlert] = useState(null); // { message, type }
  const [alertsTriggered, setAlertsTriggered] = useState(new Set());
  const [rulerY, setRulerY] = useState(300);

  const questions = data?.questions || [];
  const currentQuestion = questions[currentIndex];

  // -------- Voice command handler --------
  const handleVoiceCommand = useCallback(
    (cmd) => {
      if (!currentQuestion) return;
      switch (cmd.type) {
        case 'select':
          setAnswers((prev) => ({ ...prev, [currentQuestion.id]: cmd.value }));
          break;
        case 'next':
          setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
          break;
        case 'previous':
          setCurrentIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'submit':
          setShowReview(true);
          break;
        case 'confirm':
          document.getElementById('confirm-submit-action')?.click();
          break;
        case 'cancel':
          setShowConfirm(false);
          setShowReview(false);
          break;
        case 'read':
          if (currentQuestion) readQuestion(currentQuestion);
          break;
      }
    },
    [currentQuestion, questions.length]
  );

  const { speak, stopSpeaking, startListening, stopListening, isListening, lastTranscript } =
    useSpeech({ onCommand: handleVoiceCommand });

  // -------- TTS: Auto-read question --------
  const readQuestion = useCallback(
    (q) => {
      if (!q) return;
      const optionLabels = ['A', 'B', 'C', 'D'];
      const text = `Question ${currentIndex + 1}. ${q.text}. ${q.options
        .map((o, i) => `Option ${optionLabels[i]}: ${o}`)
        .join('. ')}`;
      speak(text);
    },
    [currentIndex, speak]
  );

  useEffect(() => {
    if (ttsEnabled && currentQuestion) {
      readQuestion(currentQuestion);
    }
    return () => stopSpeaking();
  }, [currentIndex, ttsEnabled, currentQuestion]);

  // -------- Voice control & Profile Loading --------
  useEffect(() => {
    // 1. Auto-apply the user's disability accessibility profile on exam start
    if (user?.disabilityType) {
      applyProfileDefaults(user.disabilityType);
      // 2. Set initial time based on disability time multiplier
      const mult = getTimeMultiplier(user.disabilityType);
      setTimeLeft(Math.round(BASE_EXAM_DURATION * mult));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONLY once on mount

  // -------- Scope high contrast to exam page only --------
  useEffect(() => {
    // Apply high contrast class when on exam page
    document.documentElement.classList.toggle('high-contrast', highContrast);
    document.body.classList.toggle('high-contrast', highContrast);
    return () => {
      // Clean up on unmount — remove high contrast from body/html
      document.documentElement.classList.remove('high-contrast');
      document.body.classList.remove('high-contrast');
    };
  }, [highContrast]);

  useEffect(() => {
    if (voiceEnabled && !isListening) {
      startListening();
    } else if (!voiceEnabled && isListening) {
      stopListening();
    }
    return () => {
      if (isListening) stopListening();
    };
  }, [voiceEnabled, isListening, startListening, stopListening]);

  // -------- Timer --------
  useEffect(() => {
    if (submitted) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted]);

  // -------- Visual Alert: Timer Warnings --------
  useEffect(() => {
    if (!visualAlerts || submitted) return;
    const pct = timeLeft / EXAM_DURATION;
    const thresholds = [
      { key: '50', pct: 0.5, msg: '⚠️ 50% of your time has passed!', type: 'alert-warning' },
      { key: '25', pct: 0.25, msg: '⏰ Only 25% of your time remains!', type: 'alert-warning' },
      { key: '5', pct: 0.05, msg: '🚨 Less than 5% time remaining!', type: 'alert-danger' },
    ];
    for (const t of thresholds) {
      if (pct <= t.pct && !alertsTriggered.has(t.key)) {
        setAlertsTriggered(prev => new Set(prev).add(t.key));
        setVisualAlert({ message: t.msg, type: t.type });
        setTimeout(() => setVisualAlert(null), 6000);
        break;
      }
    }
  }, [timeLeft, visualAlerts, submitted, alertsTriggered]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // -------- Submit --------
  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);
    setShowConfirm(false);
    setShowReview(false);
    stopSpeaking();
    if (isListening) stopListening();

    try {
      const timeTaken = EXAM_DURATION - timeLeft;
      const { data: resData } = await submitExam({
        variables: {
          examId,
          answers: JSON.stringify(answers),
          timeTaken,
        },
      });
      setResult(resData.submitExam);
      // Visual alert for successful submission
      if (visualAlerts) {
        setVisualAlert({ message: '✅ Exam submitted successfully!', type: 'alert-success' });
        setTimeout(() => setVisualAlert(null), 5000);
      }
    } catch (err) {
      alert('Submission failed: ' + err.message);
      setSubmitted(false);
    }
  };

  // -------- Select option --------
  const selectOption = (label) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: label }));
  };

  // -------- Navigation --------
  const goNext = () => setCurrentIndex((p) => Math.min(p + 1, questions.length - 1));
  const goPrev = () => setCurrentIndex((p) => Math.max(p - 1, 0));
  const goTo = (i) => setCurrentIndex(i);

  if (loading) return <div className="exam-loading">Loading exam...</div>;
  if (questions.length === 0) return <div className="exam-loading">No questions available.</div>;

  // -------- Result screen --------
  if (result) {
    return (
      <div className="exam-result-container">
        <div className="result-card">
          <div className="result-icon">🎉</div>
          <h1>Exam Submitted!</h1>
          <div className="result-stats">
            <div className="result-stat">
              <span className="result-value">{result.score}</span>
              <span className="result-label">Correct</span>
            </div>
            <div className="result-stat">
              <span className="result-value">{result.total}</span>
              <span className="result-label">Total</span>
            </div>
            <div className="result-stat">
              <span className="result-value">
                {result.total > 0 ? Math.round((result.score / result.total) * 100) : 0}%
              </span>
              <span className="result-label">Score</span>
            </div>
            <div className="result-stat">
              <span className="result-value">{formatTime(result.timeTaken)}</span>
              <span className="result-label">Time</span>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/student')}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <div
      className={`exam-container ${distractionFree ? 'distraction-free' : ''}`}
      onMouseMove={readingRuler ? (e) => setRulerY(e.clientY) : undefined}
    >
      {/* Reading Ruler Overlay */}
      {readingRuler && (
        <div className="reading-ruler-overlay">
          <div className="reading-ruler-dim reading-ruler-top" style={{ height: rulerY - 40 }} />
          <div className="reading-ruler-band" style={{ top: rulerY - 40, height: 80 }} />
          <div className="reading-ruler-dim reading-ruler-bottom" style={{ top: rulerY + 40 }} />
        </div>
      )}

      {/* Visual Alert Banner */}
      {visualAlert && (
        <div className={`visual-alert-banner ${visualAlert.type}`} key={visualAlert.message}>
          {visualAlert.message}
        </div>
      )}

      {/* Distraction Free exit button */}
      {distractionFree && (
        <button
          className="distraction-free-exit"
          onClick={() => toggle('distractionFree')}
          title="Exit Focus Mode"
        >
          ✕ Exit Focus
        </button>
      )}

      {/* Header */}
      <header className="exam-header">
        <div className="exam-branding">
          <span>🎓</span>
          <h2>AceExam</h2>
        </div>
        <div className="exam-timer" data-warning={timeLeft < 300}>
          <span className="timer-icon">⏱️</span>
          <span className="timer-value">{formatTime(timeLeft)}</span>
        </div>
        <div className="exam-user">
          <span>{user?.name}</span>
          <button className="btn btn-danger btn-sm" onClick={() => setShowReview(true)}>
            Submit Exam
          </button>
        </div>
      </header>

      <div className="exam-body" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
        {/* Question panel */}
        <div className="question-panel">
          <div className="question-header">
            <span className="question-number">Question {currentIndex + 1} of {questions.length}</span>
            {currentQuestion.difficulty && (
              <span className={`badge badge-${currentQuestion.difficulty}`}>{currentQuestion.difficulty}</span>
            )}
          </div>

          <div className="question-text">{currentQuestion.text}</div>

          <div className="options-list">
            {currentQuestion.options.map((opt, i) => (
              <button
                key={i}
                className={`option-btn ${answers[currentQuestion.id] === optionLabels[i] ? 'selected' : ''}`}
                onClick={() => selectOption(optionLabels[i])}
                aria-label={`Option ${optionLabels[i]}: ${opt}`}
              >
                <span className="option-label">{optionLabels[i]}</span>
                <span className="option-text">{opt}</span>
              </button>
            ))}
          </div>

          {/* Voice status */}
          {voiceEnabled && (
            <div className="voice-status">
              <span className={`voice-dot ${isListening ? 'active' : ''}`}></span>
              {isListening ? 'Listening...' : 'Voice off'}
              {lastTranscript && <span className="voice-transcript">"{lastTranscript}"</span>}
            </div>
          )}

          {/* TTS button */}
          {ttsEnabled && (
            <button className="read-btn" onClick={() => readQuestion(currentQuestion)}>
              🔊 Read Question Aloud
            </button>
          )}

          <div className="question-nav">
            <button className="btn btn-primary" onClick={goPrev} disabled={currentIndex === 0}>
              ← Previous
            </button>
            <button className="btn btn-primary" onClick={goNext} disabled={currentIndex === questions.length - 1}>
              Next →
            </button>
          </div>
        </div>

        {/* Question palette */}
        <aside className="question-palette">
          <h3>Questions</h3>
          <div className="palette-grid">
            {questions.map((q, i) => (
              <button
                key={q.id}
                className={`palette-btn ${i === currentIndex ? 'current' : ''} ${answers[q.id] ? 'answered' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Go to question ${i + 1}${answers[q.id] ? ' (answered)' : ''}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="palette-legend">
            <span><span className="legend-dot current"></span> Current</span>
            <span><span className="legend-dot answered"></span> Answered</span>
            <span><span className="legend-dot"></span> Unanswered</span>
          </div>
        </aside>
      </div>

      {/* Review Screen */}
      {showReview && (
        <div className="modal-overlay" onClick={() => setShowReview(false)}>
          <div className="review-screen" onClick={(e) => e.stopPropagation()}>
            <div className="review-header">
              <h2>📋 Review Your Answers</h2>
              <p className="review-summary">
                <span className="review-stat review-answered">{Object.keys(answers).length} Answered</span>
                <span className="review-stat review-unanswered">{questions.length - Object.keys(answers).length} Unanswered</span>
                <span className="review-stat">⏱️ {formatTime(timeLeft)} remaining</span>
              </p>
            </div>
            <div className="review-grid">
              {questions.map((q, i) => {
                const isAnswered = !!answers[q.id];
                return (
                  <button
                    key={q.id}
                    className={`review-item ${isAnswered ? 'review-item-answered' : 'review-item-unanswered'}`}
                    onClick={() => { setShowReview(false); goTo(i); }}
                  >
                    <span className="review-item-num">{i + 1}</span>
                    <span className="review-item-text">{q.text.length > 60 ? q.text.slice(0, 60) + '…' : q.text}</span>
                    <span className={`review-item-badge ${isAnswered ? 'badge-success' : 'badge-danger'}`}>
                      {isAnswered ? `✓ ${answers[q.id]}` : '✗ Skip'}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="review-actions">
              <button className="btn btn-ghost" onClick={() => setShowReview(false)}>← Back to Exam</button>
              <button className="btn btn-primary" onClick={() => { setShowReview(false); setShowConfirm(true); }}>Submit Exam →</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Submit Exam?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>You have answered <strong>{Object.keys(answers).length}</strong> of <strong>{questions.length}</strong> questions.</p>
            <p style={{ color: 'var(--text-muted)' }}>Time remaining: <strong>{formatTime(timeLeft)}</strong></p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button id="confirm-submit-action" className="btn btn-primary" onClick={handleSubmit}>Confirm Submit</button>
            </div>
          </div>
        </div>
      )}

      <AccessibilityToolbar showContrast={true} />
    </div>
  );
}
