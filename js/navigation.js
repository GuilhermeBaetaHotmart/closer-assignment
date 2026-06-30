/* ══════════════════════════════════════════════
   navigation.js — Navegação entre abas e views do app.
   ══════════════════════════════════════════════ */


import { session, st } from './state.js';
import { setupRole } from './auth.js';
import { loadDashboard } from './dashboard-core.js';
import { loadMercado } from './mercado.js';
import { loadCapacity } from './dashboard-capacity.js';
import { loadSecurity } from './dashboard-security.js';
import { loadCampaigns } from './dashboard-campaigns.js';
import { loadTimeConfig } from './dashboard-time.js';
import { loadEscalationConfig } from './dashboard-escalation.js';


export function switchTab(tab){
  // tabs novas
  var tSdr     = document.getElementById('tabSdr');
  var tMercado = document.getElementById('tabMercado');
  var tAdmin   = document.getElementById('tabAdmin');
  var tSdrL    = document.getElementById('tabSdrLegacy');
  var tAdminL  = document.getElementById('tabAdminLegacy');

  [tSdr,tMercado,tAdmin,tSdrL,tAdminL].forEach(function(t){ if(t){ t.classList.remove('active'); t.setAttribute('aria-selected','false'); } });

  var active = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (active) { active.classList.add('active'); active.setAttribute('aria-selected','true'); }
  var activeL = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Legacy');
  if (activeL) { activeL.classList.add('active'); activeL.setAttribute('aria-selected','true'); }

  document.getElementById('sdrView').style.display     = tab==='sdr'     ? '' : 'none';
  document.getElementById('mercadoView').style.display = tab==='mercado' ? '' : 'none';
  document.getElementById('adminView').style.display   = tab==='admin'   ? '' : 'none';

  if (tab==='admin')   loadDashboard();
  if (tab==='mercado') loadMercado();
}

export function switchDashTab(tab, btn) {
  document.getElementById('dashHistorico').style.display  = tab === 'historico'  ? '' : 'none';
  document.getElementById('dashCapacidade').style.display = tab === 'capacidade' ? '' : 'none';
  document.getElementById('dashSecurity').style.display   = tab === 'security'   ? '' : 'none';
  document.getElementById('dashCampaigns').style.display  = tab === 'campaigns'  ? '' : 'none';
  document.getElementById('dashTime').style.display       = tab === 'time'       ? '' : 'none';
  document.getElementById('dashEscalation').style.display  = tab === 'escalation' ? '' : 'none';
  document.querySelectorAll('#adminView .filter-btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  if (tab === 'capacidade') loadCapacity();
  if (tab === 'security')   loadSecurity();
  if (tab === 'campaigns')  loadCampaigns();
  if (tab === 'time')       loadTimeConfig();
  if (tab === 'escalation') loadEscalationConfig();
}

export function setAdminViewMode(mode) {
  var realRole = session ? session.role : 'admin';
  if (mode === 'admin') {
    setupRole(session);
  } else {
    // Simula visão sem trocar o role real
    var tabSdr     = document.getElementById('tabSdr');
    var tabMercado = document.getElementById('tabMercado');
    var tabAdmin   = document.getElementById('tabAdmin');
    [tabSdr, tabMercado, tabAdmin].forEach(function(t){ if(t) t.style.display='none'; });
    document.getElementById('navTabs').style.display = 'block';
    if (mode === 'sdr') {
      tabSdr.style.display = '';
      tabMercado.style.display = '';
      switchTab('sdr');
    } else if (mode === 'closer') {
      tabMercado.style.display = '';
      switchTab('mercado');
    }
  }
}

