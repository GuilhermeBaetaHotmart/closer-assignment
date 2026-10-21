/* ══════════════════════════════════════════════
   utils.js — Funções utilitárias puras
   Sem dependência de DOM, estado global ou API.
   ══════════════════════════════════════════════ */


import { SEGS } from './api.js?v=20261020-2140';


/* Classifica um valor de cliente em segmento + subgrupo */
export function classify(v) {
  for (const [sk, seg] of Object.entries(SEGS))
    for (const sg of seg.sub)
      if (v >= sg.min && v <= sg.max) return { segKey: sk, subKey: sg.key, subLabel: sg.label };
  return null;
}

/* Formata valor em R$ compacto (ex: R$ 1.5M, R$ 600k) */
export function fmtBRL(v) {
  if (v >= 1000000) return 'R$ ' + (v / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M';
  if (v >= 1000)    return 'R$ ' + (v / 1000).toFixed(0) + 'k';
  return 'R$ ' + v;
}

/* Retorna a segunda-feira da semana corrente + offset de semanas */
export function getMon(offset) {
  var now = new Date(); var day = now.getDay();
  var mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return mon;
}

/* Extrai o ID puro do lead — aceita o ID direto OU o link do Salesforce
   (https://.../lightning/r/Lead/<ID>/view). Uso interno fica sempre com o ID limpo. */
export function extractLeadId(v) {
  var s = String(v || '').trim();
  var m = s.match(/\/Lead\/([^\/?#]+)/i);
  return m ? m[1] : s;
}

