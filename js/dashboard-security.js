/* ══════════════════════════════════════════════
   dashboard-security.js — Aba Security. Equivalente ao Fluxo 13 (security).
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js?v=20260702-1332';
import { authFetch } from './auth.js?v=20260702-1332';

import { session, st } from './state.js?v=20260702-1332';
import { fmtBRL, classify, getCloserPhoto, getMon } from './utils.js?v=20260702-1332';
import { showToast } from './ui.js?v=20260702-1332';

export async function loadSecurity() {
  document.getElementById('securityUsersBody').innerHTML = '<tr><td colspan="5" class="table-empty"><div style="display:flex;align-items:center;justify-content:center;gap:8px"><div class="spinner"></div> Carregando...</div></td></tr>';
  document.getElementById('securityLogsBody').innerHTML  = '<tr><td colspan="6" class="table-empty"><div style="display:flex;align-items:center;justify-content:center;gap:8px"><div class="spinner"></div> Carregando...</div></td></tr>';
  try {
    const r = await authFetch(API.security);
    const d = await r.json();
    const users = d.users || [];
    const logs  = d.logs  || [];

    const totalSkips    = users.reduce(function(s,u){ return s + u.total; }, 0);
    const totalUnneeded = users.reduce(function(s,u){ return s + u.unnecessary; }, 0);
    const totalNeeded   = users.reduce(function(s,u){ return s + u.necessary; }, 0);
    const pctUnneeded   = totalSkips > 0 ? Math.round((totalUnneeded / totalSkips) * 100) : 0;

    document.getElementById('secTotalSkips').textContent  = totalSkips;
    document.getElementById('secUnnecessary').textContent = totalUnneeded;
    document.getElementById('secNecessary').textContent   = totalNeeded;
    document.getElementById('secPct').textContent         = pctUnneeded + '%';

    var ub = document.getElementById('securityUsersBody');
    if (!users.length) {
      ub.innerHTML = '<tr><td colspan="5" class="table-empty">Nenhum pulo registrado.</td></tr>';
    } else {
      ub.innerHTML = users.map(function(u) {
        var pctCls = u.pct_unnecessary >= 50 ? 'color:var(--red)' : u.pct_unnecessary >= 25 ? 'color:var(--yellow)' : 'color:var(--green)';
        return '<tr>' +
          '<td><span class="closer-cell-name">' + u.email.split('@')[0] + '</span><span class="closer-cell-email">' + u.email + '</span></td>' +
          '<td class="center"><strong style="font-family:\'Space Grotesk\',sans-serif">' + u.total + '</strong></td>' +
          '<td class="center" style="color:var(--green)">' + u.necessary + '</td>' +
          '<td class="center" style="color:var(--red)">' + u.unnecessary + '</td>' +
          '<td class="center"><strong style="' + pctCls + '">' + u.pct_unnecessary + '%</strong></td>' +
          '</tr>';
      }).join('');
    }

    var lb = document.getElementById('securityLogsBody');
    if (!logs.length) {
      lb.innerHTML = '<tr><td colspan="6" class="table-empty">Nenhum pulo desnecessário registrado.</td></tr>';
    } else {
      lb.innerHTML = logs.map(function(l) {
        var ts   = l.ts && l.ts !== '—' ? new Date(l.ts).toLocaleString('pt-BR') : '—';
        var slot = l.slotStart && l.slotStart !== '—' ? new Date(l.slotStart).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
        return '<tr>' +
          '<td style="font-size:11px;white-space:nowrap">' + ts + '</td>' +
          '<td style="font-size:12px">' + l.sdrEmail.split('@')[0] + '</td>' +
          '<td style="font-size:12px;color:var(--txt-3)">' + l.skippedCloserId.split('@')[0] + '</td>' +
          '<td style="font-size:12px;color:var(--txt-3)">' + (l.clientEmail || '—') + '</td>' +
          '<td style="font-size:12px">' + slot + '</td>' +
          '<td style="font-size:11px;color:var(--txt-2);max-width:220px">' + (l.reason || '—') + '</td>' +
          '</tr>';
      }).join('');
    }
  } catch(e) {
    document.getElementById('securityUsersBody').innerHTML = '<tr><td colspan="5" class="table-empty">Erro: ' + e.message + '</td></tr>';
    document.getElementById('securityLogsBody').innerHTML  = '<tr><td colspan="6" class="table-empty">Erro: ' + e.message + '</td></tr>';
  }
}

