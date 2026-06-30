/* ══════════════════════════════════════════════
   dashboard-escalation.js — Aba Regras de Escalação. Equivalente ao Fluxo 17 (escalation-config).
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js';
import { classify, fmtBRL, getCloserPhoto, getMon } from './utils.js';
import { authFetch } from './auth.js';
import { showToast } from './ui.js';

import { session, st } from './state.js';

const MAX_RANGE_VAL = 50000000;

export async function loadEscalationConfig() {
  var gantt = document.getElementById('escalationGantt');
  if (gantt) gantt.innerHTML = '<div style="font-size:11px;color:var(--txt-3);">Carregando...</div>';
  try {
    const r = await authFetch(API.escalationConfigGet);
    const d = await r.json();
    renderEscalationLeaders(d.leaders || []);
  } catch(e) {
    if (gantt) gantt.innerHTML = '<div style="font-size:12px;color:var(--red);">Erro: ' + e.message + '</div>';
  }
}

function renderEscalationLeaders(leaders) {
  var gantt = document.getElementById('escalationGantt');
  if (!gantt) return;
  if (!leaders.length) {
    gantt.innerHTML = '<div style="font-size:12px;color:var(--txt-3);">Nenhum líder cadastrado.</div>';
    return;
  }

  // ── Tabela de líderes ──────────────────────────
  var tableHtml = '<div class="table-wrap" style="margin-bottom:20px;"><table class="data-table"><thead><tr>' +
    '<th>Líder</th><th class="center">Mínimo</th><th class="center">Máximo</th><th class="center">Ação</th>' +
    '</tr></thead><tbody>' +
    leaders.map(function(l, idx) {
      var safeId = 'esc_' + idx;
      var maxLabel = l.max >= MAX_RANGE_VAL ? fmtBRL(l.max) + ' (sem limite)' : fmtBRL(l.max);
      return '<tr id="escRow_' + safeId + '">' +
        '<td><span class="closer-cell-name">' + l.name + '</span><span class="closer-cell-email">' + l.email + '</span></td>' +
        '<td class="center" id="escMin_' + safeId + '">' + fmtBRL(l.min) + '</td>' +
        '<td class="center" id="escMax_' + safeId + '">' + maxLabel + '</td>' +
        '<td class="center" id="escAct_' + safeId + '">' +
          '<button class="btn-remove-pool" style="padding:5px 12px;font-size:12px;" onclick="editEscalationLeader(' + idx + ',\'' + l.email + '\',' + l.min + ',' + l.max + ')">Editar</button> ' +
          '<button class="btn-remove-pool" style="padding:5px 10px;font-size:12px;" onclick="removeEscalationLeader(\'' + l.email + '\')">Remover</button>' +
        '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table></div>';

  // ── Gantt de sobreposição ──────────────────────
  var ticks = [0, 10, 20, 30, 40, 50];
  var SCALE = 50;
  function pM(v) { return Math.min(v / 1000000, SCALE); }
  function fmtM(v) { return v >= MAX_RANGE_VAL ? '50M+' : Math.round(v/1000000) + 'M'; }

  var ticksHtml = '<div style="position:relative;height:18px;margin-bottom:6px;padding-left:80px;">';
  ticks.forEach(function(t) {
    ticksHtml += '<span style="position:absolute;left:' + (t/SCALE*100) + '%;transform:translateX(-50%);font-size:10px;color:var(--txt-3);">' + (t===50?'50M+':t+'M') + '</span>';
  });
  ticksHtml += '</div>';

  var barsHtml = leaders.map(function(l, idx) {
    var pMin = pM(l.min), pMax = pM(l.max);
    var segs = [];
    leaders.forEach(function(other, j) {
      if (j === idx) return;
      var sMin = Math.max(pMin, pM(other.min)), sMax = Math.min(pMax, pM(other.max));
      if (sMin < sMax) segs.push({sMin: sMin, sMax: sMax});
    });
    var ovHtml = segs.map(function(s) {
      var left = ((s.sMin - pMin) / (pMax - pMin)) * 100;
      var w = ((s.sMax - s.sMin) / (pMax - pMin)) * 100;
      return '<div style="position:absolute;top:0;bottom:0;left:' + left + '%;width:' + w + '%;background:var(--org);border-radius:3px;pointer-events:none;"></div>';
    }).join('');

    return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
      '<div style="width:72px;flex-shrink:0;font-size:12px;font-weight:600;color:var(--txt-1);">' + l.name + '</div>' +
      '<div style="flex:1;position:relative;height:14px;">' +
        ticks.map(function(t) { return '<div style="position:absolute;top:0;bottom:0;left:' + (t/SCALE*100) + '%;width:0.5px;background:var(--bd-subtle);"></div>'; }).join('') +
        '<div style="position:absolute;top:0;left:' + (pMin/SCALE*100) + '%;width:' + ((pMax-pMin)/SCALE*100) + '%;height:100%;background:var(--txt-3);border-radius:3px;opacity:0.5;overflow:hidden;">' + ovHtml + '</div>' +
      '</div>' +
      '<div style="width:80px;flex-shrink:0;font-size:10px;color:var(--txt-3);text-align:right;">' + fmtM(l.min) + ' – ' + fmtM(l.max) + '</div>' +
    '</div>';
  }).join('');

  var ganttHtml = '<div style="background:var(--bg-raised);border:1px solid var(--bd-subtle);border-radius:var(--r);padding:16px;">' +
    '<div style="font-size:12px;font-weight:600;color:var(--txt-1);margin-bottom:10px;">Mapa de sobreposição</div>' +
    '<div style="font-size:11px;color:var(--txt-3);margin-bottom:12px;">Trechos em <span style="color:var(--org);font-weight:600;">laranja</span> indicam acionamento simultâneo de dois ou mais líderes.</div>' +
    ticksHtml + barsHtml +
  '</div>';

  gantt.innerHTML = tableHtml + ganttHtml;
}

export function editEscalationLeader(idx, email, currentMin, currentMax) {
  var safeId = 'esc_' + idx;
  var minCell = document.getElementById('escMin_' + safeId);
  var maxCell = document.getElementById('escMax_' + safeId);
  var actCell = document.getElementById('escAct_' + safeId);
  if (!minCell) return;
  var minM = Math.round(currentMin / 1000000);
  var maxM = currentMax >= 100000000 ? 50 : Math.round(currentMax / 1000000);
  minCell.innerHTML = '<input type="number" min="0" max="50" id="escEditMin_' + safeId + '" value="' + minM + '" style="width:80px;text-align:center;background:var(--bg-raised);border:1px solid var(--bd-default);border-radius:6px;color:var(--txt-1);padding:4px;font-size:12px;"> M';
  maxCell.innerHTML = '<input type="number" min="0" max="50" id="escEditMax_' + safeId + '" value="' + maxM + '" style="width:80px;text-align:center;background:var(--bg-raised);border:1px solid var(--bd-default);border-radius:6px;color:var(--txt-1);padding:4px;font-size:12px;"> M <span style="font-size:10px;color:var(--txt-3);">(50 = sem limite)</span>';
  actCell.innerHTML = '<button class="btn-accept" style="padding:5px 12px;font-size:12px;" onclick="saveEscalationLeader(\'' + email + '\',\'' + safeId + '\')">Salvar</button>';
}

export async function saveEscalationLeader(email, safeId) {
  var minM = parseInt(document.getElementById('escEditMin_' + safeId).value);
  var maxM = parseInt(document.getElementById('escEditMax_' + safeId).value);
  if (isNaN(minM) || isNaN(maxM)) { showToast('Valores inválidos.', 'error'); return; }
  var min = minM * 1000000;
  var max = maxM >= 50 ? 100000000 : maxM * 1000000;
  try {
    const r = await authFetch(API.escalationConfigSet, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: email, min: min, max: max })
    });
    const d = await r.json();
    if (d.success) { showToast('Regra atualizada.', 'success'); loadEscalationConfig(); }
    else showToast('Erro ao salvar.', 'error');
  } catch(e) { showToast('Erro: ' + e.message, 'error'); }
}

export async function removeEscalationLeader(email) {
  try {
    const r = await authFetch(API.escalationConfigSet, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: email, remove: true })
    });
    const d = await r.json();
    if (d.success) { showToast('Líder removido.', 'info'); loadEscalationConfig(); }
    else showToast('Erro ao remover.', 'error');
  } catch(e) { showToast('Erro: ' + e.message, 'error'); }
}

export async function addEscalationLeader() {
  var email = document.getElementById('escNewEmail').value.trim();
  var name = document.getElementById('escNewName').value.trim();
  var minM = parseInt(document.getElementById('escNewMin').value);
  var maxM = parseInt(document.getElementById('escNewMax').value);
  if (!email || !name || isNaN(minM) || isNaN(maxM)) { showToast('Preencha todos os campos.', 'error'); return; }
  var minVal = minM * 1000000;
  var maxVal = maxM >= 50 ? 100000000 : maxM * 1000000;
  try {
    const r = await authFetch(API.escalationConfigSet, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: email, name: name, min: minVal, max: maxVal })
    });
    const d = await r.json();
    if (d.success) {
      showToast('Líder adicionado.', 'success');
      document.getElementById('escNewEmail').value = '';
      document.getElementById('escNewName').value = '';
      document.getElementById('escNewMin').value = '';
      document.getElementById('escNewMax').value = '';
      loadEscalationConfig();
    } else showToast('Erro ao adicionar.', 'error');
  } catch(e) { showToast('Erro: ' + e.message, 'error'); }
}

