/* ══════════════════════════════════════════════
   sdr.js — Fluxo "Nova Oportunidade" — passos 1 a 3. Equivalente aos Fluxos 1, 3, 4, 5, 6, 12.
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js';
import { session, st } from './state.js';
import { classify, fmtBRL, getCloserPhoto, getMon } from './utils.js';
import { authFetch } from './auth.js';
import { showToast } from './ui.js';
import { markDone, markActive } from './animation.js';
import { renderAgenda, setSlotView } from './agenda.js';

let reservationExpiresAt = null;
let reservationTimer = null;


export async function loadActiveCompetitorsField() {
  var field = document.getElementById('competitorField');
  var select = document.getElementById('competitorInput');
  if (!field || !select) return;

  try {
    const r = await authFetch(API.campaignsGet);
    const d = await r.json();
    const campaigns = d.campaigns || [];
    const active = campaigns.filter(function(c) { return c.active; });

    if (!active.length) {
      field.style.display = 'none';
      select.removeAttribute('required');
      st.competitor = null;
      return;
    }

    field.style.display = '';
    var html = '<option value="">Selecione o concorrente</option>';
    active.forEach(function(c) {
      html += '<option value="' + c.name + '">' + c.name + '</option>';
    });
    html += '<option value="Other">Outro</option>';
    select.innerHTML = html;
  } catch(e) {
    // Em caso de erro, mantém o campo oculto por segurança (evita exigir campo que pode estar quebrado)
    field.style.display = 'none';
  }
}

export function updateTag() {
  const r=classify(st.rawValue);
  const el=document.getElementById('segTag');
  if (r&&st.rawValue>0) {
    const seg=SEGS[r.segKey];
    el.innerHTML='<span class="seg-badge '+seg.cls+'">'+seg.label+' &nbsp;·&nbsp; '+r.subLabel+'</span>';
  } else {
    el.innerHTML='<span class="seg-badge seg-none">Aguardando valor para classificar</span>';
  }
  updateStep1Button();
}

// Única fonte de habilitação do "Continuar →" do Passo 1: exige valor classificável
// E um modo de agendamento escolhido ativamente. A data/hora (modo específico) é
// pedida só no passo seguinte, então não entra aqui.
export function updateStep1Button() {
  const btn = document.getElementById('btnS1');
  const r = classify(st.rawValue);
  const hasValue = !!(r && st.rawValue > 0);
  const modeOk = st.schedulingMode === 'slots' || st.schedulingMode === 'specific';
  btn.disabled = !(hasValue && modeOk);
}

export async function goStep2() {
  document.getElementById('btnS1').textContent = 'Continuar →';
  const lid=document.getElementById('leadIdInput').value.trim();
  if (!lid) { document.getElementById('leadIdError').style.display='block'; document.getElementById('leadIdInput').classList.add('error'); return; }
  document.getElementById('leadIdError').style.display='none'; document.getElementById('leadIdInput').classList.remove('error');
  var competitorFieldVisible = document.getElementById('competitorField').style.display !== 'none';
  const competitor = document.getElementById('competitorInput').value.trim();
  if (competitorFieldVisible && !competitor) { document.getElementById('competitorError').style.display='block'; document.getElementById('competitorInput').classList.add('error'); return; }
  document.getElementById('competitorError').style.display='none'; document.getElementById('competitorInput').classList.remove('error');
  st.competitor = competitorFieldVisible ? competitor : null;
  const cem=document.getElementById('clientEmailInput').value.trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cem);
  if (!cem || !emailOk) {
    document.getElementById('clientEmailError').textContent = cem ? 'E-mail inválido' : 'Campo obrigatório';
    document.getElementById('clientEmailError').style.display='block';
    document.getElementById('clientEmailInput').classList.add('error'); return;
  }
  document.getElementById('clientEmailError').style.display='none'; document.getElementById('clientEmailInput').classList.remove('error');
  // Guarda dura: sem modo escolhido ativamente, não avança (nunca assume schedule)
  if (st.schedulingMode !== 'slots' && st.schedulingMode !== 'specific') {
    showToast('Escolha como agendar: por slots ou horário específico.', 'error', 4000);
    return;
  }
  const r=classify(st.rawValue); if(!r) return;
  st.leadId=lid; st.clientEmail=cem; st.segKey=r.segKey; st.subKey=r.subKey; st.subLabel=r.subLabel;
  st.refused=[]; st.weekOffset=0; st.selectedSlotId=null;
  document.getElementById('noAvailBanner').classList.remove('show');
  markDone('b1','l1'); markActive('b2','l2');
  document.getElementById('conn1').classList.add('done');
  document.getElementById('c1').classList.add('dimmed');

  // Modo horário específico: os pickers de data/hora só aparecem agora (após o Continuar).
  // O algoritmo só roda quando a pessoa confirmar data/hora em submitSpecificSlot().
  if (st.schedulingMode === 'specific') {
    document.getElementById('cSpecific').style.display='';
    document.getElementById('cSpecific').classList.remove('dimmed');
    return;
  }

  // Modo slots: roda o algoritmo direto e abre a grade de slots.
  await runAlgorithm();
}

// Confirma a data/hora do modo específico e dispara o algoritmo (checa disponibilidade).
export async function submitSpecificSlot() {
  if (!st.specificSlotStart) {
    showToast('Preencha data e hora do horário específico.', 'error', 4000);
    return;
  }
  document.getElementById('cSpecific').style.display='none';
  // Fora da janela: já sabemos que não há atendimento → oferece só o Mercado, sem rodar o algoritmo
  if (st.specificOutOfWindow) {
    st.noAvailability = true;
    st.closerId = null;
    document.getElementById('c1').classList.remove('dimmed');
    document.getElementById('c2').style.display='none';
    document.getElementById('slotsGrid').innerHTML='';
    var title = document.getElementById('noAvailTitle');
    if (title) title.textContent = 'Horário fora da janela de atendimento (10h–17h) — envie ao Mercado';
    var verAgenda = document.getElementById('btnVerAgenda');
    if (verAgenda) verAgenda.style.display = 'none';   // só a opção de Mercado
    document.getElementById('btnS1').textContent = 'Escolher outro horário';
    document.getElementById('noAvailBanner').classList.add('show');
    return;
  }
  await runAlgorithm();
}

// Volta do passo de data/hora para o Passo 1 sem perder os dados já preenchidos.
export function backToStep1() {
  document.getElementById('cSpecific').style.display='none';
  document.getElementById('c1').classList.remove('dimmed');
  markActive('b1','l1');
  document.getElementById('conn1').classList.remove('done');
}

// Executa o algoritmo (animação + fetch) e roteia o resultado. Compartilhado entre
// o modo slots (goStep2) e o modo específico (submitSpecificSlot / clearSlotAndRetry).
async function runAlgorithm() {
  document.getElementById('noAvailBanner').classList.remove('show');
  document.getElementById('algoAnim').style.display='block';
  document.getElementById('c2').style.display='none';
  await new Promise(function(res){ setTimeout(res, 50); });

  var fetchPromise = fetchCloser();
  var animPromise = new Promise(function(res){
    startAlgoAnimation(st.segKey, st.subKey, st.rawValue, res);
  });

  await Promise.all([animPromise, fetchPromise]);
  document.getElementById('algoAnim').style.display='none';
  if (st.noAvailability) {
    document.getElementById('cSpecific').style.display='none';
    document.getElementById('c1').classList.remove('dimmed');
    var verAgenda = document.getElementById('btnVerAgenda');
    if (verAgenda) verAgenda.style.display = '';   // caso normal: mantém "Ver agenda normal"
    document.getElementById('noAvailBanner').classList.add('show');
    document.getElementById('slotsGrid').innerHTML='';
    return;
  }
  // modo específico: já foi pro Passo 3 via doReserveSpecific, não abre c2
  if (st.schedulingMode === 'specific' && st.specificSlotStart) return;
  document.getElementById('c2').style.display='';
  document.getElementById('c2').classList.remove('dimmed');
  document.getElementById('anonSub').textContent=SEGS[st.segKey].label+' · '+st.subLabel;
  var btnReject = document.getElementById('btnRejectAgenda');
  if (btnReject) btnReject.style.display = (st.schedulingMode === 'specific' && st.specificSlotStart) ? 'none' : '';
}

// Escolha ativa do modo de agendamento. Sem default: enquanto st.schedulingMode
// for null, o "Continuar →" fica bloqueado. Não persiste em lugar nenhum → F5,
// restore e nova opp nascem sem seleção (sem legado).
export function selectSchedulingMode(mode) {
  st.schedulingMode = mode;
  document.getElementById('modeSlots').classList.toggle('selected', mode === 'slots');
  document.getElementById('modeSpecific').classList.toggle('selected', mode === 'specific');
  document.getElementById('noAvailBanner').classList.remove('show');
  document.getElementById('btnS1').textContent = 'Continuar →';
  if (mode !== 'specific') {
    document.getElementById('slotDate').value = '';
    document.getElementById('slotTime').value = '';
    st.specificSlotStart = null;
  }
  updateStep1Button();
}

export function validateSlotPicker() {
  const date = document.getElementById('slotDate').value;
  const time = document.getElementById('slotTime').value;
  const warn = document.getElementById('specificWarn');
  const btn  = document.getElementById('btnSpecific');

  if (date && time) {
    st.specificSlotStart = date + 'T' + time + ':00-03:00';
    // Fora da janela 10h–17h BRT → vai direto ao Mercado (sem rodar o algoritmo)
    const [h, m] = time.split(':').map(Number);
    const totalMin = h * 60 + m;
    st.specificOutOfWindow = (totalMin < 10 * 60 || totalMin >= 17 * 60);
    if (st.specificOutOfWindow) {
      warn.textContent = 'Horário fora da janela de atendimento (10h–17h) — o lead irá ao Mercado.';
      warn.style.display = 'block';
    } else {
      warn.style.display = 'none';
    }
  } else {
    st.specificSlotStart = null;
    st.specificOutOfWindow = false;
    warn.style.display = 'none';
  }
  if (btn) btn.disabled = !st.specificSlotStart;
}

export function clearSlotAndRetry() {
  selectSchedulingMode('slots');
  runAlgorithm();
}

export async function goEmergencyPool() {
  // Popula state a partir dos inputs caso goStep2 não tenha rodado
  // (cenário: SDR selecionou horário fora da janela sem passar pelo Step 2)
  if (!st.leadId) {
    st.leadId = document.getElementById('leadIdInput').value.trim();
  }
  if (!st.clientEmail) {
    st.clientEmail = document.getElementById('clientEmailInput').value.trim();
  }
  if (!st.subKey) {
    const r = classify(st.rawValue);
    if (r) {
      st.segKey   = r.segKey;
      st.subKey   = r.subKey;
      st.subLabel = r.subLabel;
    }
  }

  if (!st.leadId || !st.subKey) {
    showToast('Preencha o formulário completo antes de enviar ao Mercado.', 'error', 4000);
    return;
  }

  try {
    // Só verifica disponibilidade se há um horário específico selecionado
    if (st.specificSlotStart) {
      showToast('Verificando disponibilidade...', 'info', 3000);
      const checkPayload = {
        lead_id:     st.leadId,
        clientValue: st.rawValue,
        segmentKey:  st.segKey,
        subgroupKey: st.subKey,
        mode:        'specific_date',
        slotStart:   st.specificSlotStart
      };
      const checkRes = await authFetch(API.algorithm, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkPayload)
      });
      const checkData = await checkRes.json();

      // Se encontrou closer disponível, bloqueia mercado e atribui
      if (!checkData.no_availability && checkData.closerId) {
        document.getElementById('noAvailBanner').classList.remove('show');
        showToast('Closer disponível encontrado — redirecionando para agendamento.', 'info', 5000);
        st.closerId   = checkData.closerId;
        st.closerName = checkData.closerName || '';
        st.queue      = checkData.queue || [];
        st.noAvailability = false;
        await doReserveSpecific();
        return;
      }
    }

    // Sem closer disponível ou sem horário específico — vai direto pro pool
    const payload = {
      leadId:      st.leadId,
      clientValue: st.rawValue,
      clientEmail: st.clientEmail || '',
      subgroup:    st.subKey,
      slotStart:   st.specificSlotStart || '',
      sdrEmail:    session ? session.email : ''
    };
    const r = await authFetch(API.poolAdd, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (d.success !== false) {
      document.getElementById('noAvailBanner').classList.remove('show');
      showToast('Lead enviado ao Emergency Pool. Closers serão notificados.', 'success', 5000);
    } else {
      showToast('Erro ao enviar para o pool.', 'error', 4000);
    }
  } catch(e) {
    showToast('Erro: ' + e.message, 'error', 4000);
  }
}

export async function fetchCloser() {
  setLoading();
  document.getElementById('noAvailBanner').classList.remove('show');

  try {
    console.log('[DEBUG fetchCloser] schedulingMode:', st.schedulingMode, '| specificSlotStart:', st.specificSlotStart);
    const payload = {
      lead_id: st.leadId,
      clientValue: st.rawValue,
      segmentKey: st.segKey,
      subgroupKey: st.subKey,
      mode: st.schedulingMode === 'specific' ? 'specific_date' : 'schedule',
      competitor: st.competitor || ''
    };
    if (payload.mode === 'specific_date') payload.slotStart = st.specificSlotStart;
    const r=await authFetch(API.algorithm,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json(); if(d.error) throw new Error(d.error);
    if (d.no_availability || d.fallback === 'emergency') {
      st.noAvailability = true;
      // Atualiza título do banner conforme o motivo
      var title = document.getElementById('noAvailTitle');
      if (title) {
        title.textContent = d.fallback === 'emergency'
          ? 'Nenhum closer disponível neste segmento'
          : 'Nenhum closer disponível neste horário';
      }
      return;
    }
    st.noAvailability = false;
    st.closerId=d.closerId; st.closerName=d.closerName||''; st.queue=d.queue||[];
    st.campaignActive = d.campaignActive || false;
    console.log('[DEBUG] schedulingMode:', st.schedulingMode, 'specificSlotStart:', st.specificSlotStart);
    if (st.schedulingMode === 'specific' && st.specificSlotStart) {
      console.log('[DEBUG] chamando doReserveSpecific');
      await doReserveSpecific();
    } else {
      console.log('[DEBUG] chamando fetchSlots');
      await fetchSlots();
    }
  } catch(e) {
    st.noAvailability = false;
    document.getElementById('slotsGrid').innerHTML='<div class="slot-empty">Erro ao buscar closer: '+e.message+'</div>';
  }
}

export async function fetchSlots() {
  setLoading(); updateCalHeader();
  try {
    const r=await authFetch(API.slots,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({closerId:st.closerId,weekOffset:st.weekOffset})});
    const raw=await r.json();
    const d = Array.isArray(raw) ? raw[0] : raw;
    if(d.error) throw new Error(d.error);
    st.agendaEvents = d.events || [];   // eventos ocupados anonimizados (visão Agenda/Completa)
    var allSlots = (d.slots||[]).map(function(s){
      // displayStart é o horário de reunião (sem o tempo de preparação); start/end (slotStart/slotEnd)
      // são o bloco total reservado de fato, usados no /reserve.
      var displayStartRaw = s.displayStart || s.slotStart;
      var displayStart = new Date(displayStartRaw);
      var end   = new Date(s.slotEnd);
      var opts  = {timeZone:'America/Sao_Paulo'};
      var dateStr = displayStart.toLocaleDateString('pt-BR',Object.assign({},opts,{day:'2-digit',month:'2-digit'}));
      var timeStr = displayStart.toLocaleTimeString('pt-BR',Object.assign({},opts,{hour:'2-digit',minute:'2-digit',hour12:false}));
      var endStr  = end.toLocaleTimeString('pt-BR',Object.assign({},opts,{hour:'2-digit',minute:'2-digit',hour12:false}));
      var weekdayFull = displayStart.toLocaleDateString('pt-BR',Object.assign({},opts,{weekday:'long'})).toLowerCase();
      var weekdayShort = displayStart.toLocaleDateString('pt-BR',Object.assign({},opts,{weekday:'short'}));
      var hourBRT = parseInt(displayStart.toLocaleTimeString('pt-BR',Object.assign({},opts,{hour:'2-digit',hour12:false})));
      if (hourBRT < 10 || hourBRT > 17) return null;
      var period = hourBRT < 12 ? 'manha' : 'tarde';
      var dayKey = weekdayFull.startsWith('seg') ? 'seg' :
                   weekdayFull.startsWith('ter') ? 'ter' :
                   weekdayFull.startsWith('qua') ? 'qua' :
                   weekdayFull.startsWith('qui') ? 'qui' :
                   weekdayFull.startsWith('sex') ? 'sex' : 'other';
      return {
        id:      s.slotId,
        start:   s.slotStart,
        end:     s.slotEnd,
        day:     weekdayShort,
        date:    dateStr,
        time:    timeStr + ' – ' + endStr,
        label:   dateStr + ' ' + timeStr + (s.type==='slot' ? ' (Slot)' : ''),
        type:    s.type,
        dayKey:  dayKey,
        period:  period
      };
    });
    st.allSlots = allSlots.filter(function(s){ return s !== null; });
    st.filterDay = st.filterDay || 'all';
    st.filterPeriod = st.filterPeriod || 'all';

    applySlotFilters(); renderRefused(); renderQueueHint();
    if (st.slotView === 'full') renderAgenda();
  } catch(e) { document.getElementById('slotsGrid').innerHTML='<div class="slot-empty">Erro ao buscar agenda: '+e.message+'</div>'; }
}

function setLoading() {
  document.getElementById('slotsGrid').innerHTML='<div class="slot-loading"><div class="spinner"></div> Buscando disponibilidade...</div>';
  document.getElementById('btnConfirm').disabled=true;
  document.getElementById('confirmBox').style.display='none';
  st.selectedSlotId=null;
}

function updateCalHeader() {
  const mon=getMon(st.weekOffset); const fri=new Date(mon); fri.setDate(mon.getDate()+4);
  const fmt=d=>d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  document.getElementById('calHead').textContent=fmt(mon)+' – '+fmt(fri);
}

export function renderSlots(slots) {
  const g=document.getElementById('slotsGrid');
  if (!slots.length) { g.innerHTML='<div class="slot-empty">Sem slots disponíveis nesta semana.</div>'; return; }
  g.innerHTML='';
  slots.forEach(function(s){
    const btn=document.createElement('button');
    var isSlot = s.type === 'slot';
    btn.className='slot-btn' + (isSlot ? ' is-slot' : ''); btn.setAttribute('role','listitem');
    btn.innerHTML=
      '<span class="slot-badge ' + (isSlot ? 'slot-badge-slot' : 'slot-badge-free') + '">' + (isSlot ? 'Slot' : 'Janela livre') + '</span>' +
      '<span class="slot-day">'+s.day+' '+s.date+'</span>' +
      '<span class="slot-time">'+s.time+'</span>';
    btn.onclick=function(){ selectSlot(btn,s); };
    g.appendChild(btn);
  });
}

export function selectSlot(el,s) {
  document.querySelectorAll('.slot-btn').forEach(function(b){ b.classList.remove('selected'); });
  el.classList.add('selected');
  st.selectedSlotId=s.id; st.selectedSlotLabel=s.label;
  st.selectedSlotStart=s.start; st.selectedSlotEnd=s.end;
  document.getElementById('cfLeadId').textContent=st.leadId||'—';
  document.getElementById('cfClientEmail').textContent=st.clientEmail||'—';
  document.getElementById('cfSeg').textContent=SEGS[st.segKey].label;
  document.getElementById('cfSub').textContent=st.subLabel;
  document.getElementById('cfSlot').textContent=s.label;
  document.getElementById('cfVal').textContent=fmtBRL(st.rawValue);
  document.getElementById('confirmBox').style.display='block';
  document.getElementById('btnConfirm').disabled=false;
}

export function applySlotFilters() {
  var filtered = (st.allSlots || []).filter(function(s) {
    if (st.filterDay !== 'all' && s.dayKey !== st.filterDay) return false;
    if (st.filterPeriod !== 'all' && s.period !== st.filterPeriod) return false;
    return true;
  });
  renderSlots(filtered);
}

export function setFilterDay(val, btn) {
  st.filterDay = val;
  document.querySelectorAll('#filterDayBtns .filter-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  applySlotFilters();
}

export function setFilterPeriod(val, btn) {
  st.filterPeriod = val;
  btn.closest('.slots-filter-btns').querySelectorAll('.filter-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  applySlotFilters();
}

export async function rejectAgenda(){
  if(!st.queue.length){ alert('Não há mais closers disponíveis neste segmento.'); return; }
  // Registra o pulo antes de trocar o closer
  try {
    await authFetch(API.skip, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sdrEmail:         session ? session.email : '',
        skippedCloserId:  st.closerId,
        slots:            st.allSlots || []
      })
    });
  } catch(e) {
    console.warn('[skip] Erro ao registrar pulo:', e.message);
  }
  st.refused.push(st.closerId); st.closerId=st.queue.shift(); st.weekOffset=0;
  fetchSlots(); renderRefused(); renderQueueHint();
}

export function renderRefused(){
  const log=document.getElementById('refusedLog'); const items=document.getElementById('refusedItems');
  if(!st.refused.length){ log.style.display='none'; return; }
  log.style.display='block';
  items.innerHTML=st.refused.map(function(_,i){ return '<div class="refused-item">→ Closer '+(i+1)+' — agenda indisponível</div>'; }).join('');
}

export function renderQueueHint(){
  const el=document.getElementById('queueInfo');
  el.textContent=st.queue.length>0?'↻ '+st.queue.length+' closer(s) na fila':'';
}

export async function doReserveSpecific() {
  // Monta slotEnd = slotStart + 1h30
  const start = new Date(st.specificSlotStart);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  st.selectedSlotId    = 'specific_' + start.toISOString();
  st.selectedSlotStart = st.specificSlotStart;
  st.selectedSlotEnd   = end.toISOString();
  st.selectedSlotLabel = start.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
  try {
    const res = await authFetch(API.reserve, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closerId:    st.closerId,
        slotId:      st.selectedSlotId,
        slotStart:   st.selectedSlotStart,
        slotEnd:     st.selectedSlotEnd,
        leadId:      st.leadId,
        clientEmail: st.clientEmail,
        clientValue: st.rawValue,
        segmentKey:  st.segKey,
        subgroupKey: st.subKey,
        sdrEmail:    session ? session.email : '',
        ts:          new Date().toISOString()
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showReservationState(data);
  } catch(e) {
    showToast('Erro ao reservar: ' + e.message, 'error', 5000);
  }
}

export async function doReserve(){
  const btn = document.getElementById('btnConfirm');
  btn.disabled = true; btn.textContent = 'Reservando...';
  try {
    const res = await authFetch(API.reserve, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closerId:    st.closerId,
        slotId:      st.selectedSlotId,
        slotStart:   st.selectedSlotStart,
        slotEnd:     st.selectedSlotEnd,
        leadId:      st.leadId,
        clientEmail: st.clientEmail,
        clientValue: st.rawValue,
        segmentKey:  st.segKey,
        subgroupKey: st.subKey,
        sdrEmail:    session ? session.email : '',
        ts:          new Date().toISOString()
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showReservationState(data);
  } catch(e) {
    showToast('Erro ao reservar: ' + e.message, 'error', 5000);
    btn.disabled = false; btn.textContent = 'Reservar horário';
  }
}

export function showReservationState(data) {
  document.getElementById('c1').style.display = 'none';
  document.getElementById('c2').style.display = 'none';
  document.querySelector('.steps').style.display = 'none';
  document.getElementById('resvLeadId').textContent  = st.leadId || '—';
  document.getElementById('resvCloser').textContent  = '****';
  document.getElementById('resvSlot').textContent    = st.selectedSlotLabel || '—';
  document.getElementById('resvSeg').textContent     = SEGS[st.segKey].label + ' · ' + st.subLabel;
  document.getElementById('resvVal').textContent     = fmtBRL(st.rawValue);
  document.getElementById('resvSub').textContent     = st.selectedSlotLabel + ' · ' + fmtBRL(st.rawValue);
  st.tempEventId = data.tempEventId;
  reservationExpiresAt = Date.now() + (24 * 60 * 60 * 1000);
  startReservationTimer();
  document.getElementById('reservationState').style.display = 'block';
  showToast('Horário reservado com sucesso', 'success');
}

export function startReservationTimer() {
  if (reservationTimer) clearInterval(reservationTimer);
  function tick() {
    var remaining = reservationExpiresAt - Date.now();
    if (remaining <= 0) {
      clearInterval(reservationTimer);
      document.getElementById('timerLabel').textContent = 'Expirada';
      document.getElementById('timerFill').style.width = '0%';
      showToast('Reserva expirada — o slot foi liberado automaticamente', 'info', 6000);
      return;
    }
    var totalMs = 24 * 60 * 60 * 1000;
    var pct     = (remaining / totalMs) * 100;
    var hours   = Math.floor(remaining / (60 * 60 * 1000));
    var minutes = Math.floor((remaining % (60 * 60 * 1000)) / 60000);
    document.getElementById('timerLabel').textContent = hours + 'h ' + String(minutes).padStart(2,'0') + 'm';
    document.getElementById('timerFill').style.width = pct + '%';
  }
  tick();
  reservationTimer = setInterval(tick, 60000);
}

export async function doConfirmFinal(){
  var btn = document.querySelector('.btn-confirm-final');
  btn.disabled = true; btn.textContent = 'Confirmando...';
  if (reservationTimer) clearInterval(reservationTimer);
  try {
    const res = await authFetch(API.confirm, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closerId:      st.closerId,
        slotId:        st.selectedSlotId,
        slotStart:     st.selectedSlotStart,
        slotEnd:       st.selectedSlotEnd,
        tempEventId:   st.tempEventId,
        leadId:        st.leadId,
        clientEmail:   st.clientEmail,
        clientValue:   st.rawValue,
        segmentKey:    st.segKey,
        subgroupKey:   st.subKey,
        sdrEmail:      session ? session.email : '',
        ts:            new Date().toISOString(),
        mode:          st.schedulingMode === 'specific' ? 'specific_date' : 'schedule',
        competitor:    st.competitor || '',
        campaignActive: st.campaignActive || false
      })
    });
    const raw = await res.json();
    const data = Array.isArray(raw) ? raw[0] : raw;
    if (data.error) throw new Error(data.error);
    document.getElementById('reservationState').style.display = 'none';
    showSuccess(data);
  } catch(e) {
    showToast('Erro ao confirmar: ' + e.message, 'error', 5000);
    btn.disabled = false; btn.textContent = 'Cliente confirmou';
  }
}

export async function doCancelReserve(){
  var btn = document.querySelector('.btn-cancel-reserve');
  btn.disabled = true; btn.textContent = 'Cancelando...';
  if (reservationTimer) clearInterval(reservationTimer);
  try {
    const res = await authFetch(API.cancelReserve, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closerId:    st.closerId,
        slotId:      st.selectedSlotId,
        slotStart:   st.selectedSlotStart,
        slotEnd:     st.selectedSlotEnd,
        tempEventId: st.tempEventId,
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showToast('Reserva cancelada — slot liberado', 'info');
    resetAll();
  } catch(e) {
    showToast('Erro ao cancelar: ' + e.message, 'error', 5000);
    btn.disabled = false; btn.textContent = 'Cancelar reserva';
  }
}


export function showSuccess(data){
  document.getElementById('c1').style.display='none';
  document.getElementById('c2').style.display='none';
  document.querySelector('.steps').style.display='none';

  /* Foto: prioridade → API → mapa local → pool aleatório */
  var photo = data.closerPhoto || getCloserPhoto(st.closerId);
  var name  = data.closerName || '—';

  var imgEl = document.getElementById('revPhoto');
  var initEl = document.getElementById('revInitials');
  if (photo) {
    imgEl.src = photo;
    imgEl.alt = name;
    imgEl.style.display = 'block';
    initEl.style.display = 'none';
  } else {
    initEl.textContent = name[0].toUpperCase();
    initEl.style.display = 'flex';
    imgEl.style.display = 'none';
  }

  document.getElementById('revName').textContent = name;
  document.getElementById('revNameAlert').textContent = name;
  document.getElementById('revRole').textContent = SEGS[st.segKey].label + ' · ' + st.subLabel;
  document.getElementById('succSub').textContent = st.selectedSlotLabel + ' · ' + fmtBRL(st.rawValue);
  document.getElementById('successState').style.display = 'block';
}

export function resetAll(){
  Object.assign(st, {rawValue:0,leadId:null,clientEmail:null,segKey:null,subKey:null,subLabel:null,competitor:null,campaignActive:false,
      closerId:null,queue:[],refused:[],weekOffset:0,
      selectedSlotId:null,selectedSlotLabel:null,selectedSlotStart:null,selectedSlotEnd:null,
      tempEventId:null,schedulingMode:null,specificSlotStart:null,specificOutOfWindow:false});
  ['leadIdInput','clientEmailInput'].forEach(function(id){ document.getElementById(id).value=''; document.getElementById(id).classList.remove('error'); });
  var compEl = document.getElementById('competitorInput'); if(compEl) { compEl.value=''; compEl.classList.remove('error'); }
  document.getElementById('valInput').value='';
  // Zera a escolha de modo de agendamento — sem seleção, sem legado entre opps
  document.getElementById('modeSlots').classList.remove('selected');
  document.getElementById('modeSpecific').classList.remove('selected');
  document.getElementById('cSpecific').style.display='none';
  document.getElementById('slotDate').value = '';
  document.getElementById('slotTime').value = '';
  var sWarn = document.getElementById('specificWarn'); if (sWarn) sWarn.style.display='none';
  var bSpec = document.getElementById('btnSpecific'); if (bSpec) bSpec.disabled = true;
  var bVer = document.getElementById('btnVerAgenda'); if (bVer) bVer.style.display = '';
  var bS1 = document.getElementById('btnS1'); if (bS1) bS1.textContent = 'Continuar →';
  setSlotView('compact');
  document.getElementById('noAvailBanner').classList.remove('show');
  document.getElementById('leadIdError').style.display='none';
  document.getElementById('clientEmailError').style.display='none';
  updateTag();
  if (reservationTimer) clearInterval(reservationTimer);
  document.getElementById('reservationState').style.display='none';
  document.getElementById('algoAnim').style.display='none';
  ['c1','c2'].forEach(function(id){ var e=document.getElementById(id); e.style.display=''; });
  document.getElementById('c2').style.display='none';
  document.getElementById('c1').classList.remove('dimmed');
  document.getElementById('c2').classList.add('dimmed');
  document.getElementById('successState').style.display='none';
  document.getElementById('confirmBox').style.display='none';
  document.getElementById('refusedLog').style.display='none';
  document.getElementById('btnConfirm').disabled=true;
  document.getElementById('btnConfirm').textContent='Confirmar agendamento';
  var btnFinal = document.querySelector('.btn-confirm-final');
  if (btnFinal) { btnFinal.disabled = false; btnFinal.textContent = 'Cliente confirmou'; }
  document.getElementById('queueInfo').textContent='';
  document.querySelector('.steps').style.display='';
  [['b1','l1',1],['b2','l2',2],['b3','l3',3]].forEach(function(arr){
    var b=document.getElementById(arr[0]); b.className='step-dot'+(arr[2]===1?' active':''); b.textContent=arr[2];
    document.getElementById(arr[1]).className='step-label'+(arr[2]===1?' active':'');
  });
  ['conn1','conn2'].forEach(function(id){ document.getElementById(id).classList.remove('done'); });
}

export function onCompetitorChange() {
  var val = document.getElementById('competitorInput').value;
  if (val) {
    document.getElementById('competitorError').style.display = 'none';
    document.getElementById('competitorInput').classList.remove('error');
  }
  st.competitor = val;
}

