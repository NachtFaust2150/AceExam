import { useState, useEffect, useCallback } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import './AccessibilityToolbar.css';

const OVERLAY_COLOURS = [
  { key: 'yellow', label: 'Yellow', css: 'rgba(255, 235, 59, VAR)' },
  { key: 'blue',   label: 'Blue',   css: 'rgba(100, 181, 246, VAR)' },
  { key: 'pink',   label: 'Pink',   css: 'rgba(240, 98, 146, VAR)' },
  { key: 'green',  label: 'Green',  css: 'rgba(129, 199, 132, VAR)' },
];

const SHORTCUTS = [
  { key: 'm', label: 'Reduce Motion', setting: 'reduceMotion' },
  { key: 'o', label: 'Colour Overlay', setting: 'colourOverlay', isToggle: false },
  { key: 'c', label: 'Colour Blind', setting: 'colourBlindFilter', isToggle: false },
  { key: 'z', label: 'Zoom', setting: 'zoomLevel', isToggle: false },
  { key: 'r', label: 'Reading Ruler', setting: 'readingRuler' },
  { key: 'f', label: 'Focus Mode', setting: 'distractionFree' },
];

const ZOOM_CYCLE = [1, 1.5, 2];
const CB_CYCLE = [null, 'red-green', 'blue-yellow', 'monochrome'];

export default function AccessibilityToolbar({ showContrast = false }) {
  const {
    largeText, highContrast, ttsEnabled, voiceEnabled, dyslexiaMode,
    reduceMotion, colourOverlay, colourBlindFilter, zoomLevel,
    readingRuler, distractionFree, toggle, setSetting,
  } = useAccessibility();

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toast, setToast] = useState(null);

  // ---- Toast helper ----
  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e) => {
      // Don't fire when typing in inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      // Close shortcuts panel on Escape
      if (e.key === 'Escape') { setShowShortcuts(false); return; }

      const k = e.key.toLowerCase();
      switch (k) {
        case 'm':
          toggle('reduceMotion');
          showToast(`Reduce Motion: ${!reduceMotion ? 'ON' : 'OFF'}`);
          break;
        case 'o':
          if (colourOverlay) {
            setSetting('colourOverlay', null);
            showToast('Colour Overlay: OFF');
          } else {
            setSetting('colourOverlay', { colour: 'yellow', opacity: 0.2 });
            showToast('Colour Overlay: ON (Yellow)');
          }
          break;
        case 'c': {
          const idx = CB_CYCLE.indexOf(colourBlindFilter);
          const next = CB_CYCLE[(idx + 1) % CB_CYCLE.length];
          setSetting('colourBlindFilter', next);
          showToast(`Colour Blind: ${next ? next.replace('-', '/').replace(/(^|\/)(\w)/g, (_, s, c) => s + c.toUpperCase()) : 'OFF'}`);
          break;
        }
        case 'z': {
          const idx = ZOOM_CYCLE.indexOf(zoomLevel);
          const next = ZOOM_CYCLE[(idx + 1) % ZOOM_CYCLE.length];
          setSetting('zoomLevel', next);
          showToast(`Zoom: ${next}×`);
          break;
        }
        case 'r':
          toggle('readingRuler');
          showToast(`Reading Ruler: ${!readingRuler ? 'ON' : 'OFF'}`);
          break;
        case 'f':
          toggle('distractionFree');
          showToast(`Focus Mode: ${!distractionFree ? 'ON' : 'OFF'}`);
          break;
        default:
          return; // Don't prevent default for unrecognized keys
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [reduceMotion, colourOverlay, colourBlindFilter, zoomLevel, readingRuler, distractionFree, toggle, setSetting, showToast]);

  // ---- Close shortcuts on outside click ----
  useEffect(() => {
    if (!showShortcuts) return;
    const close = (e) => {
      if (!e.target.closest('.shortcuts-panel') && !e.target.closest('.shortcuts-pill')) {
        setShowShortcuts(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showShortcuts]);

  // Distraction-free: hide entire toolbar
  if (distractionFree) return null;

  return (
    <>
      {/* Colour overlay DOM element */}
      {colourOverlay && (
        <div
          className="colour-overlay-screen"
          style={{
            background: OVERLAY_COLOURS.find(c => c.key === colourOverlay.colour)?.css.replace('VAR', colourOverlay.opacity) || 'transparent',
          }}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="shortcut-toast">{toast}</div>
      )}

      {/* Shortcuts reference panel */}
      {showShortcuts && (
        <div className="shortcuts-panel">
          <div className="a11y-panel-title">Keyboard Shortcuts</div>
          {SHORTCUTS.map(s => (
            <div key={s.key} className="shortcut-row">
              <kbd className="shortcut-key">{s.key.toUpperCase()}</kbd>
              <span className="shortcut-name">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="accessibility-toolbar" role="toolbar" aria-label="Accessibility controls">
        <button
          className={`a11y-btn ${largeText ? 'active' : ''}`}
          onClick={() => toggle('largeText')}
          title="Toggle Large Text"
          aria-pressed={largeText}
        >
          <span className="a11y-icon">🔤</span>
          <span className="a11y-label">Large Text</span>
        </button>

        {showContrast && (
          <button
            className={`a11y-btn ${highContrast ? 'active' : ''}`}
            onClick={() => toggle('highContrast')}
            title="Toggle High Contrast"
            aria-pressed={highContrast}
          >
            <span className="a11y-icon">🌗</span>
            <span className="a11y-label">Contrast</span>
          </button>
        )}

        <button
          className={`a11y-btn ${ttsEnabled ? 'active' : ''}`}
          onClick={() => toggle('ttsEnabled')}
          title="Toggle Text-to-Speech"
          aria-pressed={ttsEnabled}
        >
          <span className="a11y-icon">🔊</span>
          <span className="a11y-label">TTS</span>
        </button>

        <button
          className={`a11y-btn ${voiceEnabled ? 'active' : ''}`}
          onClick={() => toggle('voiceEnabled')}
          title="Toggle Voice Input"
          aria-pressed={voiceEnabled}
        >
          <span className="a11y-icon">🎤</span>
          <span className="a11y-label">Voice</span>
        </button>

        <button
          className={`a11y-btn ${dyslexiaMode ? 'active' : ''}`}
          onClick={() => toggle('dyslexiaMode')}
          title="Toggle Dyslexia Mode"
          aria-pressed={dyslexiaMode}
        >
          <span className="a11y-icon">📖</span>
          <span className="a11y-label">Dyslexia</span>
        </button>

        <button
          className="shortcuts-pill"
          onClick={() => setShowShortcuts(v => !v)}
          title="Show keyboard shortcuts"
        >
          ⌨ Shortcuts
        </button>
      </div>
    </>
  );
}
