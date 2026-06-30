/* ══════════════════════════════════════════════
   api.js — Configuração de endpoints N8N
   Equivalente aos webhooks de cada fluxo N8N.
   ══════════════════════════════════════════════ */



export const API = {
  auth:          'https://hotmart.app.n8n.cloud/webhook/Auth',
  algorithm:     'https://hotmart.app.n8n.cloud/webhook/algorithm',
  slots:         'https://hotmart.app.n8n.cloud/webhook/slots',
  reserve:       'https://hotmart.app.n8n.cloud/webhook/reserve',
  confirm:       'https://hotmart.app.n8n.cloud/webhook/confirm',
  cancelReserve: 'https://hotmart.app.n8n.cloud/webhook/cancel-reserve',
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
};

export const SEGS = {
  SMB: { label:'N2-N3', cls:'seg-smb', sub:[
    {key:'SMB-1',label:'Grupo 1 (100–300k)',min:100000,max:300000},
    {key:'SMB-2',label:'Grupo 2 (300–600k)',min:300001,max:600000},
    {key:'SMB-3',label:'Grupo 3 (600k+)',  min:600001,max:999999}
  ]},
  MID: { label:'N4-N5', cls:'seg-mid', sub:[
    {key:'MID-1',label:'Grupo 1 (1M–2M)', min:1000000,max:2000000},
    {key:'MID-2',label:'Grupo 2 (2M–3M)', min:2000001,max:3000000},
    {key:'MID-3',label:'Grupo 3 (3M+)',   min:3000001,max:4999999}
  ]},
  ENT: { label:'N6+', cls:'seg-ent', sub:[
    {key:'ENT-1',label:'Grupo 1 (5M–10M)', min:5000000, max:10000000},
    {key:'ENT-2',label:'Grupo 2 (10M–20M)',min:10000001,max:20000000},
    {key:'ENT-3',label:'Grupo 3 (20M+)',   min:20000001,max:999999999}
  ]}
};
