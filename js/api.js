/* ══════════════════════════════════════════════
   api.js — Configuração de endpoints N8N
   Equivalente aos webhooks de cada fluxo N8N.
   ══════════════════════════════════════════════ */



export const API = {
  authGoogle:    'https://hotmart.app.n8n.cloud/webhook/auth-google',
  logout:        'https://hotmart.app.n8n.cloud/webhook/logout',
  segments:      'https://hotmart.app.n8n.cloud/webhook/segments',
  algorithm:     'https://hotmart.app.n8n.cloud/webhook/algorithm',
  slots:         'https://hotmart.app.n8n.cloud/webhook/slots',
  reserve:       'https://hotmart.app.n8n.cloud/webhook/reserve',
  confirm:       'https://hotmart.app.n8n.cloud/webhook/confirm',
  cancelReserve: 'https://hotmart.app.n8n.cloud/webhook/cancel-reserve',
  reservationsList: 'https://hotmart.app.n8n.cloud/webhook/reservations-list',
  dashboard:     'https://hotmart.app.n8n.cloud/webhook/dashboard',
  toggle:        'https://hotmart.app.n8n.cloud/webhook/toggle',
  poolAdd:       'https://hotmart.app.n8n.cloud/webhook/pool-add',
  poolList:      'https://hotmart.app.n8n.cloud/webhook/pool-list',
  poolRemove:    'https://hotmart.app.n8n.cloud/webhook/pool-remove',
  poolAccept:    'https://hotmart.app.n8n.cloud/webhook/pool-accept',
  capacity:      'https://hotmart.app.n8n.cloud/webhook/dashboard-capacity',
  skip:          'https://hotmart.app.n8n.cloud/webhook/skip',
  security:      'https://hotmart.app.n8n.cloud/webhook/dashboard-security',
  campaignsGet:  'https://hotmart.app.n8n.cloud/webhook/campaigns-get',
  campaignsSet:  'https://hotmart.app.n8n.cloud/webhook/campaigns-set',
  closerInfo:    'https://hotmart.app.n8n.cloud/webhook/closer-info',
  timeConfigGet: 'https://hotmart.app.n8n.cloud/webhook/time-config-get',
  timeConfigSet: 'https://hotmart.app.n8n.cloud/webhook/time-config-set',
  escalationConfigGet: 'https://hotmart.app.n8n.cloud/webhook/escalation-config-get',
  escalationConfigSet: 'https://hotmart.app.n8n.cloud/webhook/escalation-config-set',
  eligibilityGet:      'https://hotmart.app.n8n.cloud/webhook/eligibility-get',
  eligibilitySet:      'https://hotmart.app.n8n.cloud/webhook/eligibility-set',
  eligibilityHistory:  'https://hotmart.app.n8n.cloud/webhook/eligibility-history',
  loginLog:      'https://hotmart.app.n8n.cloud/webhook/login-log',
};

// Faixas de valor por segmento: vem do backend (/segments) depois do login, via
// loadSegments() em auth.js. Nao ficam no codigo publico.
export const SEGS = {};
