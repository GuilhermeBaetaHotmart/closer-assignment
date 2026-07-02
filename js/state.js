/* ══════════════════════════════════════════════
   state.js — Estado global compartilhado
   Equivalente ao Redis: fonte de verdade única
   que os outros módulos leem e escrevem.
   ══════════════════════════════════════════════ */



export let session = null;

export function setSession(newSession) {
  session = newSession;
}

export let st = {
  rawValue: 0, leadId: null, clientEmail: null, segKey: null, subKey: null, subLabel: null,
  closerId: null, queue: [], refused: [], weekOffset: 0,
  selectedSlotId: null, selectedSlotLabel: null, selectedSlotStart: null, selectedSlotEnd: null,
  schedulingMode: null, specificSlotStart: null, specificOutOfWindow: false, noAvailability: false,
  slotView: 'compact', agendaEvents: []
};
