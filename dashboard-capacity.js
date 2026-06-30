/* ══════════════════════════════════════════════
   dashboard-capacity.js — Aba Capacidade. Equivalente ao Fluxo 10 (capacity).
   ══════════════════════════════════════════════ */

import { API, SEGS } from './api.js';
import { authFetch } from './auth.js';
import { session, st } from './state.js';
import { fmtBRL, classify, getCloserPhoto, getMon } from './utils.js';
import { showToast } from './ui.js';

// Helper: extrai total de um valor que pode ser number (formato antigo) ou {slots,free,total}
function getTotal(v) {
  if (v == null) return 0;
  if (typeof v === 'object') return v.total || 0;
  return v;
}
function getSlots(v) {
  if (v == null) return 0;
  if (typeof v === 'object') return v.slots || 0;
  return 0;
}
function getFree(v) {
  if (v == null) return 0;
  if (typeof v === 'object') return v.free || 0;
  return 0;
}

// Renderiza célula da tabela com breakdown slots/espaços
function cellHtml(dayVal, cls) {
  const total = getTotal(dayVal);
  const slots = getSlots(dayVal);
  const free  = getFree(dayVal);
  const hasBreakdown = slots > 0 || free > 0;
  const breakdown = hasBreakdown
    ? '<div class="cap-cell-breakdown"><span class="cap-slot-badge">' + slots + 's</span><span class="cap-free-badge">' + free + 'e</span></div>'
    : '';
  return '<td class="cap-cell-num ' + cls + '">' + total + breakdown + '</td>';
}

export async function loadCapacity() {
  const segment    = document.getElementById('capSegment').value;
  const weekOffset = parseInt(document.getElementById('capWeek').value);
  const aggGrid    = document.getElementById('capAggGrid');
  const tbody      = document.getElementById('capTableBody');
  aggGrid.innerHTML = '<div class="cap-day-card" style="grid-column:1/-1;text-align:center;color:var(--txt-3);">Carregando...</div>';
  tbody.innerHTML   = '<tr><td colspan="7" style="text-align:center;color:var(--txt-3);padding:24px;">Carregando...</td></tr>';

  try {
    var d;
    if (segment === 'ALL') {
      const [rSMB, rMID, rENT] = await Promise.all([
        authFetch(API.capacity, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ segment:'SMB', weekOffset }) }),
        authFetch(API.capacity, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ segment:'MID', weekOffset }) }),
        authFetch(API.capacity, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ segment:'ENT', weekOffset }) })
      ]);
      const safeJson = async function(r) { try { const t = await r.text(); return t ? JSON.parse(t) : {}; } catch(e) { return {}; } };
      const [dSMB, dMID, dENT] = await Promise.all([safeJson(rSMB), safeJson(rMID), safeJson(rENT)]);
      const emptyAgg = { seg:{slots:0,free:0,total:0}, ter:{slots:0,free:0,total:0}, qua:{slots:0,free:0,total:0}, qui:{slots:0,free:0,total:0}, sex:{slots:0,free:0,total:0} };
      const emptySegment = { aggregated: emptyAgg, closers: [], totalClosers: 0, dayDates: {} };
      const s = (Array.isArray(dSMB) ? dSMB[0] : dSMB) || emptySegment;
      const m = (Array.isArray(dMID) ? dMID[0] : dMID) || emptySegment;
      const e = (Array.isArray(dENT) ? dENT[0] : dENT) || emptySegment;
      if (!s.aggregated) s.aggregated = emptyAgg;
      if (!m.aggregated) m.aggregated = emptyAgg;
      if (!e.aggregated) e.aggregated = emptyAgg;

      const days = ['seg','ter','qua','qui','sex'];
      const agg = {};
      days.forEach(function(day) {
        agg[day] = {
          slots: getSlots(s.aggregated[day]) + getSlots(m.aggregated[day]) + getSlots(e.aggregated[day]),
          free:  getFree(s.aggregated[day])  + getFree(m.aggregated[day])  + getFree(e.aggregated[day]),
          total: getTotal(s.aggregated[day]) + getTotal(m.aggregated[day]) + getTotal(e.aggregated[day])
        };
      });
      const tagSeg = function(closers, seg) { return (closers||[]).map(function(c){ return Object.assign({}, c, {segment: seg}); }); };
      d = {
        segment: 'ALL', weekOffset,
        dayDates: s.dayDates,
        aggregated: agg,
        closers: tagSeg(s.closers,'SMB').concat(tagSeg(m.closers,'MID')).concat(tagSeg(e.closers,'ENT')),
        totalClosers: (s.totalClosers||0) + (m.totalClosers||0) + (e.totalClosers||0)
      };
    } else {
      const r = await authFetch(API.capacity, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, weekOffset })
      });
      const raw = await r.json();
      d = Array.isArray(raw) ? raw[0] : raw;
    }

    const days = ['seg','ter','qua','qui','sex'];
    const dayLabels = { seg:'SEG', ter:'TER', qua:'QUA', qui:'QUI', sex:'SEX' };
    const totalClosers = d.totalClosers || 1;
    const maxPerCloser = 5;
    const highThreshold = maxPerCloser * totalClosers * 0.7;
    const midThreshold  = maxPerCloser * totalClosers * 0.4;

    // ── Bloco agregado ──────────────────────────────
    aggGrid.innerHTML = days.map(function(day) {
      const dayVal = d.aggregated[day];
      const total  = getTotal(dayVal);
      const slots  = getSlots(dayVal);
      const free   = getFree(dayVal);
      const cls = total >= highThreshold ? 'cap-green' : total >= midThreshold ? 'cap-yellow' : 'cap-red';
      return '<div class="cap-day-card ' + cls + '">' +
        '<div class="cap-day-label">' + dayLabels[day] + '</div>' +
        '<div class="cap-day-date">' + (d.dayDates[day]||'') + '</div>' +
        '<div class="cap-day-count">' + total + '</div>' +
        '<div class="cap-day-breakdown">' +
          '<span class="cap-slot-badge">' + slots + ' slots</span>' +
          '<span class="cap-free-badge">' + free + ' espaços</span>' +
        '</div>' +
      '</div>';
    }).join('');

    // ── Tabela detalhe ──────────────────────────────
    if (!d.closers || d.closers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--txt-3);padding:24px;">Nenhum closer ativo neste segmento.</td></tr>';
      return;
    }

    function buildRows(closers) {
      return closers.map(function(c) {
        const cells = days.map(function(day) {
          const dayVal = c.days[day];
          const total  = getTotal(dayVal);
          const cls = total >= 4 ? 'cap-cell-ok' : total >= 2 ? 'cap-cell-med' : 'cap-cell-low';
          return cellHtml(dayVal, cls);
        }).join('');
        const totalVal = c.total;
        const grandTotal = getTotal(totalVal);
        const totalSlots = getSlots(totalVal);
        const totalFree  = getFree(totalVal);
        const totalBreakdown = (totalSlots > 0 || totalFree > 0)
          ? '<div class="cap-cell-breakdown"><span class="cap-slot-badge">' + totalSlots + 's</span><span class="cap-free-badge">' + totalFree + 'e</span></div>'
          : '';
        return '<tr><td>' + c.name + '</td>' + cells +
          '<td class="cap-cell-num">' + grandTotal + totalBreakdown + '</td></tr>';
      }).join('');
    }

    if (segment === 'ALL') {
      var segOrder  = ['SMB', 'MID', 'ENT'];
      var segLabels = { SMB: 'N2-N3', MID: 'N4-N5', ENT: 'N6+' };
      var segColors = { SMB: 'var(--yellow)', MID: '#48b4ff', ENT: '#a064ff' };
      var rows = '';
      segOrder.forEach(function(seg) {
        var segClosers = d.closers.filter(function(c) { return c.segment === seg; });
        if (segClosers.length === 0) return;
        rows += '<tr><td colspan="7" style="padding:10px 12px 6px;font-size:11px;font-weight:700;color:' + segColors[seg] + ';text-transform:uppercase;letter-spacing:0.08em;background:var(--bg-hover);">' + segLabels[seg] + '</td></tr>';
        rows += buildRows(segClosers);
      });
      tbody.innerHTML = rows;
    } else {
      tbody.innerHTML = buildRows(d.closers);
    }

  } catch(e) {
    aggGrid.innerHTML = '<div style="color:var(--red);padding:16px;">Erro: ' + e.message + '</div>';
    tbody.innerHTML = '';
  }
}
