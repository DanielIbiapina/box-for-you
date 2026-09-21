/** Peças pequenas partilhadas pela loja. */
import { MIGALHAS } from './voar'

export function Stepper({ qty, onMenos, onMais, podeMais, label }) {
  return (
    <div className="stepper" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn-step"
        onClick={onMenos}
        disabled={qty <= 0}
        aria-label={`Tirar um ${label}`}
      >−</button>
      <span className="stepper-count" aria-live="polite">{qty}</span>
      <button
        type="button"
        className="btn-step"
        onClick={onMais}
        disabled={!podeMais}
        aria-label={`Juntar um ${label}`}
      >+</button>
    </div>
  )
}

export function Foto({ src, className = 'menu-foto' }) {
  if (!src) return <span className={`${className} cookie-prato`} aria-hidden="true" />
  return <img className={className} src={src} alt="" loading="lazy" draggable="false" />
}

export function IconeBox({ size = 16 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  )
}

/** Explosão de migalhas: CSS faz o resto (.migalha em loja.css). */
export function Migalhas({ atraso = '0s', escala = 1 }) {
  return (
    <span className="migalhas" aria-hidden="true">
      {MIGALHAS.map((m, i) => (
        <span
          key={i}
          className="migalha"
          style={{
            '--x': `calc(${m.x} * ${escala})`,
            '--y': `calc(${m.y} * ${escala})`,
            '--r': m.r,
            '--c': m.c,
            '--d': atraso,
            borderRadius: m.t,
          }}
        />
      ))}
    </span>
  )
}

export function Aviso({ tom = 'erro', children }) {
  const cor = tom === 'erro'
    ? { background: 'var(--color-danger-soft)', color: '#8C3123', border: '1px solid rgba(179,64,47,0.3)' }
    : { background: 'var(--color-warning-soft)', color: '#7A5214', border: '1px solid rgba(181,122,33,0.3)' }
  return (
    <p className="rounded-xl px-3.5 py-2.5 text-sm font-semibold" style={cor} role="alert">
      {children}
    </p>
  )
}
