/* ══════════════════════════════════════════════
   agenda.js — PROTÓTIPO: visão "Completa" (agenda semanal) do Passo 2.
   3 tipos de bloco: Slot (dado real), Ocupado (MOCK até termos backend),
   Espaço livre (calculado). O espaço livre é selecionável: hover mostra um
   intervalo de 1h30 (30min prep + 1h reunião) que encaixa na lacuna e segue
   o cursor; o clique seleciona aquele horário (mesma caixa de confirmação).
   ══════════════════════════════════════════════ */

import { st } from './state.js?v=20260702-1332';
import { SEGS } from './api.js?v=20260702-1332';
import { fmtBRL, getMon } from './utils.js?v=20260702-1332';

const WIN_START  = 8 * 60;    // 08:00 — início visível
const WIN_END    = 18 * 60;   // 18:00 — fim visível
const BOOK_START = 10 * 60;   // 10:00 — janela de atendimento
const BOOK_END   = 17 * 60;   // 17:00
const PX_PER_MIN = 0.8;
const SNAP       = 15;         // granularidade do hover (min)
const MEET         = 60;                 // duração fixa da reunião (min)
const PREP_OPTIONS = [30, 20, 15, 10];   // opções de preparação (min)
const DEFAULT_PREP = 30;                 // TODO: puxar da config de segmento (aba admin / Fluxo 16)
let   prepMin      = DEFAULT_PREP;        // preparação atual — reduza p/ caber em lacunas menores
function blockLen() { return prepMin + MEET; }

// Feature flag (admin): permite ou não o analista ajustar o tempo de preparação.
// Protótipo: persistido em localStorage; em produção viraria config no backend.
function prepAdjustEnabled() { return localStorage.getItem('ca_prep_adjust') !== '0'; }

export function togglePrepAdjust() {
  const v = !prepAdjustEnabled();
  try { localStorage.setItem('ca_prep_adjust', v ? '1' : '0'); } catch(e) {}
  syncPrepAdjustToggleUI();
  if (st.slotView === 'full') renderAgenda();
}

export function syncPrepAdjustToggleUI() {
  const sw  = document.getElementById('prepAdjustToggle');
  if (sw)  sw.classList.toggle('on', prepAdjustEnabled());
  const lbl = document.getElementById('prepAdjustState');
  if (lbl) lbl.textContent = prepAdjustEnabled() ? 'Ativado' : 'Desativado';
}

const DAYS = [
  { key: 'seg', label: 'SEG' }, { key: 'ter', label: 'TER' }, { key: 'qua', label: 'QUA' },
  { key: 'qui', label: 'QUI' }, { key: 'sex', label: 'SEX' }
];

let ghostEl = null;

function pad(n){ return (n < 10 ? '0' : '') + n; }
function fmtMin(mins){ return pad(Math.floor(mins / 60)) + ':' + pad(mins % 60); }

function minutesBRT(iso) {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
  const parts = hm.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

// Datas Seg–Sex da semana atual (respeita st.weekOffset)
function weekDates() {
  const mon = getMon(st.weekOffset);
  return DAYS.map(function(d, i) {
    const dt = new Date(mon); dt.setDate(mon.getDate() + i);
    return { key: d.key, label: d.label, date: pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1),
             yyyy: dt.getFullYear(), mo: dt.getMonth() + 1, da: dt.getDate() };
  });
}

// Data (ano/mês/dia BRT) de um ISO, para casar evento com a coluna do dia
function brtParts(iso) {
  const s = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
  const a = s.split('-');
  return { y: +a[0], m: +a[1], da: +a[2] };
}

// Eventos ocupados reais do dia (de st.agendaEvents, vindos do /slots) → [[startMin, endMin], ...]
function eventsForDay(day) {
  return (st.agendaEvents || []).map(function(ev) {
    const p = brtParts(ev.start);
    if (p.y !== day.yyyy || p.m !== day.mo || p.da !== day.da) return null;
    return [minutesBRT(ev.start), minutesBRT(ev.end)];
  }).filter(Boolean);
}

// Slots CADASTRADOS do dia (type 'slot'; os 'free' viram espaço livre calculado no front)
function slotsForDay(dayKey) {
  return (st.allSlots || [])
    .filter(function(s) { return s.dayKey === dayKey && s.type === 'slot'; })
    .map(function(s) { return { start: minutesBRT(s.start), end: minutesBRT(s.end), ref: s }; });
}

// Piso mínimo de agendamento (mesma regra do nó "02 - Build Period" do /slots):
// manhã (< 12h BRT) → hoje a partir das 10h BRT (ou agora, arredondado p/ 15min);
// tarde (>= 12h BRT) → só a partir de amanhã 10h BRT.
function minBookableMs() {
  const now = new Date();
  // "Relógio BRT": desloca -3h para que getUTC* reflitam a data/hora do calendário BRT.
  // (Sem isso, à noite em BRT o UTC já virou o dia e o "amanhã" saía errado.)
  const brt = new Date(now.getTime() - 3 * 3600000);
  const hourBRT = brt.getUTCHours();
  // Um turno pra frente: manhã agora → hoje a partir das 10h; tarde/noite → amanhã a partir das 10h.
  let mb;
  if (hourBRT < 12) {
    mb = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 13, 0, 0, 0); // 10h BRT hoje
    if (now.getTime() > mb) {
      const step = 15 * 60 * 1000;
      mb = Math.ceil(now.getTime() / step) * step;   // se já passou das 10h, arredonda p/ 15min
    }
  } else {
    mb = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() + 1, 13, 0, 0, 0); // amanhã 10h BRT
  }
  return mb;
}

// Epoch (ms) de um minuto-do-dia BRT numa data específica (BRT = UTC-3)
function dayAbsMs(day, min) {
  return Date.UTC(day.yyyy, day.mo - 1, day.da, Math.floor(min / 60) + 3, min % 60, 0, 0);
}

// Menor minuto-do-dia agendável nesse dia, considerando o piso mínimo (mb).
// Retorna BOOK_END quando o dia inteiro está no passado/antes do corte (sem livre).
function dayFloorMin(day, mb) {
  if (dayAbsMs(day, BOOK_END) <= mb) return BOOK_END;   // dia todo no passado
  if (dayAbsMs(day, BOOK_START) >= mb) return BOOK_START; // dia todo liberado
  const d = new Date(mb);                                 // mb cai dentro do dia
  const minBRT = ((d.getUTCHours() - 3 + 24) % 24) * 60 + d.getUTCMinutes();
  return Math.max(BOOK_START, minBRT);
}

// Lacunas livres dentro de [piso, 17h] (subtraindo slots e ocupados)
function freeForDay(slots, busy, floorMin) {
  const start0 = Math.max(BOOK_START, floorMin);
  if (start0 >= BOOK_END) return [];
  const taken = slots.map(function(s) { return [s.start, s.end]; })
    .concat(busy)
    .sort(function(a, b) { return a[0] - b[0]; });
  const free = [];
  let cur = start0;
  taken.forEach(function(t) {
    if (t[0] > cur) free.push([cur, Math.min(t[0], BOOK_END)]);
    cur = Math.max(cur, t[1]);
  });
  if (cur < BOOK_END) free.push([cur, BOOK_END]);
  return free.filter(function(f) { return f[1] - f[0] >= 30; });
}

function block(kind, startMin, endMin, label) {
  const el = document.createElement('div');
  el.className = 'agenda-block agenda-' + kind;
  el.style.top = ((startMin - WIN_START) * PX_PER_MIN) + 'px';
  el.style.height = ((endMin - startMin) * PX_PER_MIN) + 'px';
  el.innerHTML = '<span class="agenda-block-label">' + label + '</span>';
  return el;
}

function showGhost(col, start, invalid) {
  if (!ghostEl) {
    ghostEl = document.createElement('div');
    ghostEl.className = 'agenda-ghost';
    ghostEl.innerHTML = '<div class="agenda-ghost-seg agenda-ghost-prep"></div>' +
                        '<div class="agenda-ghost-seg agenda-ghost-meet"></div>';
  }
  if (ghostEl.parentNode !== col) col.appendChild(ghostEl);
  ghostEl.classList.toggle('agenda-ghost-invalid', !!invalid);
  ghostEl.dataset.start = start;
  ghostEl.dataset.valid = invalid ? '0' : '1';
  ghostEl.style.top = ((start - WIN_START) * PX_PER_MIN) + 'px';
  ghostEl.style.height = (blockLen() * PX_PER_MIN) + 'px';
  const prep = ghostEl.querySelector('.agenda-ghost-prep');
  const meet = ghostEl.querySelector('.agenda-ghost-meet');
  prep.style.display  = prepMin > 0 ? 'flex' : 'none';   // sem prep → só o bloco de reunião
  prep.style.flexGrow = prepMin;
  meet.style.flexGrow = MEET;
  prep.innerHTML = 'prep<small>' + prepMin + 'min</small>';
  meet.innerHTML = invalid
    ? 'não cabe<small>1h' + pad(prepMin) + '</small>'
    : 'reunião<small>' + fmtMin(start + prepMin) + '–' + fmtMin(start + prepMin + MEET) + '</small>';
}

function hideGhost() {
  if (ghostEl && ghostEl.parentNode) ghostEl.parentNode.removeChild(ghostEl);
}

function attachFreeHover(el, day, freeInterval) {
  const B = blockLen();
  const fits = (freeInterval[1] - freeInterval[0]) >= B;
  el.style.cursor = fits ? 'pointer' : 'not-allowed';
  el.addEventListener('mousemove', function(ev) {
    const col = el.parentNode;
    if (!fits) { showGhost(col, freeInterval[0], true); return; }  // não cabe → overlay vermelho
    const colRect = col.getBoundingClientRect();
    const maxStart = freeInterval[1] - B;
    let start = WIN_START + (ev.clientY - colRect.top) / PX_PER_MIN;
    start = Math.round(start / SNAP) * SNAP;                        // passos de 15min
    if (start < freeInterval[0]) start = freeInterval[0];           // clamp final — sem re-snap
    if (start > maxStart)        start = maxStart;
    showGhost(col, start, false);
  });
  el.addEventListener('mouseleave', hideGhost);
  el.addEventListener('click', function() {
    if (!ghostEl || ghostEl.dataset.valid !== '1') return;         // não cabe → não seleciona
    const start = parseInt(ghostEl.dataset.start, 10);
    selectAgenda(null, day, start, start + blockLen(), 'free', null);
  });
}

function isoFor(day, mins) {
  return day.yyyy + '-' + pad(day.mo) + '-' + pad(day.da) + 'T' + fmtMin(mins) + ':00-03:00';
}

function selectAgenda(el, day, startMin, endMin, kind, ref) {
  document.querySelectorAll('.agenda-block.selected').forEach(function(b) { b.classList.remove('selected'); });
  if (el) el.classList.add('selected');
  hideGhost();
  const startISO = ref ? ref.start : isoFor(day, startMin);
  const endISO   = ref ? ref.end   : isoFor(day, endMin);
  const label = day.label + ' ' + day.date + ' · ' + fmtMin(startMin) + '–' + fmtMin(endMin) +
                (kind === 'free' ? (prepMin ? ' (30min prep + 1h)' : ' (sem prep + 1h)') : '');
  st.selectedSlotId    = ref ? ref.id : ('free_' + startISO);
  st.selectedSlotLabel = label;
  st.selectedSlotStart = startISO;
  st.selectedSlotEnd   = endISO;
  document.getElementById('cfLeadId').textContent     = st.leadId || '—';
  document.getElementById('cfClientEmail').textContent = st.clientEmail || '—';
  document.getElementById('cfSeg').textContent        = SEGS[st.segKey].label;
  document.getElementById('cfSub').textContent        = st.subLabel;
  document.getElementById('cfSlot').textContent       = label;
  document.getElementById('cfVal').textContent        = fmtBRL(st.rawValue);
  document.getElementById('confirmBox').style.display = 'block';
  document.getElementById('btnConfirm').disabled      = false;
}

export function renderAgenda() {
  const host = document.getElementById('agendaView');
  if (!host) return;
  const days = weekDates();
  const mb = minBookableMs();
  host.innerHTML = '';

  // Dropdown de preparação — default vem da segmentação; some quando o admin desativa a feature.
  if (prepAdjustEnabled()) {
    const prepBox = document.createElement('div');
    prepBox.className = 'agenda-prep-box';
    prepBox.innerHTML = '<label for="agendaPrepSelect">⏱ Tempo de preparação</label>' +
      '<select id="agendaPrepSelect">' +
      PREP_OPTIONS.map(function(o) {
        return '<option value="' + o + '"' + (o === prepMin ? ' selected' : '') + '>' + o + ' min</option>';
      }).join('') + '</select>';
    host.appendChild(prepBox);
    prepBox.querySelector('select').onchange = function() {
      prepMin = parseInt(this.value, 10);
      renderAgenda();
    };
  } else {
    prepMin = DEFAULT_PREP;  // sem liberdade de ajuste → trava no default da segmentação
  }

  const head = document.createElement('div');
  head.className = 'agenda-head';
  head.innerHTML = '<div></div>' + days.map(function(d) {
    return '<div class="agenda-head-day">' + d.label + '<small>' + d.date + '</small></div>';
  }).join('');
  host.appendChild(head);

  const body = document.createElement('div');
  body.className = 'agenda-body';

  const gutter = document.createElement('div');
  gutter.className = 'agenda-gutter';
  gutter.style.height = ((WIN_END - WIN_START) * PX_PER_MIN) + 'px';
  for (let h = WIN_START; h <= WIN_END; h += 60) {
    const lab = document.createElement('div');
    lab.className = 'agenda-hour';
    lab.style.top = ((h - WIN_START) * PX_PER_MIN) + 'px';
    lab.textContent = fmtMin(h);
    gutter.appendChild(lab);
  }
  body.appendChild(gutter);

  days.forEach(function(day) {
    const col = document.createElement('div');
    col.className = 'agenda-col';
    col.style.height = ((WIN_END - WIN_START) * PX_PER_MIN) + 'px';
    for (let h = WIN_START; h <= WIN_END; h += 60) {
      const line = document.createElement('div');
      line.className = 'agenda-line';
      line.style.top = ((h - WIN_START) * PX_PER_MIN) + 'px';
      col.appendChild(line);
    }
    const slots = slotsForDay(day.key);
    const busy  = eventsForDay(day);
    const free  = freeForDay(slots, busy, dayFloorMin(day, mb));
    busy.forEach(function(b) { col.appendChild(block('busy', b[0], b[1], 'Ocupado')); });
    free.forEach(function(f) {
      const el = block('free', f[0], f[1], 'Livre');
      attachFreeHover(el, day, f);
      col.appendChild(el);
    });
    slots.forEach(function(s) {
      const el = block('slot', s.start, s.end, 'Slot');
      el.onclick = function() { selectAgenda(el, day, s.start, s.end, 'slot', s.ref); };
      col.appendChild(el);
    });
    body.appendChild(col);
  });
  host.appendChild(body);

  const legend = document.createElement('div');
  legend.className = 'agenda-legend';
  legend.innerHTML =
    '<span class="agenda-lg slot">Slot</span>' +
    '<span class="agenda-lg busy">Ocupado</span>' +
    '<span class="agenda-lg free">Espaço livre — passe o mouse p/ escolher</span>';
  host.appendChild(legend);
}

export function setSlotView(view) {
  st.slotView = view;
  const compact = view !== 'full';
  document.getElementById('slotsFilters').style.display = compact ? '' : 'none';
  document.getElementById('slotsGrid').style.display    = compact ? '' : 'none';
  document.getElementById('agendaView').style.display   = compact ? 'none' : 'block';
  document.getElementById('viewCompact').classList.toggle('active', compact);
  document.getElementById('viewFull').classList.toggle('active', !compact);
  if (!compact) renderAgenda();
}
