/* ══════════════════════════════════════════════
   ui.js — Componentes de UI genéricos
   ══════════════════════════════════════════════ */

export function showToast(msg, type, duration) {
  var tc = document.getElementById('toastContainer');
  if (!tc) return;
  var t = document.createElement('div');
  t.className = 'toast toast-' + (type || 'info');
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(function() { t.classList.add('show'); }, 10);
  setTimeout(function() {
    t.classList.remove('show');
    setTimeout(function() { t.remove(); }, 300);
  }, duration || 3500);
}

export function toggleTheme() {
  var isLight = document.body.classList.toggle('light');
  var btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
  try { localStorage.setItem('ca_theme', isLight ? 'light' : 'dark'); } catch(e) {}
}
