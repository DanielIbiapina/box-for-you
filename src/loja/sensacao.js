/**
 * Micro-ritmo da loja: som curto e vibração, sempre a seguir a um gesto.
 * Cada cookie que entra na Box sobe uma nota (dó, ré, mi, sol) — a Box
 * fecha num acorde. O pedido feito é um sino, como o da caixa do mercado.
 *
 * O som não depende de "reduzir movimento" (isso é sobre animação); quem
 * manda é o botão de silêncio do telemóvel. No iPhone não há vibração.
 */

let ctx = null

// Sons de interface: misturam com a música de quem está a ouvir e respeitam o silêncio (Safari 17+).
try {
  if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'ambient'
} catch { /* */ }

function audio() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state !== 'running') ctx.resume()
  return ctx
}

/**
 * O iOS só deixa tocar som depois de o áudio ser "acordado" dentro de um gesto.
 * No primeiro toque em qualquer sítio da página, cria o contexto e toca um
 * buffer mudo — a partir daí os sons dos botões saem à primeira.
 */
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
  document.addEventListener('touchend', acordar, umaVez)
  document.addEventListener('pointerup', acordar, umaVez)
}

function vibrar(padrao) {
  try { navigator.vibrate?.(padrao) } catch { /* */ }
}

/** Uma nota com envelope suave; `parciais` = [[multiplicador, ganho]] para dar corpo. */
function nota(a, { freq, em = 0, dur = 0.14, tipo = 'sine', ganho = 0.05, ataque = 0.005, slide = 0, parciais = [] }) {
  const t0 = a.currentTime + em
  const saida = a.createGain()
  saida.gain.setValueAtTime(0.0001, t0)
  saida.gain.exponentialRampToValueAtTime(ganho, t0 + ataque)
  saida.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  saida.connect(a.destination)
  for (const [mult, g] of [[1, 1], ...parciais]) {
    const o = a.createOscillator()
    const og = a.createGain()
    o.type = tipo
    o.frequency.setValueAtTime(freq * mult, t0)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, (freq + slide) * mult), t0 + dur)
    og.gain.value = g
    o.connect(og)
    og.connect(saida)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
  }
}

const ESCALA = [523.25, 587.33, 659.25, 783.99, 880]

/** Um cookie entra. `passo` = que espaço da Box encheu (1…4). */
export function toqueJuntar(passo = 1) {
  vibrar(10)
  const a = audio()
  if (!a) return
  const f = ESCALA[(Math.max(1, passo) - 1) % ESCALA.length]
  nota(a, { freq: 170, dur: 0.07, ganho: 0.05, slide: -60 })
  nota(a, { freq: f, dur: 0.16, tipo: 'triangle', ganho: 0.045, parciais: [[2, 0.15]] })
}

export function toqueTirar() {
  vibrar(6)
  const a = audio()
  if (!a) return
  nota(a, { freq: 392, dur: 0.13, ganho: 0.035, slide: -120 })
}

/** A Box fechou: arpejo a subir. */
export function toqueBoxFechada() {
  vibrar([12, 40, 22])
  const a = audio()
  if (!a) return
  nota(a, { freq: 170, dur: 0.07, ganho: 0.05, slide: -60 })
  ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    nota(a, { freq, em: 0.05 + i * 0.07, dur: 0.4, tipo: 'triangle', ganho: 0.042, parciais: [[2, 0.12]] })
  })
}

/** Já não há mais daquele: um "hum" baixinho. */
export function toqueSemStock() {
  vibrar([8, 30, 8])
  const a = audio()
  if (!a) return
  nota(a, { freq: 150, dur: 0.09, tipo: 'triangle', ganho: 0.04 })
  nota(a, { freq: 140, em: 0.11, dur: 0.1, tipo: 'triangle', ganho: 0.035 })
}

/** Avançar um passo no pedido: um tique. */
export function toquePasso() {
  vibrar(5)
  const a = audio()
  if (!a) return
  nota(a, { freq: 1046.5, dur: 0.06, ganho: 0.018 })
}

/** Pedido feito: um sino em tríade maior, a abrir. */
export function toquePedidoFeito() {
  vibrar([14, 60, 28])
  const a = audio()
  if (!a) return
  ;[783.99, 1046.5, 1318.51].forEach((freq, i) => {
    nota(a, { freq, em: i * 0.11, dur: 0.95, ganho: 0.05, parciais: [[2.01, 0.24], [3.02, 0.07]] })
  })
  nota(a, { freq: 1567.98, em: 0.38, dur: 1.3, ganho: 0.03, parciais: [[2, 0.18]] })
}
