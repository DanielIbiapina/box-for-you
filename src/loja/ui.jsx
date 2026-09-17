/** Peças pequenas partilhadas pela loja. */

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
  return <img className={className} src={src} alt="" loading="lazy" />
}

export function BotaoMais({ onClick, disabled, label }) {
  return (
    <button
      type="button"
      className="menu-mais"
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      disabled={disabled}
      aria-label={label}
    >
      +
    </button>
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
