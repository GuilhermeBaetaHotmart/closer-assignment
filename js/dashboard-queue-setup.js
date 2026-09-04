/* ══════════════════════════════════════════════
   dashboard-queue-setup.js — Aba Setup de Fila.
   Elegibilidade por closer, fila (subgrupo) e origem (Inbound/Outbound).
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js?v=20260904-1900';
import { authFetch } from './auth.js?v=20260904-1900';
import { showToast } from './ui.js?v=20260904-1900';
import { session } from './state.js?v=20260904-1900';

export async function loadQueueSetup() {
  var sections = document.getElementById('queueSetupSections');
  sections.innerHTML = '<div style="color:var(--txt-3);padding:16px;">Carregando...</div>';

  try {
    const r = await authFetch(API.eligibilityGet);
    const d = await r.json();
    renderQueueSetup(d.closers || []);
  } catch(e) {
    sections.innerHTML = '<div style="color:var(--red);padding:16px;">Erro: ' + e.message + '</div>';
  }
}

function renderQueueSetup(closers) {
  var sections = document.getElementById('queueSetupSections');
  var segOrder = ['SMB', 'MID', 'ENT'];
  var segLabels = { SMB: 'N2-N3', MID: 'N4-N5', ENT: 'N6+' };
  var segColors = { SMB: 'var(--yellow)', MID: 'var(--blue)', ENT: 'var(--lilac)' };

  sections.innerHTML = segOrder.map(function(seg) {
    var segClosers = closers.filter(function(c) { return c.segment === seg; });
    var queues = SEGS[seg].sub;
    var totalCols = 1 + queues.length * 2;

    var rowsHtml;
    if (!segClosers.length) {
      rowsHtml = '<tr><td colspan="' + totalCols + '" class="table-empty">Nenhum closer cadastrado neste segmento.</td></tr>';
    } else {
      rowsHtml = segClosers.map(function(c) {
        var safeEmail = c.email.replace(/[^a-zA-Z0-9]/g, '_');
        var cells = queues.map(function(q) {
          var m = (c.matrix || {})[q.key] || { inbound: false, outbound: false };
          return ['outbound', 'inbound'].map(function(origin) {
            var isOn = !!m[origin];
            var trackId = 'elig_' + safeEmail + '_' + q.key.replace(/[^a-zA-Z0-9]/g, '_') + '_' + origin;
            return '<td class="center">' +
              '<div class="seg-toggle-track ' + (isOn ? 'on' : 'off') + '" id="' + trackId + '" ' +
                'onclick="toggleEligibility(\'' + c.email + '\',\'' + q.key + '\',\'' + origin + '\',\'' + trackId + '\')" ' +
                'title="' + q.label + ' — ' + (origin === 'inbound' ? 'Inbound' : 'Outbound') + '" ' +
                'style="display:inline-block;cursor:pointer;">' +
                '<div class="seg-toggle-thumb"></div>' +
              '</div>' +
            '</td>';
          }).join('');
        }).join('');
        return '<tr>' +
          '<td><span class="closer-cell-name">' + (c.name || c.email) + '</span><span class="closer-cell-email">' + c.email + '</span></td>' +
          cells +
          '</tr>';
      }).join('');
    }

    var headerGroups = queues.map(function(q, i) {
      return '<th class="center" colspan="2">Fila ' + (i + 1) + '<br><span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;color:var(--txt-3)">' + q.label + '</span></th>';
    }).join('');
    var headerSub = queues.map(function() {
      return '<th class="center" style="font-size:10px;">Out</th><th class="center" style="font-size:10px;">In</th>';
    }).join('');

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
          '<thead>' +
            '<tr><th rowspan="2">Closer</th>' + headerGroups + '</tr>' +
            '<tr>' + headerSub + '</tr>' +
          '</thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }).join('');
}

export async function toggleEligibility(email, queueKey, origin, trackId) {
  var track = document.getElementById(trackId);
  if (!track) return;
  var isOn = track.classList.contains('on');
  track.classList.add('loading');
  try {
    const r = await authFetch(API.eligibilitySet, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, queue: queueKey, origin: origin, active: !isOn, updatedBy: session ? session.email : '' })
    });
    const d = await r.json();
    if (d.success) {
      track.classList.remove(isOn ? 'on' : 'off');
      track.classList.add(isOn ? 'off' : 'on');
      var originLabel = origin === 'inbound' ? 'Inbound' : 'Outbound';
      showToast((isOn ? 'Desativado' : 'Ativado') + ': ' + queueKey + ' — ' + originLabel, isOn ? 'info' : 'success');
    } else {
      showToast('Erro ao atualizar elegibilidade.', 'error');
    }
  } catch(e) {
    showToast('Erro: ' + e.message, 'error');
  }
  track.classList.remove('loading');
}
