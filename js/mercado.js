/* ══════════════════════════════════════════════
   mercado.js — Emergency Pool. Equivalente ao Fluxo 9 (pool).
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js';
import { session, st } from './state.js';
import { authFetch } from './auth.js';
import { showToast } from './ui.js';

import { fmtBRL, classify, getCloserPhoto, getMon } from './utils.js';

export async function loadMercado() {
  const grid = document.getElementById('mercadoGrid');
  var viewMode = document.getElementById('adminViewMode') && document.getElementById('adminViewMode').style.display !== 'none' ? document.querySelector('.admin-mode-select') : null;
  const role = ((viewMode && viewMode.value !== 'admin') ? viewMode.value : (session ? session.role : '')).toLowerCase();
  grid.innerHTML = '<div class="mercado-empty">Carregando...</div>';

  try {
    let leads = [];

    if (role === 'closer') {
      // Busca segment do closer no Redis
      const rClose = await authFetch(API.closerInfo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email })
      });
      const rCloseData = await rClose.json();
      const segment = rCloseData.segment || 'SMB';
      document.getElementById('mercadoSubtitle').textContent = 'Leads disponíveis para ' + segment;
      const r = await authFetch(API.poolList, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ segment }) });
      const txt = await r.text();
      const d = txt ? JSON.parse(txt) : {};
      leads = (d.leads || d[0] && d[0].leads) || [];
    } else {
      // SDR ou admin — filtra por sdrEmail ou mostra tudo
      const payload = { segment: 'ENT' };
      const r = await authFetch(API.poolList, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const txt = await r.text();
      const d = txt ? JSON.parse(txt) : {};
      leads = (d.leads || d[0] && d[0].leads) || [];
      if (role === 'sdr') leads = leads.filter(function(l){ return l.sdrEmail === session.email; });
      document.getElementById('mercadoSubtitle').textContent = (role === 'admin' || role === 'manager') ? 'Todos os leads no pool' : 'Seus leads no Emergency Pool';
    }

    if (leads.length === 0) {
      grid.innerHTML = '<div class="mercado-empty-state">' +
        '<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="28" cy="28" r="28" fill="rgba(255,92,0,0.06)"/>' +
        '<path d="M20 28h16M28 20v16" stroke="rgba(255,92,0,0.25)" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M18 22l2-2m16 16l2-2M18 34l2 2m16-16l2-2" stroke="rgba(255,92,0,0.15)" stroke-width="1.5" stroke-linecap="round"/>' +
        '<circle cx="28" cy="28" r="8" stroke="rgba(255,92,0,0.3)" stroke-width="1.5" stroke-dasharray="3 3"/>' +
        '</svg>' +
        '<div class="mercado-empty-title">Sem oportunidades no mercado</div>' +
        '<div class="mercado-empty-sub">Nenhum lead foi enviado ao Emergency Pool ainda.</div>' +
        '</div>';
      return;
    }

    grid.innerHTML = leads.map(function(lead) {
      const seg = (lead.subgroup || '').split('-')[0].toLowerCase();
      const badgeCls = 'mercado-badge mercado-badge-' + seg;
      const valor = lead.clientValue ? 'R$ ' + Number(lead.clientValue).toLocaleString('pt-BR') : '—';
      const slotLabel = lead.slotStart ? new Date(lead.slotStart).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', weekday:'short', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';

      var btns = '';
      if (role === 'closer') {
        btns = '<button class="btn-accept" onclick="acceptLead(\'' + lead.leadId + '\')">Aceitar</button>';
      } else {
        var seg0 = (lead.subgroup||'').split('-')[0];
        btns = '<button class="btn-remove-pool" onclick="removeLead(\'' + lead.leadId + '\',\'' + seg0 + '\')">Remover</button>';
      }

      return '<div class="mercado-card">' +
        '<div class="mercado-card-info">' +
          '<div class="mercado-card-title">Lead ' + lead.leadId + ' <span class="' + badgeCls + '">' + (lead.subgroup||'') + '</span></div>' +
          '<div class="mercado-card-meta"><span>' + valor + '</span><span>SDR: ' + (lead.sdrEmail||'').split('@')[0] + '</span></div>' +
          '<div class="mercado-card-slot">Horário desejado: ' + slotLabel + '</div>' +
        '</div>' +
        '<div class="mercado-card-btns">' + btns + '</div>' +
      '</div>';
    }).join('');

  } catch(e) {
    grid.innerHTML = '<div class="mercado-empty">Erro ao carregar: ' + e.message + '</div>';
  }
}

export async function acceptLead(leadId) {
  try {
    const r = await authFetch(API.poolAccept, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, closerId: session.email, closerName: session.name })
    });
    const d = await r.json();
    if (d.success) {
      showToast('Lead aceito! E-mail enviado ao SDR.', 'success', 4000);
      loadMercado();
    } else {
      showToast('Erro ao aceitar lead.', 'error', 4000);
    }
  } catch(e) {
    showToast('Erro: ' + e.message, 'error', 4000);
  }
}

export async function removeLead(leadId, segment) {
  try {
    const r = await authFetch(API.poolRemove, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, segment })
    });
    const d = await r.json();
    if (d.success) {
      showToast('Lead removido do pool.', 'success', 3000);
      loadMercado();
    } else {
      showToast('Erro ao remover lead.', 'error', 4000);
    }
  } catch(e) {
    showToast('Erro: ' + e.message, 'error', 4000);
  }
}

