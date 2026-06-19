import { useMemo, useState } from 'react'
import { useCookies } from '../stores/useCookies'
import { Modal } from './Modal'
import { menuCookies } from '../lib/catalog'

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

/**
 * Cardápio do caixa — só o que aparece (ou pode aparecer) na feira.
 * Catálogo completo e sabores legacy ficam em Config.
 */
export function FeiraCardapio({ onBack, notify }) {
  const { cookies, updateCookie, toggleCardapio } = useCookies()
  const [showHidden, setShowHidden] = useState(true)
  const [editId, setEditId] = useState(null)
  const [price, setPrice] = useState('')

  const visible = useMemo(() => menuCookies(cookies), [cookies])
  const hidden = useMemo(() => cookies.filter((c) => c.ativoNoCardapio === false), [cookies])

  function openPrice(c) {
    setEditId(c.id)
    setPrice(String(c.price))
  }

  function savePrice(e) {
    e.preventDefault()
    const p = parseFloat(String(price).replace(',', '.'))
    if (Number.isNaN(p) || p < 0) return
    updateCookie(editId, { price: p })
    setEditId(null)
    notify?.('Preço atualizado ✓')
  }

  function removeFromCaixa(c) {
    if (c.ativoNoCardapio === false) return
    toggleCardapio(c.id)
    notify?.(`${c.short} removido do caixa`)
  }

  function addToCaixa(c) {
    if (c.ativoNoCardapio !== false) return
    toggleCardapio(c.id)
    notify?.(`${c.short} adicionado ao caixa ✓`)
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto p-4 md:p-6 pb-10 space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" className="btn-ghost text-sm px-4 py-2" onClick={onBack}>← Voltar</button>
          <div>
            <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}>
              Cardápio do caixa
            </h1>
            <p className="text-xs opacity-50 mt-0.5" style={{ color: 'var(--color-text)' }}>
              Remove sabores do caixa sem apagar estatísticas
            </p>
          </div>
        </div>

        <div className="bfy-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-accent-dark)' }}>
              No caixa agora ({visible.length})
            </h2>
          </div>
          {visible.length === 0 ? (
            <p className="text-sm opacity-45 text-center py-4" style={{ color: 'var(--color-text)' }}>
              Nenhum sabor visível — adiciona algum abaixo ou em Config.
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((c) => (
                <CookieRow
                  key={c.id}
                  c={c}
                  onEditPrice={() => openPrice(c)}
                  onRemove={() => removeFromCaixa(c)}
                />
              ))}
            </div>
          )}
        </div>

        {hidden.length > 0 && (
          <div className="bfy-card p-5 space-y-3">
            <button
              type="button"
              className="w-full flex items-center justify-between text-sm font-bold"
              style={{ color: 'var(--color-text)' }}
              onClick={() => setShowHidden((v) => !v)}
            >
              <span>Fora do caixa ({hidden.length})</span>
              <span className="opacity-40">{showHidden ? '▾' : '▸'}</span>
            </button>
            {showHidden && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] opacity-45" style={{ color: 'var(--color-text)' }}>
                  Ex.: BOW — mantém estatísticas, não aparece no caixa.
                </p>
                {hidden.map((c) => (
                  <CookieRow
                    key={c.id}
                    c={c}
                    muted
                    onEditPrice={() => openPrice(c)}
                    onAdd={() => addToCaixa(c)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-center opacity-40 px-4" style={{ color: 'var(--color-text)' }}>
          Para criar sabores novos, editar BOX ou imagens → Config → Cardápio & Sabores
        </p>
      </div>

      {editId && (
        <Modal title="Preço no caixa" onClose={() => setEditId(null)} size="sm">
          <form onSubmit={savePrice} className="space-y-4">
            <label className="block">
              <span className="bfy-label">Preço (€)</span>
              <input
                className="bfy-input"
                type="text"
                inputMode="decimal"
                autoFocus
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setEditId(null)}>Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function CookieRow({ c, onEditPrice, onRemove, onAdd, muted = false }) {
  const isVisible = c.ativoNoCardapio !== false

  return (
    <div
      className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl px-3 py-2.5"
      style={{
        background: muted ? 'rgba(29,16,8,0.02)' : 'rgba(29,16,8,0.04)',
        border: '1px solid rgba(29,16,8,0.06)',
        opacity: muted ? 0.85 : 1,
      }}
    >
      <span className="text-xl shrink-0">{c.emoji}</span>
      <div className="flex-1 min-w-[120px]">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>{c.short}</p>
        <p className="text-xs opacity-45" style={{ color: 'var(--color-text)' }}>{fmtEuro(c.price)}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        <button type="button" className="btn-ghost text-xs px-2.5 py-1.5" onClick={onEditPrice}>
          Preço
        </button>
        {isVisible && onRemove && (
          <button
            type="button"
            className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: 'rgba(229,115,115,0.15)', color: '#c62828' }}
            onClick={onRemove}
          >
            Remover
          </button>
        )}
        {!isVisible && onAdd && (
          <button
            type="button"
            className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(90,158,133,0.15)', color: 'var(--color-success)' }}
            onClick={onAdd}
          >
            Adicionar
          </button>
        )}
      </div>
    </div>
  )
}
