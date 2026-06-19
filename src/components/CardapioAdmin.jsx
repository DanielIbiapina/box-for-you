import { useState } from 'react'
import { useCookies } from '../stores/useCookies'
import { Modal } from './Modal'

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const EMPTY_COOKIE_FORM = { nome: '', short: '', emoji: '🍪', price: 3.50, image: '' }

/** Gestão global de sabores — visível no cardápio da feira, preços, BOX */
export function CardapioAdmin() {
  const {
    cookies, boxConfig, miniBoxConfig,
    addCookie, updateCookie, removeCookie, toggleCardapio,
    setBoxConfig, setMiniBoxConfig,
  } = useCookies()

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_COOKIE_FORM)
  const [toast, setToast] = useState(null)

  function notify(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }

  function openAdd() {
    setForm({ ...EMPTY_COOKIE_FORM })
    setModal('new')
  }

  function openEdit(c) {
    setForm({ nome: c.nome, short: c.short, emoji: c.emoji, price: c.price, image: c.image ?? '' })
    setModal(c.id)
  }

  function handleSave(e) {
    e.preventDefault()
    const data = {
      nome: form.nome.trim(),
      short: form.short.trim() || form.nome.trim(),
      emoji: form.emoji || '🍪',
      price: parseFloat(form.price) || 0,
      image: form.image.trim(),
    }
    if (!data.nome) return
    if (modal === 'new') addCookie(data)
    else updateCookie(modal, data)
    setModal(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-55" style={{ color: 'var(--color-text)' }}>
        Sabores, preços e visibilidade no caixa da feira. Ocultar um sabor mantém estatísticas (ex.: BOW).
      </p>

      <div className="bfy-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}>
            Cookies
          </h3>
          <button type="button" className="btn-accent text-xs px-4 py-2" onClick={openAdd}>
            + Novo cookie
          </button>
        </div>

        <div className="space-y-2">
          {cookies.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(29,16,8,0.04)', border: '1px solid rgba(29,16,8,0.07)' }}
            >
              <div
                className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                style={{ background: 'rgba(29,16,8,0.06)' }}
              >
                {c.image
                  ? <img src={c.image} alt={c.nome} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                  : <span className="text-xl">{c.emoji}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                <p className="text-xs opacity-50" style={{ color: 'var(--color-text)' }}>
                  {c.short} · {fmtEuro(c.price)}
                  {c.ativoNoCardapio === false && (
                    <span className="ml-1.5 font-bold" style={{ color: 'var(--color-accent-dark)' }}>· oculto no caixa</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  className="text-[10px] font-bold px-2 py-1 rounded-lg"
                  style={{
                    background: c.ativoNoCardapio !== false ? 'rgba(90,158,133,0.15)' : 'rgba(29,16,8,0.06)',
                    color: c.ativoNoCardapio !== false ? 'var(--color-success)' : 'rgba(29,16,8,0.45)',
                  }}
                  onClick={() => toggleCardapio(c.id)}
                >
                  {c.ativoNoCardapio !== false ? 'Visível' : 'Oculto'}
                </button>
                <button type="button" className="btn-ghost text-xs px-3 py-1.5" onClick={() => openEdit(c)}>Editar</button>
                <button
                  type="button"
                  className="text-xs font-semibold opacity-35 hover:opacity-75"
                  style={{ color: '#e57373' }}
                  onClick={() => {
                    if (cookies.length <= 1) { notify('Precisa ter pelo menos 1 cookie.'); return }
                    if (confirm(`Remover "${c.nome}" da plataforma? (perde estatísticas)`)) removeCookie(c.id)
                  }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bfy-card p-5 space-y-3">
        <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}>
          BOX na feira
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="bfy-label">Nº cookies na BOX</span>
            <input
              className="bfy-input"
              type="number"
              min="1"
              max="12"
              value={boxConfig.size}
              onChange={(e) => setBoxConfig((p) => ({ ...p, size: parseInt(e.target.value) || 4 }))}
            />
          </label>
          <label className="block">
            <span className="bfy-label">Preço BOX (€)</span>
            <input
              className="bfy-input"
              type="number"
              min="0"
              step="0.5"
              value={boxConfig.price}
              onChange={(e) => setBoxConfig((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
            />
          </label>
        </div>
      </div>

      <div className="bfy-card p-5 space-y-3">
        <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}>
          Box Mini Cookies
        </h3>
        <label className="block max-w-xs">
          <span className="bfy-label">Preço (€)</span>
          <input
            className="bfy-input"
            type="number"
            min="0"
            step="0.5"
            value={miniBoxConfig.price}
            onChange={(e) => setMiniBoxConfig((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
          />
        </label>
      </div>

      {modal !== null && (
        <Modal title={modal === 'new' ? 'Novo Cookie' : 'Editar Cookie'} onClose={() => setModal(null)} size="sm">
          <form onSubmit={handleSave} className="space-y-4">
            <label className="block">
              <span className="bfy-label">Nome completo *</span>
              <input className="bfy-input" required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </label>
            <label className="block">
              <span className="bfy-label">Nome curto</span>
              <input className="bfy-input" value={form.short} onChange={(e) => setForm((f) => ({ ...f, short: e.target.value }))} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="bfy-label">Emoji</span>
                <input className="bfy-input" value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} />
              </label>
              <label className="block">
                <span className="bfy-label">Preço (€) *</span>
                <input className="bfy-input" type="number" min="0" step="0.5" required value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
              </label>
            </div>
            <label className="block">
              <span className="bfy-label">URL da imagem</span>
              <input className="bfy-input" value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} />
            </label>
            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg"
          style={{ background: 'var(--color-primary)', color: 'var(--color-text-light)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
