import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

export function Modal({ title, onClose, children, size = 'md' }) {
  const maxW = size === 'lg' ? '56rem' : size === 'sm' ? '28rem' : '40rem'
  const painelRef = useRef(null)

  // Fecha com Escape e trava o scroll do fundo enquanto está aberto
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowAnterior
    }
  }, [onClose])

  // Leva o foco para dentro do diálogo ao abrir
  useEffect(() => {
    const alvo = painelRef.current?.querySelector(
      'input:not([type="hidden"]), select, textarea, button',
    )
    alvo?.focus({ preventScroll: true })
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(29,16,8,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-h-[92vh] flex flex-col overflow-hidden"
        style={{
          maxWidth: maxW,
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-pop)',
        }}
      >
        <div
          className="flex items-center justify-between gap-4 px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--line-1)' }}
        >
          <h2 className="bfy-title min-w-0 truncate" style={{ fontSize: 'var(--text-lg)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon shrink-0"
            aria-label="Fechar"
            title="Fechar"
          >
            <Icon name="fechar" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
