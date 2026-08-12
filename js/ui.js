/* ══════════════════════════════════════════════
   ui.js — Componentes de UI genéricos
   ══════════════════════════════════════════════ */

import { API } from './api.js?v=20260807-1300';
import { session } from './state.js?v=20260807-1300';
import { authFetch } from './auth.js?v=20260807-1300';

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

/* ── Modal de fallback: closer indisponível na confirmação (WF2 sendToPool) ── */
let poolFallbackReservation = null;

// reservationData: st.activeReservation (sdr.js) ou o item da lista (pending.js) —
// só precisa de leadId/clientEmail/clientValue/segmentKey/subgroupKey pro /pool-add.
export function showPoolFallbackModal(reservationData) {
  poolFallbackReservation = reservationData;
  var modal = document.getElementById('poolFallbackModal');
  if (modal) modal.style.display = 'flex';
}

export function closePoolFallbackModal() {
  var modal = document.getElementById('poolFallbackModal');
  if (modal) modal.style.display = 'none';
  poolFallbackReservation = null;
}

export async function confirmPoolFallback() {
  var data = poolFallbackReservation;
  if (!data) { closePoolFallbackModal(); return; }
  var btn = document.getElementById('poolFallbackSendBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
  try {
    const res = await authFetch(API.poolAdd, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId:      data.leadId,
        clientEmail: data.clientEmail,
        clientValue: data.clientValue,
        segmentKey:  data.segmentKey,
        subgroupKey: data.subgroupKey,
        sdrEmail:    session ? session.email : ''
      })
    });
    const raw = await res.json();
    const d = Array.isArray(raw) ? raw[0] : raw;
    if (d && d.error) throw new Error(d.error);
    showToast('Lead enviado ao Mercado com sucesso', 'success');
  } catch(e) {
    showToast('Erro ao enviar ao Mercado: ' + e.message, 'error', 5000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar ao Mercado'; }
    closePoolFallbackModal();
  }
}
