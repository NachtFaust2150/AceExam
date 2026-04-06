/**
 * app.js — Global utilities for AceExam Flask frontend.
 * Handles modal close on overlay click and shared helpers.
 */

// Close modals when clicking the overlay background
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
  }
});

// Close modals / panels on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    const sp = document.getElementById('shortcuts-panel');
    if (sp) sp.style.display = 'none';
  }
});
