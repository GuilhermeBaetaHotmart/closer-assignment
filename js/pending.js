/* ══════════════════════════════════════════════
   pending.js — Aba "Aguardando confirmação".
   Reserva ativa da sessão (se houver) + lista completa das
   reservas pendentes do SDR logado, vindas da API.
   ══════════════════════════════════════════════ */


import { API } from './api.js?v=20260819-0930';
import { session, st } from './state.js?v=20260819-0930';
import { authFetch } from './auth.js?v=20260819-0930';
import { showToast, showPoolFallbackModal } from './ui.js?v=20260819-0930';

// Cache dos itens renderizados, indexado por slotId — permite passar o objeto
// completo pro onclick="confirmReserveById(...)" sem precisar re-fetch nem
// serializar o objeto inteiro numa string de atributo HTML.
window.__pendingItemsCache = window.__pendingItemsCache || {};

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

  window.__pendingItemsCache = {};
  items.forEach(function(res){ window.__pendingItemsCache[res.slotId] = res; });

  if (!items.length) {
    list.innerHTML = '<div class="pending-empty">Nenhuma reserva pendente no momento.</div>';
    return;
  }

  list.innerHTML = items.map(function(res){
    var urgent = res.remainingMs != null && res.remainingMs < 30 * 60 * 1000;
    return '<div class="pending-item" id="pendingView_'+res.slotId+'">' +
      '<div class="pending-item-main">' +
        '<span class="pending-lead-id">'+(res.leadId||'—')+'</span>' +
        '<span class="pending-slot">'+(res.slotLabel||'—')+'</span>' +
        '<span class="pending-subgroup">'+(res.subgroupKey||'—')+'</span>' +
        '<span class="pending-email">'+(res.clientEmail||'—')+'</span>' +
        '<span class="pending-remaining'+(urgent?' urgent':'')+'">'+(res.remainingLabel||'—')+'</span>' +
      '</div>' +
      '<div class="pending-item-actions">' +
        '<button type="button" class="pending-confirm-btn" onclick="confirmReserveById(window.__pendingItemsCache[\''+res.slotId+'\'])">Confirmar</button>' +
        '<button type="button" class="btn btn-ghost pending-cancel-btn" onclick="doCancelReserveById(\''+res.slotId+'\',\''+res.sdrEmail+'\')">Cancelar</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// Remove o item do DOM e cache; se a lista ficar vazia e não houver reserva ativa
// na sessão (que teria seu próprio card acima), mostra o estado vazio.
function removePendingItem(slotId) {
  var item = document.getElementById('pendingView_' + slotId);
  if (item) item.remove();
  delete window.__pendingItemsCache[slotId];

  var list = document.getElementById('pendingViewList');
  if (list && !list.children.length && !st.activeReservation) {
    list.innerHTML = '<div class="pending-empty">Nenhuma reserva pendente no momento.</div>';
  }
}

export async function confirmReserveById(reservation) {
  if (!reservation) return;
  try {
    const res = await authFetch(API.confirm, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId:      reservation.slotId,
        leadId:      reservation.leadId,
        clientEmail: reservation.clientEmail,
        clientValue: reservation.clientValue,
        segmentKey:  reservation.segmentKey,
        subgroupKey: reservation.subgroupKey,
        sdrEmail:    reservation.sdrEmail,
        ts:          new Date().toISOString()
      })
    });
    const raw = await res.json();
    const data = Array.isArray(raw) ? raw[0] : raw;
    if (data.sendToPool) {
      showPoolFallbackModal(reservation);
      return;
    }
    if (data.error) throw new Error(data.error);

    var closerName = data.closerName || '****';
    showToast('Reunião confirmada com ' + closerName + ' — não esqueça de converter a opp no Salesforce.', 'success', 7000);
    removePendingItem(reservation.slotId);
  } catch(e) {
    showToast('Erro ao confirmar: ' + e.message, 'error', 5000);
  }
}
