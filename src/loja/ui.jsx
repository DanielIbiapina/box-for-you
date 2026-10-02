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
        aria-label={`Remover um ${label}`}
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

/** Ícone do WhatsApp (balão com telefone), na cor do texto. */
export function IconeWhatsApp({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8z" />
      <path d="M8.6 7.3c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.3s1 2.7 1.2 2.9c.1.2 2 3.2 5 4.3 2.4.9 2.9.8 3.5.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4l-.4-.3-2-1c-.3-.1-.5-.1-.6.1l-.9 1.1c-.2.2-.3.2-.6.1a6.8 6.8 0 0 1-3.3-2.9c-.3-.4.2-.4.6-1.3.1-.2 0-.3 0-.5l-.9-2.2c-.2-.5-.4-.5-.6-.5h-.4z" />
    </svg>
  )
}
