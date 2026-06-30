/* ══════════════════════════════════════════════
   auth.js — Login, logout, sessão, roles. Equivalente ao Fluxo 0 (auth) do N8N.
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js';
import { session, setSession, st } from './state.js';
import { switchTab } from './navigation.js';
import { loadActiveCompetitorsField, resetAll } from './sdr.js';

import { fmtBRL, classify, getCloserPhoto, getMon } from './utils.js';
import { showToast } from './ui.js';

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
  try { localStorage.removeItem('ca_session'); localStorage.removeItem('ca_token'); } catch(e) {} resetAll();
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
  options = options || {};
  options.headers = options.headers || {};
  var token = session && session.sessionToken ? session.sessionToken : (localStorage.getItem('ca_token') || '');
  if (token) options.headers['x-auth-token'] = token;
  return fetch(url, options);
}

