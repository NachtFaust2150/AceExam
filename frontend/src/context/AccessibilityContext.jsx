import { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext(null);

const DEFAULTS = {
  largeText: false,
  highContrast: false,
  ttsEnabled: false,
  voiceEnabled: false,
  dyslexiaMode: false,
  reduceMotion: false,
  colourOverlay: null,       // null | { colour, opacity }
  colourBlindFilter: null,   // null | 'red-green' | 'blue-yellow' | 'monochrome'
  visualAlerts: false,
  zoomLevel: 1,              // 1 | 1.5 | 2
  readingRuler: false,
  distractionFree: false,
};

// Time multipliers per disability type
const TIME_MULTIPLIERS = {
  none: 1,
  blind: 2,
  visual_impairment: 1.75,
  dyslexia: 1.5,
  motor: 1.75,
  adhd: 1.25,
  hearing: 1,
};

export function getTimeMultiplier(disabilityType) {
  return TIME_MULTIPLIERS[disabilityType?.toLowerCase()] || 1;
}

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('aceexam_accessibility');
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
  });

  useEffect(() => {
    localStorage.setItem('aceexam_accessibility', JSON.stringify(settings));
    // Apply CSS classes to document html for robust rem inheritance
    document.documentElement.classList.toggle('large-text', settings.largeText);
    document.body.classList.toggle('large-text', settings.largeText);
    // High contrast is scoped — only apply if exam page is active
    const isExamPage = document.querySelector('.exam-container') !== null;
    if (isExamPage) {
      document.documentElement.classList.toggle('high-contrast', settings.highContrast);
      document.body.classList.toggle('high-contrast', settings.highContrast);
    } else {
      document.documentElement.classList.remove('high-contrast');
      document.body.classList.remove('high-contrast');
    }
    document.body.classList.toggle('dyslexia-mode', settings.dyslexiaMode);
    document.body.classList.toggle('reduce-motion', settings.reduceMotion);

    // Colour blind filters
    document.body.classList.remove('cb-red-green', 'cb-blue-yellow', 'cb-monochrome');
    if (settings.colourBlindFilter) {
      document.body.classList.add(`cb-${settings.colourBlindFilter}`);
    }
  }, [settings]);

  const toggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const applyProfileDefaults = (disabilityType) => {
    if (!disabilityType || disabilityType === 'none') return;
    
    setSettings(prev => {
      const newSettings = { ...prev };
      switch (disabilityType.toLowerCase()) {
        case 'blind':
          newSettings.ttsEnabled = true;
          newSettings.voiceEnabled = true;
          newSettings.highContrast = true;
          newSettings.zoomLevel = 1.5;
          break;
        case 'visual_impairment':
          newSettings.largeText = true;
          newSettings.zoomLevel = 1.5;
          break;
        case 'dyslexia':
          newSettings.dyslexiaMode = true;
          newSettings.largeText = true;
          newSettings.readingRuler = true;
          break;
        case 'motor':
          newSettings.voiceEnabled = true;
          newSettings.largeText = true;
          newSettings.distractionFree = true;
          break;
        case 'adhd':
          newSettings.distractionFree = true;
          newSettings.reduceMotion = true;
          break;
        case 'hearing':
          newSettings.visualAlerts = true;
          break;
      }
      return newSettings;
    });
  };

  return (
    <AccessibilityContext.Provider value={{ ...settings, toggle, setSetting, applyProfileDefaults }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
