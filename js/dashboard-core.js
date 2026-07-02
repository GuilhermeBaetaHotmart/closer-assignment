/* ══════════════════════════════════════════════
   dashboard-core.js — Visão geral do Dashboard Admin. Equivalente ao Fluxo 11 (dashboard).
   ══════════════════════════════════════════════ */


import { API, SEGS } from './api.js?v=20260702-1332';
import { session, st } from './state.js?v=20260702-1332';
import { classify, fmtBRL, getCloserPhoto, getMon } from './utils.js?v=20260702-1332';
import { authFetch } from './auth.js?v=20260702-1332';
import { toggleCloser } from './closers.js?v=20260702-1332';

import { showToast } from './ui.js?v=20260702-1332';

let currentPeriod = 'all';
let currentSegment = 'all';
let chartInstance = null;

export function setPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  var customEl = document.getElementById('periodCustom');
  if (period === 'custom') { customEl.classList.add('visible'); return; }
  customEl.classList.remove('visible');
  loadDashboard();
}

export function setSegFilter(seg, btn) {
  currentSegment = seg;
  document.querySelectorAll('.seg-filter-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  loadDashboard();
}

export async function loadDashboard(){
  var ld6='<tr><td colspan="6" class="table-empty"><div style="display:flex;align-items:center;justify-content:center;gap:8px"><div class="spinner"></div> Carregando...</div></td></tr>';
  var ld7='<tr><td colspan="7" class="table-empty"><div style="display:flex;align-items:center;justify-content:center;gap:8px"><div class="spinner"></div> Carregando...</div></td></tr>';
  ['tbodySMB','tbodyMID','tbodyENT'].forEach(function(id){ document.getElementById(id).innerHTML=ld6; });
  document.getElementById('historyTableBody').innerHTML=ld7;

  // Build query params
  var params = 'period=' + currentPeriod;
  if (currentSegment !== 'all') params += '&segment=' + currentSegment;
  if (currentPeriod === 'custom') {
    var from = document.getElementById('periodFrom').value;
    var to   = document.getElementById('periodTo').value;
    if (from) params += '&from=' + from + 'T00:00:00.000Z';
    if (to)   params += '&to='   + to   + 'T23:59:59.999Z';
  }

  try {
    const r = await authFetch(API.dashboard + '?' + params);
    const d = await r.json();
    renderDashboard(d);
  } catch(e){
    ['tbodySMB','tbodyMID','tbodyENT'].forEach(function(id){ document.getElementById(id).innerHTML='<tr><td colspan="6" class="table-empty">Erro: '+e.message+'</td></tr>'; });
  }
}

function renderChart(series, period) {
  var canvas  = document.getElementById('opsChart');
  var emptyEl = document.getElementById('chartEmpty');
  var granEl  = document.getElementById('chartGranLabel');

  var granLabels = { day:'por dia', month:'por mês' };
  granEl.textContent = granLabels[series.granularity] || '';

  if (!series.labels || series.labels.length === 0) {
    emptyEl.style.display = 'flex';
    canvas.style.display  = 'none';
    return;
  }
  emptyEl.style.display = 'none';
  canvas.style.display  = 'block';

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [{
        label: 'Opps atribuídas',
        data: series.values,
        borderColor: '#FF4800',
        backgroundColor: 'rgba(255,72,0,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#FF4800',
        pointBorderColor: '#FF4800',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(13,13,26,0.95)',
          borderColor: 'rgba(255,72,0,0.3)',
          borderWidth: 1,
          titleColor: document.body.classList.contains('light') ? '#1A1828' : '#F0EDF8',
          bodyColor: '#FF4800',
          padding: 10,
          callbacks: {
            label: function(ctx) { return ' ' + ctx.parsed.y + ' opp' + (ctx.parsed.y !== 1 ? 's' : ''); }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#62607A', font: { family: 'DM Sans', size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#62607A',
            font: { family: 'DM Sans', size: 11 },
            stepSize: 1,
            callback: function(v) { return Number.isInteger(v) ? v : ''; }
          }
        }
      }
    }
  });
}

function renderDashboard(data){
  const closers=data.closers||[]; const history=data.history||[];
  const summary=data.summary||{}; const series=data.series||{};
  const segCls={SMB:'seg-smb',MID:'seg-mid',ENT:'seg-ent'};

  // Apply segment filter client-side
  const filteredClosers = currentSegment === 'all'
    ? closers
    : closers.filter(function(c) { return c.segment === currentSegment; });
  const filteredHistory = currentSegment === 'all'
    ? history
    : history.filter(function(h) { return h.segment === currentSegment; });

  // Recompute summary for filtered segment
  const filteredTotal = filteredClosers.reduce(function(s,c){ return s + c.opps_total; }, 0);

  // Period label
  var periodLabels = { all:'Distribuição acumulada', day:'Hoje', week:'Últimos 7 dias', month:'Últimos 30 dias', custom:'Período personalizado' };
  document.getElementById('periodLabel').textContent = periodLabels[data.period] || 'Distribuição acumulada';

  // KPIs — use filtered values
  document.getElementById('dTotalClosers').textContent=filteredClosers.filter(function(c){return c.active;}).length;
  document.getElementById('dTotalOpps').textContent=filteredTotal;
  document.getElementById('dTotalHistory').textContent=filteredHistory.length;
  document.getElementById('dAvgOpps').textContent=filteredClosers.length>0?(filteredTotal/filteredClosers.length).toFixed(1):'0';

  // Chart — filter series by segment if needed (rebuild from filteredHistory)
  var chartSeries = series;
  if (currentSegment !== 'all' && filteredHistory.length > 0) {
    var sMap = {};
    filteredHistory.forEach(function(h) {
      if (!h.ts || h.ts === '—') return;
      var gran = series.granularity || 'month';
      var d2 = new Date(h.ts);
      var key;
      if (gran === 'day') {
        key = d2.getFullYear() + '-' + String(d2.getMonth()+1).padStart(2,'0') + '-' + String(d2.getDate()).padStart(2,'0');
      } else {
        key = d2.getFullYear() + '-' + String(d2.getMonth()+1).padStart(2,'0');
      }
      sMap[key] = (sMap[key] || 0) + 1;
    });
    var sKeys = Object.keys(sMap).sort();
    chartSeries = { labels: sKeys, values: sKeys.map(function(k){ return sMap[k]; }), granularity: series.granularity };
  }
  renderChart(chartSeries, data.period);

  // Seg stats — use filteredClosers
  ['SMB','MID','ENT'].forEach(function(seg){
    var sc=filteredClosers.filter(function(c){ return c.segment===seg; });
    var so=sc.reduce(function(s,c){ return s+c.opps_total; },0);
    var sa=sc.length>0?(so/sc.length).toFixed(1):'0';
    var pfx=seg==='SMB'?'Smb':seg==='MID'?'Mid':'Ent';
    document.getElementById('d'+pfx+'Closers').textContent=sc.filter(function(c){ return c.active; }).length;
    document.getElementById('d'+pfx+'Opps').textContent=so;
    document.getElementById('d'+pfx+'Avg').textContent=sa;
  });

  // Tables
  var segCfg={
    SMB:{tbody:'tbodySMB',subs:['SMB-1','SMB-2','SMB-3']},
    MID:{tbody:'tbodyMID',subs:['MID-1','MID-2','MID-3']},
    ENT:{tbody:'tbodyENT',subs:['ENT-1','ENT-2','ENT-3']}
  };

  Object.keys(segCfg).forEach(function(seg){
    var cfg=segCfg[seg];
    var sc=filteredClosers.filter(function(c){ return c.segment===seg; });
    var maxTotal=Math.max.apply(null,sc.map(function(c){ return c.opps_total; }).concat([1]));
    var tbody=document.getElementById(cfg.tbody);
    if(!sc.length){ tbody.innerHTML='<tr><td colspan="6" class="table-empty">Nenhum closer cadastrado neste segmento.</td></tr>'; return; }

    tbody.innerHTML=sc.map(function(c){
      var barPct=Math.max(4,Math.round((c.opps_total/maxTotal)*100));
      var subCells=cfg.subs.map(function(sk){
        var v=(c.subgroups||{})[sk]||0;
        var subMax=Math.max.apply(null,sc.map(function(x){ return (x.subgroups||{})[sk]||0; }).concat([1]));
        var pct=Math.round((v/subMax)*100);
        return '<td class="center">' +
          '<span class="sub-count '+(v===0?'zero':'has-val')+'">'+v+'</span>' +
          '<div class="sub-mini-bar"><div class="sub-mini-fill" style="width:'+pct+'%"></div></div>' +
          '</td>';
      }).join('');

      var isActive = c.active;
      var toggleId = 'tog_' + c.email.replace(/[@.]/g,'_');
      var toggleHtml =
        '<label class="seg-toggle" onclick="toggleCloser(\''+c.email+'\',\''+toggleId+'\')" title="'+(isActive?'Desativar':'Ativar')+' closer">' +
          '<div class="seg-toggle-track '+(isActive?'on':'off')+'" id="'+toggleId+'">' +
            '<div class="seg-toggle-thumb"></div>' +
          '</div>' +
          '<span class="seg-toggle-label">'+(isActive?'Ativo':'Inativo')+'</span>' +
        '</label>';

      var normalRow = '<tr>' +
        '<td><span class="closer-cell-name">'+(c.name||c.email)+'</span><span class="closer-cell-email">'+c.email+'</span></td>' +
        '<td>'+toggleHtml+'</td>' +
        '<td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:'+barPct+'%"></div></div><span class="bar-num">'+c.opps_total+'</span></div></td>' +
        subCells+'</tr>';

      var campRow = '';
      if ((c.campaign_total||0) > 0) {
        var campSubCells = cfg.subs.map(function(sk){
          var v=(c.camp_subgroups||{})[sk]||0;
          return '<td class="center"><span class="sub-count '+(v===0?'zero':'has-val')+'" style="color:var(--blue);font-size:13px;">'+v+'</span></td>';
        }).join('');
        campRow = '<tr style="background:rgba(68,208,255,0.04);">' +
          '<td style="padding:6px 20px;"><span style="font-size:11px;color:var(--blue);font-weight:600;">↳ Campanhas</span></td>' +
          '<td></td>' +
          '<td><div class="bar-cell"><span class="bar-num" style="color:var(--blue);font-size:14px;">'+c.campaign_total+'</span></div></td>' +
          campSubCells+'</tr>';
      }

      return normalRow + campRow;
    }).join('');
  });

  // History
  var hb=document.getElementById('historyTableBody');
  if(!filteredHistory.length){ hb.innerHTML='<tr><td colspan="9" class="table-empty">Nenhum agendamento registrado.</td></tr>'; return; }
  hb.innerHTML=filteredHistory.map(function(h){
    var ts=h.ts&&h.ts!=='—'?new Date(h.ts).toLocaleString('pt-BR'):'—';
    var val=h.client_value&&h.client_value!=='—'?'R$ '+parseInt(h.client_value).toLocaleString('pt-BR'):'—';
    var sdrLabel = h.sdr && h.sdr !== '—' ? h.sdr.split('@')[0].replace(/\./g,' ').replace(/\b\w/g, function(c){return c.toUpperCase();}) : '—';
    return '<tr>'+
      '<td style="font-size:11px;white-space:nowrap">'+ts+'</td>'+
      '<td><strong style="font-family:\'Space Grotesk\',sans-serif;font-size:12px">'+(h.closer_name||h.closer_email)+'</strong></td>'+
      '<td style="font-size:11px;color:var(--txt-2)">'+sdrLabel+'</td>'+
      '<td><span class="seg-pill '+(segCls[h.segment]||'')+'">'+(h.segment||'—')+'</span></td>'+
      '<td style="font-size:11px;color:var(--txt-3)">'+(h.subgroup||'—')+'</td>'+
      '<td style="font-family:monospace;font-size:11px;color:var(--txt-3)">'+(h.lead_id||'—')+'</td>'+
      '<td style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:13px">'+val+'</td>'+
      '<td style="font-size:11px;color:var(--txt-2)">'+(function(s){ if(!s||s==='—') return '—'; var d=new Date(s); return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); })(h.slot)+'</td>'+
      '<td>'+(function(m){ var labels={schedule:'<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,0.06);color:var(--txt-3)">Agenda</span>',specific_date:'<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;background:rgba(255,92,0,0.12);color:var(--org)">Horário fixo</span>',pool:'<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;background:rgba(72,180,255,0.12);color:#48b4ff">Mercado</span>'}; return labels[m]||'<span style="font-size:10px;color:var(--txt-3)">'+m+'</span>'; })(h.mode||'schedule')+'</td>'+
      '</tr>';
  }).join('');
}

