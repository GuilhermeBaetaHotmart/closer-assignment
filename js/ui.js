/* ══════════════════════════════════════════════
   ui.js — Componentes de UI genéricos
   ══════════════════════════════════════════════ */

import { API } from './api.js?v=20260929-2119';
import { session, st, setActiveReservation } from './state.js?v=20260929-2119';
import { authFetch } from './auth.js?v=20260929-2119';

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

// Texto padrão do modal (index.html). Guardado aqui para restaurar quando a resposta
// do backend não trouxer mensagem — senão o modal ficaria com o motivo do caso anterior.
const POOL_FALLBACK_DEFAULT = 'Não encontramos um closer disponível para este horário. Deseja enviar este lead ao Mercado?';

// reservationData: st.activeReservation (sdr.js) ou o item da lista (pending.js) —
// precisa de leadId/clientEmail/clientValue/segmentKey/subgroupKey pro /pool-add, e de
// closerId/slotId/slotStart/slotEnd/tempEventId pro /cancel-reserve (ver confirmPoolFallback).
// message: o motivo que o `2.confirm` devolve junto do sendToPool. O texto fixo do modal
// dizia "não encontramos um closer disponível", o que é impreciso — o fluxo verificou UM
// closer, o da vez na fila, e os outros nunca foram consultados. O backend já manda a frase
// certa ("O horário não está mais livre na agenda deste closer"); aqui a gente passa a usá-la.
export function showPoolFallbackModal(reservationData, message) {
  poolFallbackReservation = reservationData;
  var txt = document.getElementById('poolFallbackText');
  if (txt) txt.textContent = message || POOL_FALLBACK_DEFAULT;
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
    // Libera o horário antes de mandar ao Mercado. Sem isso o [TEMP] ficava órfão na
    // agenda do closer até a limpeza automática passar (até 2h), bloqueando um horário
    // que ninguém mais ia usar — e o slot cadastrado, apagado no /reserve, só voltava
    // pelo /cancel-reserve. Falha aqui não impede o envio: o essencial é o lead chegar
    // ao Mercado, e o horário cai sozinho na limpeza como caía antes.
    if (data.slotId && data.closerId) {
      try {
        await authFetch(API.cancelReserve, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            closerId:    data.closerId,
            slotId:      data.slotId,
            slotStart:   data.slotStart,
            slotEnd:     data.slotEnd,
            tempEventId: data.tempEventId
          })
        });
      } catch(e) {
        console.warn('[pool-fallback] não consegui liberar o horário:', e.message);
      }
    }
    const res = await authFetch(API.poolAdd, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId:      data.leadId,
        clientEmail: data.clientEmail,
        clientValue: data.clientValue,
        segmentKey:  data.segmentKey,
        subgroupKey: data.subgroupKey,
        slotStart:   data.slotStart || '',
        origin:      data.origin || '',
        sdrEmail:    session ? session.email : ''
      })
    });
    const raw = await res.json();
    const d = Array.isArray(raw) ? raw[0] : raw;
    if (d && d.error) throw new Error(d.error);

    // A reserva acabou de ser liberada e o lead está no Mercado: descarta o card, senão
    // ele continua na tela com o botão "Cliente confirmou" ativo e o SDR clica de novo —
    // foi o que gerou dois envios seguidos do mesmo lead em 21/09.
    if (st.activeReservation && st.activeReservation.slotId === data.slotId) {
      setActiveReservation(null);
      var card = document.getElementById('reservationState');
      if (card) card.style.display = 'none';
    }
    // A lista da aba "Aguardando confirmação" é montada por pending.js, que importa este
    // módulo — chamar por window evita o ciclo de import só para recarregar a lista.
    if (typeof window !== 'undefined' && typeof window.loadPendingView === 'function') {
      window.loadPendingView();
    }

    showToast('Lead enviado ao Mercado — horário liberado na agenda do closer', 'success', 5000);
  } catch(e) {
    showToast('Erro ao enviar ao Mercado: ' + e.message, 'error', 5000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar ao Mercado'; }
    closePoolFallbackModal();
  }
}
