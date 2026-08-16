/* ══════════════════════════════════════════════
   dashboard-activity.js — Aba Atividade no App.
   Log de logins (mais recente primeiro), agrupado visualmente por dia.
   ══════════════════════════════════════════════ */


import { API } from './api.js?v=20260816-1200';
import { authFetch } from './auth.js?v=20260816-1200';
import { showToast } from './ui.js?v=20260816-1200';

var lastLogins = [];

var ROLE_BADGES = {
  admin:   { label: 'Admin',   bg: 'rgba(255,72,0,0.12)',   color: 'var(--org)' },
  manager: { label: 'Manager', bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  sdr:     { label: 'SDR',     bg: 'rgba(61,219,168,0.12)', color: 'var(--green)' },
  closer:  { label: 'Closer',  bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' }
};

function roleBadge(role) {
  var r = ROLE_BADGES[role] || { label: role || '—', bg: 'rgba(255,255,255,0.06)', color: 'var(--txt-3)' };
  return '<span class="role-badge" style="background:' + r.bg + ';color:' + r.color + '">' + r.label + '</span>';
}

export async function loadActivity() {
  var body = document.getElementById('activityTableBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="4" class="table-empty"><div style="display:flex;align-items:center;justify-content:center;gap:8px"><div class="spinner"></div> Carregando...</div></td></tr>';

  try {
    const r = await authFetch(API.loginLog);
    const d = await r.json();
    const logins = d.logins || [];
    lastLogins = logins;

    var totalEl = document.getElementById('activityTotal');
    if (totalEl) totalEl.textContent = d.total != null ? d.total : logins.length;

    if (!logins.length) {
      body.innerHTML = '<tr><td colspan="4" class="table-empty">Nenhum login registrado.</td></tr>';
      return;
    }

    var lastDate = null;
    var rows = '';
    logins.forEach(function(l) {
      var dateLabel = l.dateLabel || '—';
      var commaIdx  = dateLabel.indexOf(',');
      var datePart  = commaIdx >= 0 ? dateLabel.slice(0, commaIdx).trim() : dateLabel;
      var timePart  = commaIdx >= 0 ? dateLabel.slice(commaIdx + 1).trim() : dateLabel;

      if (datePart !== lastDate) {
        rows += '<tr class="activity-date-sep"><td colspan="4">' + datePart + '</td></tr>';
        lastDate = datePart;
      }

      rows += '<tr>' +
        '<td><strong style="font-family:\'Space Grotesk\',sans-serif;font-size:12px">' + (l.name || '—') + '</strong></td>' +
        '<td style="font-size:12px;color:var(--txt-2)">' + (l.email || '—') + '</td>' +
        '<td>' + roleBadge(l.role) + '</td>' +
        '<td style="font-size:12px;color:var(--txt-3);white-space:nowrap">' + (timePart || '—') + '</td>' +
        '</tr>';
    });
    body.innerHTML = rows;
  } catch(e) {
    body.innerHTML = '<tr><td colspan="4" class="table-empty">Erro: ' + e.message + '</td></tr>';
  }
}

function csvField(v) {
  var s = v === undefined || v === null ? '' : String(v);
  if (/[";\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function exportActivity() {
  if (!lastLogins.length) { showToast('Nenhum registro para exportar.', 'error'); return; }
  var header = ['Nome', 'E-mail', 'Role', 'Data/Hora'];
  var rows = lastLogins.map(function(l) {
    return [l.name || '—', l.email || '—', l.role || '—', l.dateLabel || '—'];
  });
  var lines = [header].concat(rows).map(function(r) { return r.map(csvField).join(';'); });
  var csv = '﻿' + lines.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'atividade-app-' + stamp + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
