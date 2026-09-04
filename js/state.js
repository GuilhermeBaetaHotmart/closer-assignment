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
  rawValue: 0, leadId: null, clientEmail: null, leadOrigin: null, segKey: null, subKey: null, subLabel: null,
  closerId: null, queue: [], refused: [], weekOffset: 0,
  selectedSlotId: null, selectedSlotLabel: null, selectedSlotStart: null, selectedSlotEnd: null,
  schedulingMode: null, specificSlotStart: null, specificOutOfWindow: false, noAvailability: false,
  slotView: 'compact', agendaEvents: [], slotsLoading: false,
  // Snapshot da reserva recém-criada nesta sessão — sobrevive ao resetAll() (que só
  // reseta os campos do lead em andamento) pra continuar disponível pra confirmar/
  // cancelar/editar via #reservationState, agora hospedado na aba "Aguardando confirmação".
  activeReservation: null
};

/* ── Reserva ativa: persistida no localStorage ────────────────────────────
   Antes vivia só na memória da aba. Isso criava dois problemas: um F5 fazia o
   card sumir (a reserva reaparecia na lista, que confirma por um caminho mais
   frágil), e uma segunda aba não enxergava a reserva da primeira — mostrava ela
   na lista e permitia confirmar de novo, criando DUAS reuniões para o mesmo lead.
   Persistindo aqui, as abas compartilham o mesmo estado e o listener de 'storage'
   em app.js mantém todas sincronizadas. */
export const ACTIVE_RESERVATION_KEY = 'ca_active_reservation';

export function setActiveReservation(reservation) {
  st.activeReservation = reservation || null;
  try {
    if (st.activeReservation) {
      localStorage.setItem(ACTIVE_RESERVATION_KEY, JSON.stringify(st.activeReservation));
    } else {
      localStorage.removeItem(ACTIVE_RESERVATION_KEY);
    }
  } catch (e) {}
}

// Lê a reserva salva sem tocar em st — usado na inicialização e no listener de abas.
export function readStoredReservation() {
  try {
    const raw = localStorage.getItem(ACTIVE_RESERVATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
