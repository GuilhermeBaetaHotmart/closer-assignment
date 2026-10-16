/* ══════════════════════════════════════════════
   app.js — Orquestrador principal
   ══════════════════════════════════════════════ */

import { session, st, setSession, readStoredReservation, ACTIVE_RESERVATION_KEY } from './state.js?v=20261016-2109';
import { doLogout, setupRole, authFetch, isSessionExpired, touchActivity, startInactivityWatch, initGoogleLogin, isValidSessionToken, loadSegments } from './auth.js?v=20261016-2109';
import {
  loadActiveCompetitorsField, updateTag, goStep2, selectSchedulingMode, validateSlotPicker,
  submitSpecificSlot, backToStep1,
  clearSlotAndRetry, goEmergencyPool, fetchCloser, fetchSlots, renderSlots, selectSlot,
  applySlotFilters, setFilterDay, setFilterPeriod, rejectAgenda, renderRefused, goBackToCloser,
  renderQueueHint, doReserveSpecific, doReserve, showReservationState, startReservationTimer,
  doConfirmFinal, doCancelReserve, resetAll, onCompetitorChange, onLeadOriginChange, startInlineEdit,
  doCancelReserveById, renderReservationCard,
  onAssignTypeChange, onReferredCloserChange, loadCloserOptions, validateReferral
} from './sdr.js?v=20261016-2109';
import { loadMercado, acceptLead, removeLead } from './mercado.js?v=20261016-2109';
import { loadPendingView, confirmReserveById } from './pending.js?v=20261016-2109';
import { switchTab, switchDashTab, setAdminViewMode } from './navigation.js?v=20261016-2109';
import { setPeriod, setSegFilter, loadDashboard, exportHistory } from './dashboard-core.js?v=20261016-2109';
import { loadCapacity } from './dashboard-capacity.js?v=20261016-2109';
import { loadSecurity } from './dashboard-security.js?v=20261016-2109';
import { loadCampaigns, addCampaign, toggleCampaign } from './dashboard-campaigns.js?v=20261016-2109';
import { loadTimeConfig, editCloserOverride, saveCloserOverride, clearCloserOverride, saveSegmentDefault } from './dashboard-time.js?v=20261016-2109';
import { loadEscalationConfig, editEscalationLeader, saveEscalationLeader, removeEscalationLeader, addEscalationLeader } from './dashboard-escalation.js?v=20261016-2109';
import { loadQueueSetup, toggleEligibility } from './dashboard-queue-setup.js?v=20261016-2109';
import { loadActivity, exportActivity } from './dashboard-activity.js?v=20261016-2109';
import { toggleCloser } from './closers.js?v=20261016-2109';
import { setSlotView, togglePrepAdjust, syncPrepAdjustToggleUI } from './agenda.js?v=20261016-2109';
import { showToast, toggleTheme, showPoolFallbackModal, confirmPoolFallback, closePoolFallbackModal } from './ui.js?v=20261016-2109';
import { fmtBRL, classify, getMon } from './utils.js?v=20261016-2109';
import './animation.js?v=20261016-2109';

/* ── Expõe no window tudo que é chamado via onclick/onchange no HTML ── */
Object.assign(window, {
  doLogout,
  goStep2, selectSchedulingMode, validateSlotPicker, submitSpecificSlot, backToStep1, clearSlotAndRetry, goEmergencyPool,
  selectSlot, setFilterDay, setFilterPeriod, rejectAgenda, goBackToCloser, doReserveSpecific, doReserve,
  doConfirmFinal, doCancelReserve, resetAll, onCompetitorChange, onLeadOriginChange, startInlineEdit,
  onAssignTypeChange, onReferredCloserChange, loadCloserOptions, validateReferral,
  doCancelReserveById,
  changeWeek: function(dir){ if(st.slotsLoading) return; st.weekOffset += dir; st.filterDay = 'all'; st.filterPeriod = 'all'; fetchSlots(); },
  loadMercado, acceptLead, removeLead,
  loadPendingView, confirmReserveById,
  switchTab, switchDashTab, setAdminViewMode,
  setPeriod, setSegFilter, loadDashboard, exportHistory,
  loadCapacity, loadSecurity,
  loadCampaigns, addCampaign, toggleCampaign,
  loadTimeConfig, editCloserOverride, saveCloserOverride, clearCloserOverride, saveSegmentDefault,
  loadEscalationConfig, editEscalationLeader, saveEscalationLeader, removeEscalationLeader, addEscalationLeader,
  loadQueueSetup, toggleEligibility,
  loadActivity, exportActivity,
  toggleCloser, toggleTheme, showPoolFallbackModal, confirmPoolFallback, closePoolFallbackModal,
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
        // Sessão expirada por inatividade, ou do antigo login por senha → não
        // restaura, limpa e cai na tela de login (Google).
        var storedToken = localStorage.getItem('ca_token') || d.sessionToken;
        if (isSessionExpired() || !isValidSessionToken(storedToken)) {
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
        // Faixas de valor vêm do backend; as telas só montam depois delas.
        loadSegments().then(function () { setupRole(d); });
        touchActivity(true);
        startInactivityWatch();
      }
    }
  } catch (e) {}
})();

// Restaura a reserva ativa salva no localStorage. Sem isso, um F5 fazia o card sumir e
// a reserva cair na lista "Aguardando confirmação" — que até então confirmava por um
// caminho com menos dados. O card em si é repintado quando a aba é aberta.
st.activeReservation = readStoredReservation();

// Mantém as abas abertas em sincronia. O evento 'storage' só dispara nas OUTRAS abas,
// que é exatamente o que queremos: quando uma aba confirma ou cancela, as demais param
// de exibir o card daquela reserva. Antes, a aba desatualizada continuava mostrando o
// card de uma reserva já confirmada — e clicar ali criava uma segunda reunião.
window.addEventListener('storage', function(e) {
  if (e.key !== ACTIVE_RESERVATION_KEY) return;
  st.activeReservation = readStoredReservation();
  renderReservationCard();
  var pending = document.getElementById('pendingView');
  if (pending && pending.style.display !== 'none') loadPendingView();
});

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
initGoogleLogin();

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
