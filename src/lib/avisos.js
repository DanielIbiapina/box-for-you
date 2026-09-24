/**
 * Aviso de pedido novo da loja, para quem está com a app aberta.
 *
 * O DataProvider dispara `PEDIDO_NOVO` quando chega um pedido com
 * `origem: 'loja'` pelo realtime; o AvisoPedidos ouve, toca o sino e mostra
 * o balão. A notificação do sistema só existe onde o browser a suporta —
 * no iPhone/iPad só funciona com o site instalado no ecrã principal.
 */

export const PEDIDO_NOVO = 'bfy:pedido-novo'

const SOM_KEY = 'bfy:aviso-som'

export const somLigado = () => {
  try { return localStorage.getItem(SOM_KEY) !== 'off' } catch { return true }
}

export const guardarSom = (ligado) => {
  try { localStorage.setItem(SOM_KEY, ligado ? 'on' : 'off') } catch { /* */ }
}

// ── som ─────────────────────────────────────────────────────────────────────
let ctx = null

function audio() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state !== 'running') ctx.resume()
  return ctx
}

/** O browser só deixa tocar som depois de um gesto — acordamos no primeiro. */
function acordar() {
  const a = audio()
  if (!a) return
  try {
    const src = a.createBufferSource()
    src.buffer = a.createBuffer(1, 1, 22050)
    src.connect(a.destination)
    src.start(0)
  } catch { /* */ }
}
if (typeof document !== 'undefined') {
  const umaVez = { once: true, passive: true, capture: true }
  document.addEventListener('pointerup', acordar, umaVez)
  document.addEventListener('touchend', acordar, umaVez)
}

function sino(a, freq, em, dur = 1.1, ganho = 0.09) {
  const t0 = a.currentTime + em
  const saida = a.createGain()
  saida.gain.setValueAtTime(0.0001, t0)
  saida.gain.exponentialRampToValueAtTime(ganho, t0 + 0.006)
  saida.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  saida.connect(a.destination)
  for (const [mult, g] of [[1, 1], [2.01, 0.3], [3.02, 0.1]]) {
    const o = a.createOscillator()
    const og = a.createGain()
    o.frequency.setValueAtTime(freq * mult, t0)
    og.gain.value = g
    o.connect(og)
    og.connect(saida)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
  }
}

/** Dlim-dlom: dois toques de sino, para ouvir do outro lado da cozinha. */
export function tocarSino() {
  if (!somLigado()) return
  const a = audio()
  if (!a) return
  sino(a, 1046.5, 0)
  sino(a, 1567.98, 0.16, 1.3)
}

// ── notificação do sistema ──────────────────────────────────────────────────
export const estadoNotificacao = () => (
  typeof Notification === 'undefined' ? 'sem-suporte' : Notification.permission
)

export async function pedirNotificacoes() {
  if (typeof Notification === 'undefined') return 'sem-suporte'
  try { return await Notification.requestPermission() } catch { return 'denied' }
}

export function notificar(titulo, corpo) {
  if (estadoNotificacao() !== 'granted') return
  try {
    new Notification(titulo, {
      body: corpo,
      icon: '/mascote-cramb.png',
      badge: '/mascote-cramb.png',
      tag: 'bfy-pedido-novo',
      renotify: true,
    })
  } catch { /* */ }
}
