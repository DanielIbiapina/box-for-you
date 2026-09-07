/** Peças pequenas partilhadas pela loja. */

export function Stepper({ qty, onMenos, onMais, podeMais, label }) {
  return (
    <div className="stepper">
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

export function Secao({ id, eyebrow, titulo, descricao, children }) {
  return (
    <section id={id} className="loja-wrap py-9 md:py-12">
      <header className="mb-5 md:mb-7">
        {eyebrow && <p className="bfy-eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="loja-section-title">{titulo}</h2>
        {descricao && <p className="mt-2 text-sm md:text-base ink-2 max-w-lg">{descricao}</p>}
      </header>
      {children}
    </section>
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
