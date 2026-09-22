/**
 * Gestos visuais da loja, feitos com a Web Animations API (nada fica no
 * estado do React). Quem pede menos movimento no sistema não vê nenhum.
 */

function reduzido() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Cópia para voar. Uma <img loading="lazy"> clonada herda o "lazy", e o Safari
 * pode não a pintar a tempo dos 560 ms do voo — por isso uma foto vira uma
 * <img> nova, sem lazy e com descodificação síncrona (já está em cache).
 */
function copiaParaVoar(origem) {
  if (origem.tagName === 'IMG') {
    const img = new Image()
    img.decoding = 'sync'
    img.src = origem.currentSrc || origem.src
    img.alt = ''
    return img
  }
  const clone = origem.cloneNode(true)
  clone.removeAttribute('id')
  for (const img of clone.querySelectorAll('img')) {
    img.removeAttribute('loading')
    img.decoding = 'sync'
  }
  return clone
}

/** A foto do cookie salta para dentro da Box: uma cópia voa em arco até ao alvo. */
export function voar(origem, alvo) {
  if (!origem?.animate || !alvo || reduzido()) return
  const a = origem.getBoundingClientRect()
  const b = alvo.getBoundingClientRect()
  if (!a.width || !b.width) return

  const clone = copiaParaVoar(origem)
  clone.setAttribute('aria-hidden', 'true')
  clone.classList.add('voo')
  Object.assign(clone.style, {
    left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`,
  })
  document.body.appendChild(clone)

  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const s = Math.max(0.12, b.width / a.width)
  const arco = Math.min(150, Math.abs(dy) * 0.3 + 50)

  const anim = clone.animate([
    { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - arco}px) scale(${(1 + s) / 1.7}) rotate(-16deg)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(4deg)`, opacity: 0.9 },
  ], { duration: 560, easing: 'cubic-bezier(.45,.05,.3,1)' })
  const fim = () => clone.remove()
  anim.onfinish = fim
  anim.oncancel = fim
}

/** Pulinho de "entrou!" na foto tocada. */
export function saltar(el) {
  if (!el?.animate || reduzido()) return
  el.animate([
    { transform: 'scale(1) rotate(0deg)' },
    { transform: 'scale(0.86) rotate(-6deg)', offset: 0.3 },
    { transform: 'scale(1.08) rotate(3deg)', offset: 0.65 },
    { transform: 'scale(1) rotate(0deg)' },
  ], { duration: 440, easing: 'ease-out' })
}

/** Abano de "já não há": um não com a cabeça. */
export function abanar(el) {
  if (!el?.animate || reduzido()) return
  el.animate([
    { transform: 'translateX(0)' },
    { transform: 'translateX(-7px)' },
    { transform: 'translateX(6px)' },
    { transform: 'translateX(-3px)' },
    { transform: 'translateX(0)' },
  ], { duration: 340, easing: 'ease-out' })
}

/** Migalhas para uma pequena explosão (ângulos fixos, sem aleatório no render). */
export const MIGALHAS = Array.from({ length: 14 }, (_, i) => {
  const ang = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1)
  const dist = 34 + ((i * 37) % 30)
  const cores = ['#C9A36B', '#8B5A2B', '#E3C28B', '#C24B29', '#5C3A1E', '#F0D9A8']
  return {
    x: `${Math.round(Math.cos(ang) * dist)}px`,
    y: `${Math.round(Math.sin(ang) * dist)}px`,
    r: `${(i * 53) % 360}deg`,
    c: cores[i % cores.length],
    t: i % 3 === 0 ? '999px' : '2px',
  }
})
