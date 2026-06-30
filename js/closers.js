/* ══════════════════════════════════════════════
   closers.js — Toggle de ativação/desativação de closers. Equivalente ao Fluxo 7 (toggle).
   ══════════════════════════════════════════════ */


import { API } from './api.js';
import { authFetch } from './auth.js';
import { showToast } from './ui.js';


export async function toggleCloser(email, trackId) {
  var track = document.getElementById(trackId);
  if (!track) return;
  var isOn  = track.classList.contains('on');
  var label = track.nextElementSibling;

  // Loading state
  track.classList.add('loading');
  showToast((isOn ? 'Desativando' : 'Ativando') + ' closer...', 'info', 8000);

  try {
    const res = await authFetch(API.toggle, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, active: !isOn })
    });
    const data = await res.json();

    if (data.success) {
      var nowActive = !isOn;
      if (nowActive) {
        track.classList.remove('off'); track.classList.add('on');
        if (label) label.textContent = 'Ativo';
        showToast('Closer reativado com sucesso', 'success');
      } else {
        track.classList.remove('on'); track.classList.add('off');
        if (label) label.textContent = 'Inativo';
        showToast('Closer desativado — monitorando inatividade', 'info');
      }

      // Toast extra se equalizou
      if (data.equalized && data.equalizationLog && data.equalizationLog.length > 0) {
        setTimeout(function() {
          showToast('Equalização aplicada: ' + data.equalizationLog.length + ' ajuste(s)', 'success', 5000);
        }, 600);
      }
    } else {
      showToast('Erro: ' + (data.message || 'tente novamente'), 'error', 5000);
    }
  } catch(e) {
    showToast('Erro de conexão: ' + e.message, 'error', 5000);
  }

  track.classList.remove('loading');
}

