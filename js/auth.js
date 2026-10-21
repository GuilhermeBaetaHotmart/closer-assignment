/* ══════════════════════════════════════════════
   auth.js — Login, logout, sessão, roles. Equivalente ao Fluxo 0 (auth) do N8N.
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js?v=20261020-2140';
import { session, setSession, st, setActiveReservation } from './state.js?v=20261020-2140';
import { switchTab } from './navigation.js?v=20261020-2140';
import { loadActiveCompetitorsField, resetAll } from './sdr.js?v=20261020-2140';

import { fmtBRL, classify, getMon } from './utils.js?v=20261020-2140';
import { showToast } from './ui.js?v=20261020-2140';

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

// Sessões do login Google são 64 caracteres hex aleatórios. As do antigo login
// por senha (derivadas do e-mail) não passam aqui e forçam um novo login.
export function isValidSessionToken(t) {
  return /^[0-9a-f]{64}$/.test(String(t || ''));
}

/* ── Faixas de valor (segmentos) ─────────────────────────────────
   Vêm do backend só para quem está logado; o código público não tem os valores.
   Precisam estar carregadas antes de montar qualquer tela (setupRole). */
export async function loadSegments() {
  if (Object.keys(SEGS).length) return true;
  try {
    const r = await authFetch(API.segments);
    if (!r.ok) return false;
    Object.assign(SEGS, await r.json());
    fillSegmentRanges();
    return true;
  } catch (e) {
    showToast('Não foi possível carregar as faixas de valor. Recarregue a página.', 'error', 6000);
    return false;
  }
}

// Preenche os textos de faixa do HTML (cabeçalhos do dashboard) a partir de SEGS.
function fillSegmentRanges() {
  const short = v => v >= 1000000 ? 'R$ ' + Math.round(v / 1000000) + 'M' : 'R$ ' + Math.round(v / 1000) + 'k';
  document.querySelectorAll('[data-seg-range]').forEach(function (el) {
    const seg = SEGS[el.getAttribute('data-seg-range')];
    if (!seg) return;
    const first = seg.sub[0], last = seg.sub[seg.sub.length - 1];
    el.textContent = last.max >= 999999999 ? 'Acima de ' + short(first.min) : short(first.min) + ' – ' + short(last.max + 1);
  });
  document.querySelectorAll('[data-sub-range]').forEach(function (el) {
    const key = el.getAttribute('data-sub-range');
    const sub = SEGS[key.split('-')[0]] && SEGS[key.split('-')[0]].sub.find(function (s) { return s.key === key; });
    const m = sub && sub.label.match(/\(([^)]+)\)/);
    if (m) el.textContent = m[1];
  });
}

// Guarda a sessão devolvida pelo /auth-google e abre o app.
async function finishLogin(d, fallbackEmail) {
  d.role = (d.role || '').toLowerCase().trim();
  setSession(d);
  try { localStorage.setItem('ca_session', JSON.stringify(d)); if(d.sessionToken) localStorage.setItem('ca_token', d.sessionToken); } catch(e) {}
  touchActivity(true);
  startInactivityWatch();
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('appScreen').style.display='block';
  document.getElementById('hdrName').textContent=d.name||fallbackEmail;
  document.getElementById('hdrEmail').textContent=d.email||'';
  document.getElementById('hdrAvatar').textContent=(d.name||fallbackEmail)[0].toUpperCase();
  await loadSegments();
  setupRole(d);
}

/* ── Login com Google ────────────────────────────────────────────
   O Google devolve um ID token (JWT assinado por ele). O front só repassa
   para o n8n (/auth-google), que confere assinatura, audiencia e dominio
   hotmart.com, busca o papel na planilha e cria a sessao. Nada aqui e
   confiado: a validacao e toda no backend. */
const GOOGLE_CLIENT_ID = '340178070727-oe77r7clf22u590dck05b3gnncljdifu.apps.googleusercontent.com';

export function initGoogleLogin() {
  const box = document.getElementById('googleBtn');
  if (!box) return;
  // O script do Google carrega async; tenta ate ele estar disponivel.
  if (!(window.google && google.accounts && google.accounts.id)) {
    setTimeout(initGoogleLogin, 200);
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    hd: 'hotmart.com',
    ux_mode: 'popup',
  });
  google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', text: 'signin_with', width: 320 });
}

async function handleGoogleCredential(resp) {
  const err = document.getElementById('loginError');
  err.style.display = 'none';
  try {
    const r = await fetch(API.authGoogle, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ idToken: resp.credential }) });
    const d = await r.json();
    if (d.success) {
      await finishLogin(d, d.email || '');
    } else {
      err.textContent = d.error || 'Não foi possível entrar com o Google.'; err.style.display = 'block';
    }
  } catch(e) { err.textContent = 'Erro de conexão. Tente novamente.'; err.style.display = 'block'; }
}

export function doLogout() {
  // Encerra a sessão também no servidor; sem isso o token seguiria válido até expirar.
  // keepalive: a chamada sobrevive mesmo se a aba for fechada logo em seguida.
  var token = (session && session.sessionToken) || localStorage.getItem('ca_token') || '';
  if (token) {
    try { fetch(API.logout, { method: 'POST', headers: { 'x-auth-token': token }, keepalive: true }).catch(function(){}); } catch(e) {}
  }
  setSession(null);
  Object.keys(SEGS).forEach(function (k) { delete SEGS[k]; }); // faixas só ficam na memória enquanto logado
  stopInactivityWatch();
  // Limpa também a reserva ativa: como ela agora vive no localStorage, sem isso o
  // próximo usuário a logar nesta máquina veria o card da reserva de outra pessoa.
  setActiveReservation(null);
  try { localStorage.removeItem('ca_session'); localStorage.removeItem('ca_token'); localStorage.removeItem('ca_last_activity'); } catch(e) {} resetAll();
  document.getElementById('appScreen').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('loginError').style.display='none';
}

export function setupRole(d) {
  const role = (d.role || '').toLowerCase().trim();
  const tabSdr     = document.getElementById('tabSdr');
  const tabMercado = document.getElementById('tabMercado');
  const tabPending = document.getElementById('tabPending');
  const tabAdmin   = document.getElementById('tabAdmin');
  const navTabs    = document.getElementById('navTabs');
  const adminTabs  = document.getElementById('adminTabs');

  // Reset
  [tabSdr, tabMercado, tabPending, tabAdmin].forEach(function(t){ if(t) t.style.display='none'; });
  navTabs.style.display = 'none';
  adminTabs.style.display = 'none';

  if (role === 'sdr') {
    navTabs.style.display = 'block';
    tabSdr.style.display = '';
    tabMercado.style.display = '';
    tabPending.style.display = '';
    switchTab('sdr');
  } else if (role === 'closer') {
    navTabs.style.display = 'block';
    tabMercado.style.display = '';
    switchTab('mercado');
  } else if (role === 'admin') {
    navTabs.style.display = 'block';
    tabSdr.style.display = '';
    tabMercado.style.display = '';
    tabPending.style.display = '';
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
    document.getElementById('pendingView').style.display = 'none';
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
  const r = await fetch(url, options);
  // 401 = sessão inválida/expirada no backend (auth-check). Várias chamadas em
  // paralelo podem voltar 401 juntas: desloga e avisa uma vez só.
  if (r.status === 401 && session && session.email) {
    doLogout();
    showToast('Sua sessão expirou — faça login novamente.', 'info', 6000);
  } else if (r.status === 403) {
    showToast('Você não tem permissão para esta ação.', 'error', 5000);
  }
  return r;
}

