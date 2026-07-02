/* ══════════════════════════════════════════════
   auth.js — Login, logout, sessão, roles. Equivalente ao Fluxo 0 (auth) do N8N.
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js?v=20260702-1332';
import { session, setSession, st } from './state.js?v=20260702-1332';
import { switchTab } from './navigation.js?v=20260702-1332';
import { loadActiveCompetitorsField, resetAll } from './sdr.js?v=20260702-1332';

import { fmtBRL, classify, getCloserPhoto, getMon } from './utils.js?v=20260702-1332';
import { showToast } from './ui.js?v=20260702-1332';

/* ── Expiração de sessão por inatividade (front-only) ────────────
   A sessão fica salva no localStorage sem validade própria. Aqui damos
   uma validade por inatividade: a cada uso (clique/tecla/chamada de API)
   renovamos o carimbo; se ficar SESSION_TIMEOUT_MIN sem uso, a sessão cai. */
const SESSION_TIMEOUT_MIN = 60;                          // minutos de inatividade até expirar
const SESSION_TIMEOUT_MS  = SESSION_TIMEOUT_MIN * 60 * 1000;
const LAST_ACTIVITY_KEY   = 'ca_last_activity';
const ACTIVITY_THROTTLE_MS = 30 * 1000;                  // grava no localStorage no máx. 1×/30s

let inactivityTimer = null;
let lastActivityWrite = 0;

// Marca atividade do usuário (throttled). force=true ignora throttle e guarda (login/restore).
export function touchActivity(force) {
  if (!force && !(session && session.email)) return;
  const now = Date.now();
  if (!force && now - lastActivityWrite < ACTIVITY_THROTTLE_MS) return;
  lastActivityWrite = now;
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(now)); } catch(e) {}
}

// Sessão expirou por inatividade?
export function isSessionExpired() {
  const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
  if (!last) return false;                               // sem carimbo → não força expiração
  return Date.now() - last > SESSION_TIMEOUT_MS;
}

// Watcher: desloga sozinho quando a inatividade estoura, mesmo com a aba aberta.
export function startInactivityWatch() {
  if (inactivityTimer) clearInterval(inactivityTimer);
  inactivityTimer = setInterval(function() {
    if (session && session.email && isSessionExpired()) {
      doLogout();
      showToast('Sessão expirada por inatividade — faça login novamente.', 'info', 6000);
    }
  }, 60 * 1000);
}

export function stopInactivityWatch() {
  if (inactivityTimer) { clearInterval(inactivityTimer); inactivityTimer = null; }
}

export async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value.trim();
  const btn   = document.getElementById('loginBtn');
  const err   = document.getElementById('loginError');
  const txt   = document.getElementById('loginBtnText');
  if (!email||!pw) { err.textContent='Preencha e-mail e senha.'; err.style.display='block'; return; }
  btn.disabled=true; txt.textContent='Autenticando...'; err.style.display='none';
  try {
    const r = await fetch(API.auth,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})});
    const d = await r.json();
    if (d.success) {
      d.role = (d.role || '').toLowerCase().trim();
      setSession(d);
      try { localStorage.setItem('ca_session', JSON.stringify(d)); if(d.sessionToken) localStorage.setItem('ca_token', d.sessionToken); } catch(e) {}
      touchActivity(true);
      startInactivityWatch();
      document.getElementById('loginScreen').style.display='none';
      document.getElementById('appScreen').style.display='block';
      document.getElementById('hdrName').textContent=d.name||email;
      document.getElementById('hdrEmail').textContent=d.email||'';
      document.getElementById('hdrAvatar').textContent=(d.name||email)[0].toUpperCase();
      setupRole(d);
    } else {
      err.textContent=d.error||'E-mail ou senha incorretos.'; err.style.display='block';
    }
  } catch(e) { err.textContent='Erro de conexão. Tente novamente.'; err.style.display='block'; }
  btn.disabled=false; txt.textContent='Entrar';
}

export function doLogout() {
  setSession(null);
  stopInactivityWatch();
  try { localStorage.removeItem('ca_session'); localStorage.removeItem('ca_token'); localStorage.removeItem('ca_last_activity'); } catch(e) {} resetAll();
  document.getElementById('appScreen').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('loginEmail').value='';
  document.getElementById('loginPassword').value='';
  document.getElementById('loginError').style.display='none';
}

export function setupRole(d) {
  const role = (d.role || '').toLowerCase().trim();
  const tabSdr     = document.getElementById('tabSdr');
  const tabMercado = document.getElementById('tabMercado');
  const tabAdmin   = document.getElementById('tabAdmin');
  const navTabs    = document.getElementById('navTabs');
  const adminTabs  = document.getElementById('adminTabs');

  // Reset
  [tabSdr, tabMercado, tabAdmin].forEach(function(t){ if(t) t.style.display='none'; });
  navTabs.style.display = 'none';
  adminTabs.style.display = 'none';

  if (role === 'sdr') {
    navTabs.style.display = 'block';
    tabSdr.style.display = '';
    tabMercado.style.display = '';
    switchTab('sdr');
  } else if (role === 'closer') {
    navTabs.style.display = 'block';
    tabMercado.style.display = '';
    switchTab('mercado');
  } else if (role === 'admin') {
    navTabs.style.display = 'block';
    tabSdr.style.display = '';
    tabMercado.style.display = '';
    tabAdmin.style.display = '';
    document.getElementById('adminViewMode').style.display = '';
    switchTab('sdr');
  } else if (role === 'manager') {
    navTabs.style.display = 'block';
    tabMercado.style.display = '';
    tabAdmin.style.display = '';
    switchTab('admin');
  } else {
    // Role desconhecida: não mostra nenhuma aba, evita ficar travado em uma view antiga
    document.getElementById('sdrView').style.display = 'none';
    document.getElementById('mercadoView').style.display = 'none';
    document.getElementById('adminView').style.display = 'none';
  }

  loadActiveCompetitorsField();
}

export async function authFetch(url, options) {
  touchActivity();
  options = options || {};
  options.headers = options.headers || {};
  var token = session && session.sessionToken ? session.sessionToken : (localStorage.getItem('ca_token') || '');
  if (token) options.headers['x-auth-token'] = token;
  return fetch(url, options);
}

