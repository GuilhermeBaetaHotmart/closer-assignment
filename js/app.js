/* ══════════════════════════════════════════════
   app.js — Orquestrador principal
   ══════════════════════════════════════════════ */

import { session, st, setSession } from './state.js';
import { doLogin, doLogout, setupRole, authFetch, isSessionExpired, touchActivity, startInactivityWatch } from './auth.js';
import {
  loadActiveCompetitorsField, updateTag, goStep2, selectSchedulingMode, validateSlotPicker,
  submitSpecificSlot, backToStep1,
  clearSlotAndRetry, goEmergencyPool, fetchCloser, fetchSlots, renderSlots, selectSlot,
  applySlotFilters, setFilterDay, setFilterPeriod, rejectAgenda, renderRefused,
  renderQueueHint, doReserveSpecific, doReserve, showReservationState, startReservationTimer,
  doConfirmFinal, doCancelReserve, showSuccess, resetAll, onCompetitorChange
} from './sdr.js';
import { loadMercado, acceptLead, removeLead } from './mercado.js';
import { switchTab, switchDashTab, setAdminViewMode } from './navigation.js';
import { setPeriod, setSegFilter, loadDashboard } from './dashboard-core.js';
import { loadCapacity } from './dashboard-capacity.js';
import { loadSecurity } from './dashboard-security.js';
import { loadCampaigns, addCampaign, toggleCampaign } from './dashboard-campaigns.js';
import { loadTimeConfig, editCloserOverride, saveCloserOverride, clearCloserOverride, saveSegmentDefault } from './dashboard-time.js';
import { loadEscalationConfig, editEscalationLeader, saveEscalationLeader, removeEscalationLeader, addEscalationLeader } from './dashboard-escalation.js';
import { toggleCloser } from './closers.js';
import { setSlotView, togglePrepAdjust, syncPrepAdjustToggleUI } from './agenda.js';
import { showToast, toggleTheme } from './ui.js';
import { fmtBRL, classify, getCloserPhoto, getMon } from './utils.js';
import './animation.js';

/* ── Expõe no window tudo que é chamado via onclick/onchange no HTML ── */
Object.assign(window, {
  doLogin, doLogout,
  goStep2, selectSchedulingMode, validateSlotPicker, submitSpecificSlot, backToStep1, clearSlotAndRetry, goEmergencyPool,
  selectSlot, setFilterDay, setFilterPeriod, rejectAgenda, doReserveSpecific, doReserve,
  doConfirmFinal, doCancelReserve, resetAll, onCompetitorChange,
  changeWeek: function(dir){ if(st.slotsLoading) return; st.weekOffset += dir; st.filterDay = 'all'; st.filterPeriod = 'all'; fetchSlots(); },
  loadMercado, acceptLead, removeLead,
  switchTab, switchDashTab, setAdminViewMode,
  setPeriod, setSegFilter, loadDashboard,
  loadCapacity, loadSecurity,
  loadCampaigns, addCampaign, toggleCampaign,
  loadTimeConfig, editCloserOverride, saveCloserOverride, clearCloserOverride, saveSegmentDefault,
  loadEscalationConfig, editEscalationLeader, saveEscalationLeader, removeEscalationLeader, addEscalationLeader,
  toggleCloser, toggleTheme,
  setSlotView, togglePrepAdjust,
});

// Sincroniza o estado inicial do toggle admin (feature de ajuste de preparação)
syncPrepAdjustToggleUI();

// Popula o seletor de horário específico em intervalos de 15 min (08h–20h)
(function fillSlotTimes() {
  var sel = document.getElementById('slotTime');
  if (!sel) return;
  var opts = '<option value="">--:--</option>';
  for (var min = 8 * 60; min <= 20 * 60; min += 15) {
    var hh = String(Math.floor(min / 60)).padStart(2, '0');
    var mm = String(min % 60).padStart(2, '0');
    opts += '<option value="' + hh + ':' + mm + '">' + hh + ':' + mm + '</option>';
  }
  sel.innerHTML = opts;
})();

/* ── Inicialização ──────────────────────────── */

// Restaura sessão salva no localStorage
(function restoreSession() {
  try {
    var saved = localStorage.getItem('ca_session');
    if (saved) {
      var d = JSON.parse(saved);
      if (d && d.email && d.success) {
        // Sessão expirada por inatividade → não restaura, limpa e cai na tela de login
        if (isSessionExpired()) {
          localStorage.removeItem('ca_session');
          localStorage.removeItem('ca_token');
          localStorage.removeItem('ca_last_activity');
          return;
        }
        d.role = (d.role || '').toLowerCase().trim();
        setSession(d);
        var savedToken = localStorage.getItem('ca_token');
        if (savedToken) session.sessionToken = savedToken;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appScreen').style.display = 'block';
        document.getElementById('hdrName').textContent = d.name || d.email;
        document.getElementById('hdrEmail').textContent = d.email || '';
        document.getElementById('hdrAvatar').textContent = (d.name || d.email)[0].toUpperCase();
        setupRole(d);
        touchActivity(true);
        startInactivityWatch();
      }
    }
  } catch (e) {}
})();

// Marca atividade do usuário (click/tecla) para o timeout de inatividade
document.addEventListener('click',   function(){ touchActivity(); }, true);
document.addEventListener('keydown', function(){ touchActivity(); }, true);

// Restaura tema
(function restoreTheme() {
  var saved = localStorage.getItem('ca_theme');
  if (saved === 'light') {
    document.body.classList.add('light');
    var btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = '☀️';
  }
})();

// Event listeners de inicialização
document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('loginPassword').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doLogin();
});

// Listener do campo de valor — formata e classifica em tempo real
document.getElementById('valInput').addEventListener('input', function(){
  var cursor = this.selectionStart;
  var raw = this.value.replace(/\D/g,'');
  st.rawValue = parseInt(raw) || 0;
  var formatted = st.rawValue > 0 ? st.rawValue.toLocaleString('pt-BR') : '';
  var oldVal = this.value;
  var oldSeps = (oldVal.slice(0, cursor).match(/\./g)||[]).length;
  this.value = formatted;
  var newSeps = (formatted.slice(0, cursor).match(/\./g)||[]).length;
  var newCursor = cursor + (newSeps - oldSeps);
  try { this.setSelectionRange(newCursor, newCursor); } catch(e){}
  updateTag();
});
