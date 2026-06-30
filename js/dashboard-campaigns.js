/* ══════════════════════════════════════════════
   dashboard-campaigns.js — Aba Campanhas. Equivalente ao Fluxo 14 (campaigns).
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js';
import { authFetch } from './auth.js';
import { showToast } from './ui.js';

import { session, st } from './state.js';
import { fmtBRL, classify, getCloserPhoto, getMon } from './utils.js';

export async function loadCampaigns() {
  var grid = document.getElementById('campaignsGrid');
  grid.innerHTML = '<div style="color:var(--txt-3);padding:16px;">Carregando...</div>';
  try {
    const [rCamp, rDash] = await Promise.all([
      authFetch(API.campaignsGet),
      authFetch(API.dashboard + '?period=all')
    ]);
    const campData = await rCamp.json();
    const dashData = await rDash.json();
    const campaigns = campData.campaigns || [];
    const closers   = dashData.closers   || [];
    renderCampaignsGrid(campaigns, closers);
  } catch(e) {
    grid.innerHTML = '<div style="color:var(--red);padding:16px;">Erro: ' + e.message + '</div>';
  }
}

function renderCampaignsGrid(campaigns, closers) {
  closers = closers || [];
  var grid = document.getElementById('campaignsGrid');

  var active    = campaigns.filter(function(c){ return c.active; });
  var available = campaigns.filter(function(c){ return !c.active; });

  var html = '';

  // Botão + Adicionar campanha
  html += '<div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;">';
  html += '<select id="campAddSelect" class="cap-select" style="min-width:200px;">';
  html += '<option value="">Selecionar concorrente...</option>';
  available.forEach(function(c) {
    html += '<option value="' + c.name + '">' + c.name + '</option>';
  });
  html += '</select>';
  html += '<button class="btn btn-primary" onclick="addCampaign()" style="font-size:13px;padding:8px 16px;">+ Adicionar campanha</button>';
  html += '</div>';

  if (active.length === 0) {
    html += '<div style="color:var(--txt-3);font-size:13px;padding:16px 0;">Nenhuma campanha ativa. Adicione um concorrente acima.</div>';
  }

  active.forEach(function(camp) {
    var safeId  = 'camp_tog_' + camp.name.replace(/[^a-zA-Z0-9]/g, '_');
    var compKey = camp.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Filtra closers que têm opps nessa campanha
    var campClosers = closers.filter(function(c) {
      return (c.campaign_total || 0) > 0 &&
        Object.keys(c.camp_subgroups || {}).some(function(sub) {
          return (c.camp_subgroups[sub] || 0) > 0;
        });
    });

    html += '<div style="background:var(--bg-card);border:1px solid var(--bd-strong);border-radius:var(--r);padding:16px 20px;margin-bottom:12px;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
    html += '<div style="font-family:Space Grotesk,sans-serif;font-size:15px;font-weight:700;color:var(--txt-1);">' + camp.name + '</div>';
    html += '<label class="seg-toggle">';
    html += '<div class="seg-toggle-track on" id="' + safeId + '" onclick="toggleCampaign(\`' + camp.name + '\`,\`' + safeId + '\`)">';
    html += '<div class="seg-toggle-thumb"></div>';
    html += '</div>';
    html += '<span class="seg-toggle-label">Ativa</span>';
    html += '</label>';
    html += '</div>';

    // Tabela de distribuição
    if (campClosers.length > 0) {
      html += '<div style="background:var(--bg-raised);border:1px solid var(--bd-default);border-radius:var(--r-sm);overflow:hidden;">';
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
      html += '<thead><tr>';
      html += '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--txt-3);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--bd-default);">Closer</th>';
      html += '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--txt-3);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--bd-default);">Segmento</th>';
      html += '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--bd-default);">Total</th>';
      // Subgrupos únicos com opps na campanha
      var allSubs = ['SMB-1','SMB-2','SMB-3','MID-1','MID-2','MID-3','ENT-1','ENT-2','ENT-3'];
      var activeSubs = allSubs.filter(function(sub) {
        return campClosers.some(function(c){ return (c.camp_subgroups||{})[sub] > 0; });
      });
      activeSubs.forEach(function(sub) {
        html += '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--txt-3);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--bd-default);">' + sub + '</th>';
      });
      html += '</tr></thead><tbody>';
      campClosers.forEach(function(c, idx) {
        var borderB = idx < campClosers.length - 1 ? '1px solid var(--bd-subtle)' : 'none';
        html += '<tr style="border-bottom:' + borderB + '">';
        html += '<td style="padding:8px 12px;color:var(--txt-1);font-weight:500;">' + c.name + '</td>';
        html += '<td style="padding:8px 12px;color:var(--txt-3);">' + c.segment + '</td>';
        html += '<td style="padding:8px 12px;text-align:center;color:var(--blue);font-weight:700;">' + (c.campaign_total||0) + '</td>';
        activeSubs.forEach(function(sub) {
          var v = (c.camp_subgroups||{})[sub] || 0;
          html += '<td style="padding:8px 12px;text-align:center;color:' + (v > 0 ? 'var(--blue)' : 'var(--txt-3)') + ';font-weight:' + (v > 0 ? '700' : '400') + ';">' + v + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div style="font-size:12px;color:var(--txt-3);padding:8px 0;">Nenhuma opp atribuída via campanha ainda.</div>';
    }

    html += '</div>';
  });

  grid.innerHTML = html;
}

export async function addCampaign() {
  var sel = document.getElementById('campAddSelect');
  var name = sel ? sel.value : '';
  if (!name) { showToast('Selecione um concorrente.', 'info'); return; }
  try {
    const r = await authFetch(API.campaignsSet, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, active: true })
    });
    const d = await r.json();
    if (d.success) {
      showToast('Campanha ' + name + ' adicionada.', 'success');
      loadCampaigns();
    } else {
      showToast('Erro ao adicionar campanha.', 'error');
    }
  } catch(e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

export async function toggleCampaign(name, trackId) {
  var track = document.getElementById(trackId);
  if (!track) return;
  var isOn  = track.classList.contains('on');
  var label = track.parentElement.nextElementSibling;
  track.classList.add('loading');
  try {
    const r = await authFetch(API.campaignsSet, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, active: !isOn })
    });
    const d = await r.json();
    if (d.success) {
      if (!isOn) {
        track.classList.remove('off'); track.classList.add('on');
        if (label) label.textContent = 'Ativa';
        showToast('Campanha ' + name + ' ativada.', 'success');
      } else {
        track.classList.remove('on'); track.classList.add('off');
        if (label) label.textContent = 'Inativa';
        showToast('Campanha ' + name + ' desativada.', 'info');
      }
    } else {
      showToast('Erro ao atualizar campanha.', 'error');
    }
  } catch(e) {
    showToast('Erro: ' + e.message, 'error');
  }
  track.classList.remove('loading');
}

