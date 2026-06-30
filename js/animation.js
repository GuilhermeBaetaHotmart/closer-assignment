/* ══════════════════════════════════════════════
   animation.js — Animações decorativas
   Animação de fundo do login (partículas) e
   animação de "escolhendo o closer" do algoritmo.
   Autocontido — não depende de outros módulos.
   ══════════════════════════════════════════════ */

/* ── Animação de fundo da tela de login ───────── */
(function() {
  var cv = document.getElementById('loginCanvas');
  if (!cv) return;
  var cx = cv.getContext('2d');
  var W, H, nodes, raf;
  function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
  function init() {
    nodes = [];
    for (var i = 0; i < 55; i++) {
      nodes.push({ x: Math.random()*W, y: Math.random()*H,
                   vx: (Math.random()-.5)*.35, vy: (Math.random()-.5)*.35,
                   r: Math.random()*1.8+.8 });
    }
  }
  function draw() {
    cx.clearRect(0,0,W,H);
    for (var i=0;i<nodes.length;i++) {
      for (var j=i+1;j<nodes.length;j++) {
        var dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y;
        var d=Math.sqrt(dx*dx+dy*dy);
        if (d<130) {
          cx.beginPath();
          cx.strokeStyle='rgba(255,72,0,'+(0.16*(1-d/130))+')';
          cx.lineWidth=.5;
          cx.moveTo(nodes[i].x,nodes[i].y);
          cx.lineTo(nodes[j].x,nodes[j].y);
          cx.stroke();
        }
      }
      cx.beginPath();
      cx.arc(nodes[i].x,nodes[i].y,nodes[i].r,0,Math.PI*2);
      cx.fillStyle='rgba(255,72,0,.45)';
      cx.fill();
      nodes[i].x+=nodes[i].vx; nodes[i].y+=nodes[i].vy;
      if(nodes[i].x<0||nodes[i].x>W) nodes[i].vx*=-1;
      if(nodes[i].y<0||nodes[i].y>H) nodes[i].vy*=-1;
    }
    raf=requestAnimationFrame(draw);
  }
  resize(); init(); draw();
  window.addEventListener('resize', function(){ resize(); init(); });
})();

/* ── Animação "escolhendo o closer" (algoritmo) ── */
var aRaf=null;
var ALGO_CFGS={
  SMB:{color:'#FFD450',label:'N2-N3',subs:['Grupo 1\n100–300k','Grupo 2\n300–600k','Grupo 3\n600k+']},
  MID:{color:'#44D0FF',label:'N4-N5',subs:['Grupo 1\n1M–2M','Grupo 2\n2M–3M','Grupo 3\n3M+']},
  ENT:{color:'#B48EFF',label:'N6+',  subs:['Grupo 1\n5M–10M','Grupo 2\n10–20M','Grupo 3\n20M+']}
};
var SUB_IDX={'SMB-1':0,'SMB-2':1,'SMB-3':2,'MID-1':0,'MID-2':1,'MID-3':2,'ENT-1':0,'ENT-2':1,'ENT-3':2};
function rr2(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function eio2(t){return t<0.5?2*t*t:-1+(4-2*t)*t;}
function cl2(v,a,b){return Math.max(a,Math.min(b,v));}
function Pt(sx,sy,tx,ty,col,delay,r){this.sx=sx;this.sy=sy;this.tx=tx;this.ty=ty;this.x=sx;this.y=sy;this.color=col;this.delay=delay;this.r=r||4;this.t=0;this.done=false;this.cpx=(sx+tx)/2+(Math.random()-.5)*26;this.cpy=(sy+ty)/2+(Math.random()-.5)*42;}
Pt.prototype.step=function(){if(this.delay>0){this.delay--;return;}this.t=Math.min(1,this.t+0.022);var e=eio2(this.t);this.x=(1-e)*(1-e)*this.sx+2*(1-e)*e*this.cpx+e*e*this.tx;this.y=(1-e)*(1-e)*this.sy+2*(1-e)*e*this.cpy+e*e*this.ty;if(this.t>=1)this.done=true;};
Pt.prototype.draw=function(ctx){var a=this.t<0.15?this.t/0.15:this.t>0.8?(1-this.t)/0.2:1;ctx.save();ctx.globalAlpha=cl2(a,0,1)*0.88;ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fillStyle=this.color;ctx.fill();ctx.restore();};
function dperson(ctx,px,py,sz,alpha,col,ring){ctx.save();ctx.globalAlpha=cl2(alpha,0,1);if(ring){ctx.beginPath();ctx.arc(px,py,sz,0,Math.PI*2);ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.globalAlpha=cl2(alpha*.55,0,1);ctx.stroke();ctx.globalAlpha=cl2(alpha,0,1);}ctx.beginPath();ctx.arc(px,py-sz*.22,sz*.28,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();ctx.beginPath();ctx.arc(px,py+sz*.26,sz*.42,Math.PI*1.1,Math.PI*1.9,false);ctx.fillStyle=col;ctx.fill();ctx.restore();}
function fv(v){if(v>=1000000)return'R$ '+(v/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})+'M';if(v>=1000)return'R$ '+(v/1000).toFixed(0)+'k';return'R$ '+v;}

window.startAlgoAnimation=function(segKey,subKey,value,onDone){
  var isLight = document.body.classList.contains('light');
  var textColor = isLight ? '#1A1828' : '#F0EDF8';
  var subTextColor = isLight ? '#4A4760' : '#A8A4BF';
  var bgCard = isLight ? 'rgba(240,238,248,0.6)' : 'rgba(0,0,0,0)';

  if(aRaf)cancelAnimationFrame(aRaf);
  var cv2=document.getElementById('algoCanvas');if(!cv2)return;
  var ctx=cv2.getContext('2d');
  var AW=620,AH=260;
  var cfg2=ALGO_CFGS[segKey],tSub=SUB_IDX[subKey]||0,c=cfg2.color;
  var frame2=0,parts2=[],persons2=[];
  var P2={segFade:0,subFade:0,qFade:0,winReveal:0,onDone:onDone||null};
  var SX2=8,SY2=106,SW2=100,SH2=48;
  var GX2=156,GY2=106,GW2=108,GH2=48;
  var BX2=318,BW2=88,BH2=30,BY2=[58,120,182];
  var QX2=456,QY2=106,QW2=108,QH2=48;
  var nC=segKey==='SMB'?4:segKey==='MID'?2:1;
  var winner=Math.floor(Math.random()*nC);
  function initP2(){
    var sp=nC===1?0:Math.min(38,(QW2-24)/(nC-1));
    var sx2=QX2+QW2/2-(nC-1)*sp/2;
    var cy2=QY2+20+(QH2-20)/2;
    var order=[...Array(nC).keys()].sort(function(){return Math.random()-.5;});
    persons2=Array.from({length:nC},function(_,i){return{x:sx2+order[i]*sp,tx:sx2+order[i]*sp,y:cy2,alpha:0,isWin:i===winner,bob:Math.random()*Math.PI*2,cy2:cy2};});
  }
  function shuf2(t){
    if(nC<=1)return;
    var sp=Math.min(38,(QW2-24)/(nC-1));var sx2=QX2+QW2/2-(nC-1)*sp/2;
    if(t<0.55){if(Math.floor(t*12)!==Math.floor((t-0.025)*12)){var ord=[...Array(nC).keys()].sort(function(){return Math.random()-.5;});persons2.forEach(function(p,i){p.tx=sx2+ord[i]*sp;});}}
    else{var sl=0;persons2.forEach(function(p){if(!p.isWin){p.tx=sx2+sl*sp;sl++;}});persons2.forEach(function(p){if(p.isWin)p.tx=QX2+QW2/2;});}
  }
  function rend2(){
    ctx.clearRect(0,0,AW,AH);
    rr2(ctx,SX2,SY2,SW2,SH2,7);ctx.fillStyle='rgba(255,72,0,0.09)';ctx.fill();ctx.strokeStyle='#FF4800';ctx.lineWidth=1.5;ctx.stroke();
    ctx.font='500 10px var(--font-sans,sans-serif)';ctx.fillStyle=c;ctx.textAlign='center';
    ctx.fillText('Amount 12m',SX2+SW2/2,SY2+SH2/2-8);ctx.fillText(fv(value),SX2+SW2/2,SY2+SH2/2+7);
    if(P2.segFade>0){
      ctx.save();ctx.globalAlpha=P2.segFade;rr2(ctx,GX2,GY2,GW2,GH2,7);ctx.fillStyle=c+'1A';ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.stroke();
      ctx.font='600 11px var(--font-sans,sans-serif)';ctx.fillStyle=c;ctx.textAlign='center';ctx.fillText(cfg2.label,GX2+GW2/2,GY2+GH2/2-7);
      ctx.font='9px var(--font-sans,sans-serif)';ctx.globalAlpha=P2.segFade*.5;ctx.fillText('segmento identificado',GX2+GW2/2,GY2+GH2/2+8);ctx.restore();
      ctx.save();ctx.globalAlpha=P2.segFade*.28;ctx.beginPath();ctx.moveTo(SX2+SW2,SY2+SH2/2);ctx.lineTo(GX2,GY2+GH2/2);ctx.strokeStyle=c;ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.stroke();ctx.restore();
    }
    if(P2.subFade>0){
      cfg2.subs.forEach(function(lbl,i){
        var isTgt=i===tSub,y=BY2[i];
        ctx.save();ctx.globalAlpha=P2.subFade*(isTgt?1:.32);rr2(ctx,BX2,y,BW2,BH2,5);ctx.fillStyle=isTgt?c+'18':'rgba(255,255,255,0.03)';ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=isTgt?1.5:.5;ctx.stroke();
        var ln=lbl.split('\n');ctx.font=(isTgt?'600 ':'400 ')+'10px var(--font-sans,sans-serif)';ctx.fillStyle=c;ctx.textAlign='center';ctx.fillText(ln[0],BX2+BW2/2,y+BH2/2-6);ctx.font='8px var(--font-sans,sans-serif)';ctx.globalAlpha*=.65;ctx.fillText(ln[1],BX2+BW2/2,y+BH2/2+6);ctx.restore();
        ctx.save();ctx.globalAlpha=P2.subFade*(isTgt?.35:.1);ctx.beginPath();ctx.moveTo(GX2+GW2,GY2+GH2/2);ctx.bezierCurveTo(GX2+GW2+22,GY2+GH2/2,GX2+GW2+22,y+BH2/2,BX2,y+BH2/2);ctx.strokeStyle=c;ctx.lineWidth=isTgt?1:.5;ctx.setLineDash([3,4]);ctx.stroke();ctx.restore();
      });
    }
    if(P2.qFade>0){
      ctx.save();ctx.globalAlpha=P2.qFade;rr2(ctx,QX2,QY2,QW2,QH2,7);ctx.fillStyle=c+'0E';ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.setLineDash([]);ctx.stroke();ctx.restore();
      var lA=P2.winReveal>0.6?cl2(1-(P2.winReveal-.6)/.4,0,1):1;
      ctx.save();ctx.globalAlpha=P2.qFade*lA*.55;ctx.font='500 9px var(--font-sans,sans-serif)';ctx.fillStyle=c;ctx.textAlign='center';ctx.fillText('selecionando',QX2+QW2/2,QY2+13);ctx.restore();
      if(P2.winReveal>0.6){ctx.save();ctx.globalAlpha=((P2.winReveal-.6)/.4)*P2.qFade;ctx.font='500 9px var(--font-sans,sans-serif)';ctx.fillStyle=c;ctx.textAlign='center';ctx.fillText('closer selecionado',QX2+QW2/2,QY2+13);ctx.restore();}
      ctx.save();ctx.globalAlpha=P2.qFade*.28;ctx.beginPath();ctx.moveTo(BX2+BW2,BY2[tSub]+BH2/2);ctx.lineTo(QX2,QY2+QH2/2);ctx.strokeStyle=c;ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.stroke();ctx.restore();
      persons2.forEach(function(p){
        var isWin=p.isWin&&P2.winReveal>0.35;var col2=isWin?c:'rgba(130,130,148,0.5)';
        var a=p.alpha;if(P2.winReveal>0.35&&!p.isWin)a*=cl2(1-(P2.winReveal-.35)*2,0,1);
        dperson(ctx,p.x,p.y,10,cl2(a,0,1),col2,isWin);
      });
    }
    parts2.forEach(function(p){p.draw(ctx);});
  }
  function loop2(){
    frame2++;
    if(frame2===45){for(var i=0;i<13;i++)parts2.push(new Pt(SX2+SW2/2,SY2+SH2/2,GX2+10+Math.random()*(GW2-20),GY2+8+Math.random()*(GH2-16),c,i*16));}
    if(frame2>=45&&frame2<148){P2.segFade=cl2(P2.segFade+0.038,0,1);parts2.forEach(function(p){p.step();});if(frame2===147)parts2=[];}
    if(frame2===170){var gx3=GX2+GW2/2,gy3=GY2+GH2/2;cfg2.subs.forEach(function(_,i){var isTgt=i===tSub,cnt=isTgt?12:4;for(var j=0;j<cnt;j++){var p=new Pt(gx3,gy3,BX2+8+Math.random()*(BW2-16),BY2[i]+4+Math.random()*(BH2-8),c,j*15+(isTgt?0:55),isTgt?4:2.5);parts2.push(p);}});}
    if(frame2>=148&&frame2<290){P2.subFade=cl2(P2.subFade+0.032,0,1);parts2.forEach(function(p){p.step();});if(frame2===289)parts2=[];}
    if(frame2===300)initP2();
    if(frame2>=300){P2.qFade=cl2(P2.qFade+0.04,0,1);persons2.forEach(function(p){p.alpha=cl2(p.alpha+0.05,0,1);p.x+=(p.tx-p.x)*0.09;p.y=p.cy2+Math.sin(frame2*.09+p.bob)*Math.max(0,1-P2.winReveal*3)*2.5;});shuf2(cl2((frame2-300)/260,0,1));if(frame2>520)P2.winReveal=cl2(P2.winReveal+0.015,0,1);}
    rend2();
    if(frame2<750)aRaf=requestAnimationFrame(loop2);
    else { rend2(); if(typeof P2.onDone==='function') P2.onDone(); }
  }
  loop2();
};

function markDone(bid,lid){
  var b=document.getElementById(bid); b.className='step-dot done';
  b.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  document.getElementById(lid).className='step-label';
}
function markActive(bid,lid){
  document.getElementById(bid).className='step-dot active';
  document.getElementById(lid).className='step-label active';
}

export { markDone, markActive };
