/* ══════════════════════════════════════════════
   pending.js — Aba "Aguardando confirmação".
   Lista completa das reservas pendentes do SDR logado.
   ══════════════════════════════════════════════ */


import { API } from './api.js?v=20260702-1332';
import { session } from './state.js?v=20260702-1332';
import { authFetch } from './auth.js?v=20260702-1332';

export async function loadPendingView() {
  var view = document.getElementById('pendingView');
  if (!view) return;

  view.innerHTML =
    '<div style="max-width:680px;margin:0 auto;padding:16px 12px;">' +
      '<div class="pending-view-header">' +
        '<div>' +
          '<div class="pending-view-title">Aguardando confirmação</div>' +
          '<div class="pending-view-subtitle">Suas reservas ainda não confirmadas pelo cliente</div>' +
        '</div>' +
        '<button class="btn btn-ghost" onclick="loadPendingView()" style="font-size:13px;">↻ Atualizar</button>' +
      '</div>' +
      '<div id="pendingViewList" class="pending-list">' +
        '<div class="pending-empty"><div class="spinner"></div> Carregando...</div>' +
      '</div>' +
    '</div>';

  try {
    const r = await authFetch(API.reservationsList);
    const raw = await r.json();
    const all = Array.isArray(raw) ? raw : (raw.reservations || []);
    const email = session ? session.email : null;
    const mine = all.filter(function(res){ return res.sdrEmail === email; });
    renderPendingView(mine);
  } catch(e) {
    var list = document.getElementById('pendingViewList');
    if (list) list.innerHTML = '<div class="pending-empty">Erro ao carregar: ' + e.message + '</div>';
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
