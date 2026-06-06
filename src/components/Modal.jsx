export function Modal({ title, onClose, children, size = 'md' }) {
  const maxW = size === 'lg' ? '56rem' : size === 'sm' ? '28rem' : '40rem'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(61,43,31,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-h-[92vh] flex flex-col overflow-hidden"
        style={{
          maxWidth: maxW,
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          boxShadow: '0 8px 40px rgba(61,43,31,0.2)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1.5px solid rgba(61,43,31,0.1)' }}
        >
          <h2
            className="text-lg font-bold"
            style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-xl font-bold transition-all hover:opacity-60"
            style={{ color: 'var(--color-text)' }}
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
