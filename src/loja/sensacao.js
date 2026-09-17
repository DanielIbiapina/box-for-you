/** Micro-ritmo da loja: toque, vibração, som curto. Só depois de um gesto. */

let ctx = null

function quieto() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function audio() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function beep(destino, { freq, dur, tipo = 'sine', ganho = 0.05, slide = 0 }) {
  const t0 = destino.currentTime
  const o = destino.createOscillator()
  const g = destino.createGain()
  o.type = tipo
  o.frequency.setValueAtTime(freq, t0)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur)
  g.gain.setValueAtTime(ganho, t0)
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
  o.connect(g)
  g.connect(destino.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

export function toqueJuntar() {
  if (quieto()) return
  try { navigator.vibrate?.(12) } catch { /* */ }
  const a = audio()
  if (!a) return
  beep(a, { freq: 210, dur: 0.07, tipo: 'triangle', ganho: 0.045, slide: -40 })
  beep(a, { freq: 620, dur: 0.05, tipo: 'sine', ganho: 0.02 })
}

export function toquePedidoFeito() {
  if (quieto()) return
  try { navigator.vibrate?.([10, 50, 16]) } catch { /* */ }
  const a = audio()
  if (!a) return
  beep(a, { freq: 523.25, dur: 0.22, tipo: 'sine', ganho: 0.04 })
  setTimeout(() => {
    const b = audio()
    if (b) beep(b, { freq: 659.25, dur: 0.32, tipo: 'sine', ganho: 0.035 })
  }, 90)
}
