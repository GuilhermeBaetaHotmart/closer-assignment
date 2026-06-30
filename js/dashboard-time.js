/* ══════════════════════════════════════════════
   dashboard-time.js — Aba Tempo de Reunião. Equivalente ao Fluxo 16 (time-config).
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js';
import { classify, fmtBRL, getCloserPhoto, getMon } from './utils.js';
import { authFetch } from './auth.js';
import { showToast } from './ui.js';

import { session, st } from './state.js';

let timeConfigCache = null;

export async function loadTimeConfig() {
  var grid = document.getElementById('timeDefaultsGrid');
  var sections = document.getElementById('timeClosersSections');
  grid.innerHTML = '<div style="color:var(--txt-3);padding:16px;grid-column:1/-1;">Carregando...</div>';
  sections.innerHTML = '<div style="color:var(--txt-3);padding:16px;">Carregando...</div>';

  try {
    const r = await authFetch(API.timeConfigGet);
    const d = await r.json();
    timeConfigCache = d;
    renderTimeDefaults(d.defaults || {});
    renderTimeClosers(d.closers || []);
  } catch(e) {
    grid.innerHTML = '<div style="color:var(--red);padding:16px;grid-column:1/-1;">Erro: ' + e.message + '</div>';
    sections.innerHTML = '<div style="color:var(--red);padding:16px;">Erro: ' + e.message + '</div>';
  }
}

function renderTimeDefaults(defaults) {
  var grid = document.getElementById('timeDefaultsGrid');
  var segLabels = { SMB: 'N2-N3', MID: 'N4-N5', ENT: 'N6+' };
  var segColors = { SMB: 'var(--yellow)', MID: 'var(--blue)', ENT: 'var(--lilac)' };

  grid.innerHTML = Object.keys(segLabels).map(function(seg) {
    var cfg = defaults[seg] || { prep_time: 30, meeting_time: 60 };
    return '<div style="background:var(--bg-card);border:1px solid var(--bd-subtle);border-radius:var(--r);padding:18px;">' +
      '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:13px;font-weight:700;color:' + segColors[seg] + ';margin-bottom:14px;">' + segLabels[seg] + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;">' +
        '<label style="font-size:11px;color:var(--txt-3);">Preparação (min)' +
          '<input type="number" id="timeDefaultPrep_' + seg + '" value="' + cfg.prep_time + '" class="field-input" style="margin-top:4px;padding:8px 10px;font-size:13px;">' +
        '</label>' +
        '<label style="font-size:11px;color:var(--txt-3);">Reunião (min)' +
          '<input type="number" id="timeDefaultMeeting_' + seg + '" value="' + cfg.meeting_time + '" class="field-input" style="margin-top:4px;padding:8px 10px;font-size:13px;">' +
        '</label>' +
        '<button class="btn btn-primary" onclick="saveSegmentDefault(\'' + seg + '\')" style="font-size:12px;padding:8px;justify-content:center;margin-top:4px;">Salvar</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderTimeClosers(closers) {
  var sections = document.getElementById('timeClosersSections');
  var segOrder = ['SMB', 'MID', 'ENT'];
  var segLabels = { SMB: 'N2-N3', MID: 'N4-N5', ENT: 'N6+' };
  var segColors = { SMB: 'var(--yellow)', MID: 'var(--blue)', ENT: 'var(--lilac)' };

  sections.innerHTML = segOrder.map(function(seg) {
    var segClosers = closers.filter(function(c) { return c.segment === seg; });

    var rowsHtml;
    if (!segClosers.length) {
      rowsHtml = '<tr><td colspan="5" class="table-empty">Nenhum closer cadastrado neste segmento.</td></tr>';
    } else {
      rowsHtml = segClosers.map(function(c) {
        var safeId = c.email.replace(/[^a-zA-Z0-9]/g, '_');
        var overrideBadge = c.has_override
          ? '<span style="font-size:10px;font-weight:600;color:var(--org);background:var(--org-tint);padding:2px 8px;border-radius:99px;">Override</span>'
          : '<span style="font-size:10px;color:var(--txt-3);">Default</span>';
        return '<tr>' +
          '<td><span class="closer-cell-name">' + c.name + '</span><span class="closer-cell-email">' + c.email + '</span></td>' +
          '<td class="center" id="timeView_prep_' + safeId + '">' + c.effective_prep_time + '</td>' +
          '<td class="center" id="timeView_meeting_' + safeId + '">' + c.effective_meeting_time + '</td>' +
          '<td class="center">' + (c.effective_prep_time + c.effective_meeting_time) + ' min ' + overrideBadge + '</td>' +
          '<td class="center"><button class="btn-remove-pool" style="padding:5px 12px;font-size:12px;" onclick="editCloserOverride(\'' + c.email + '\',\'' + safeId + '\',' + c.effective_prep_time + ',' + c.effective_meeting_time + ')">Editar</button></td>' +
          '</tr>';
      }).join('');
    }

    return '<div class="dash-section">' +
      '<div class="dash-section-header">' +
        '<div>' +
          '<div class="dash-section-title" style="display:flex;align-items:center;gap:8px">' +
            '<span style="width:10px;height:10px;border-radius:2px;background:' + segColors[seg] + ';display:inline-block;flex-shrink:0"></span>' +
            segLabels[seg] +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="table-wrap">' +
        '<table class="data-table">' +
          '<thead><tr>' +
            '<th>Closer</th>' +
            '<th class="center">Prep (min)</th>' +
            '<th class="center">Reunião (min)</th>' +
            '<th class="center">Total</th>' +
            '<th class="center">Ação</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }).join('');
}

export function editCloserOverride(email, safeId, currentPrep, currentMeeting) {
  var prepCell = document.getElementById('timeView_prep_' + safeId);
  var meetingCell = document.getElementById('timeView_meeting_' + safeId);
  prepCell.innerHTML = '<input type="number" id="timeEdit_prep_' + safeId + '" value="' + currentPrep + '" style="width:60px;text-align:center;background:var(--bg-raised);border:1px solid var(--bd-default);border-radius:6px;color:var(--txt-1);padding:4px;">';
  meetingCell.innerHTML = '<input type="number" id="timeEdit_meeting_' + safeId + '" value="' + currentMeeting + '" style="width:60px;text-align:center;background:var(--bg-raised);border:1px solid var(--bd-default);border-radius:6px;color:var(--txt-1);padding:4px;">';

  var actionCell = prepCell.parentElement.lastElementChild;
  actionCell.innerHTML = '<button class="btn-accept" style="padding:5px 12px;font-size:12px;" onclick="saveCloserOverride(\'' + email + '\',\'' + safeId + '\')">Salvar</button> ' +
    '<button class="btn-remove-pool" style="padding:5px 10px;font-size:12px;" onclick="clearCloserOverride(\'' + email + '\')">Limpar</button>';
}

export async function saveCloserOverride(email, safeId) {
  var prep = document.getElementById('timeEdit_prep_' + safeId).value;
  var meeting = document.getElementById('timeEdit_meeting_' + safeId).value;
  try {
    const r = await authFetch(API.timeConfigSet, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'closer', email: email, prep_time: prep, meeting_time: meeting })
    });
    const d = await r.json();
    if (d.success) {
      showToast('Tempo atualizado para ' + email.split('@')[0] + '.', 'success');
      loadTimeConfig();
    } else {
      showToast('Erro ao salvar.', 'error');
    }
  } catch(e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

export async function clearCloserOverride(email) {
  try {
    const r = await authFetch(API.timeConfigSet, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'closer', email: email, prep_time: '', meeting_time: '' })
    });
    const d = await r.json();
    if (d.success) {
      showToast('Override removido — voltou ao default do segmento.', 'info');
      loadTimeConfig();
    } else {
      showToast('Erro ao remover override.', 'error');
    }
  } catch(e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

export async function saveSegmentDefault(seg) {
  var prep = document.getElementById('timeDefaultPrep_' + seg).value;
  var meeting = document.getElementById('timeDefaultMeeting_' + seg).value;
  try {
    const r = await authFetch(API.timeConfigSet, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'segment', segment: seg, prep_time: prep, meeting_time: meeting })
    });
    const d = await r.json();
    if (d.success) {
      showToast('Default de ' + seg + ' atualizado.', 'success');
      loadTimeConfig();
    } else {
      showToast('Erro ao salvar default.', 'error');
    }
  } catch(e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

