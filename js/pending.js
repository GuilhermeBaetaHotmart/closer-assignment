/* ══════════════════════════════════════════════
   pending.js — Aba "Aguardando confirmação".
   Reserva ativa da sessão (se houver) + lista completa das
   reservas pendentes do SDR logado, vindas da API.
   ══════════════════════════════════════════════ */


import { API } from './api.js?v=20260702-1332';
import { session, st } from './state.js?v=20260702-1332';
import { authFetch } from './auth.js?v=20260702-1332';

export async function loadPendingView() {
  // O card #reservationState e o header já são estáticos em index.html — aqui só
  // alternamos a visibilidade dele (reflete st.activeReservation) e recarregamos a lista.
  var reservationEl = document.getElementById('reservationState');
  if (reservationEl) reservationEl.style.display = st.activeReservation ? 'block' : 'none';

  var list = document.getElementById('pendingViewList');
  if (!list) return;
  list.innerHTML = '<div class="pending-empty"><div class="spinner"></div> Carregando...</div>';

  try {
    const r = await authFetch(API.reservationsList);
    const raw = await r.json();
    const all = Array.isArray(raw) ? raw : (raw.reservations || []);
    const email = session ? session.email : null;
    // A reserva ativa da sessão já aparece destacada em #reservationState — evita duplicar na lista.
    const activeSlotId = st.activeReservation ? st.activeReservation.slotId : null;
    const mine = all.filter(function(res){ return res.sdrEmail === email && res.slotId !== activeSlotId; });
    renderPendingView(mine);
  } catch(e) {
    list.innerHTML = '<div class="pending-empty">Erro ao carregar: ' + e.message + '</div>';
  }
}

function renderPendingView(items) {
  var list = document.getElementById('pendingViewList');
  if (!list) return;

  if (!items.length) {
    list.innerHTML = '<div class="pending-empty">Nenhuma reserva pendente no momento.</div>';
    return;
  }

  list.innerHTML = items.map(function(res){
    var urgent = res.remainingMs != null && res.remainingMs < 3 * 60 * 60 * 1000;
    return '<div class="pending-item" id="pendingView_'+res.slotId+'">' +
      '<div class="pending-item-main">' +
        '<span class="pending-lead-id">'+(res.leadId||'—')+'</span>' +
        '<span class="pending-slot">'+(res.slotLabel||'—')+'</span>' +
        '<span class="pending-subgroup">'+(res.subgroupKey||'—')+'</span>' +
        '<span class="pending-email">'+(res.clientEmail||'—')+'</span>' +
        '<span class="pending-remaining'+(urgent?' urgent':'')+'">'+(res.remainingLabel||'—')+'</span>' +
      '</div>' +
      '<button type="button" class="btn btn-ghost pending-cancel-btn" onclick="doCancelReserveById(\''+res.slotId+'\',\''+res.sdrEmail+'\')">Cancelar</button>' +
    '</div>';
  }).join('');
}
