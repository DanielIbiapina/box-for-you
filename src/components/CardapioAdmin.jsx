import { useState } from 'react'
import { useCookies } from '../stores/useCookies'
import { useConfiguracoes } from '../stores/useConfiguracoes'
import { Modal } from './Modal'
import { Icon } from './Icon'

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
      <p className="text-sm ink-3">
        Sabores, preços e visibilidade no caixa da feira. Ocultar um sabor mantém estatísticas (ex.: BOW).
      </p>

      <div className="bfy-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold bfy-card-title">
            Cookies
          </h3>
          <button type="button" className="btn-accent text-xs px-4 py-2" onClick={openAdd}>
            <Icon name="mais" size={15} /> Novo cookie
          </button>
        </div>

        <div className="space-y-2">
          {cookies.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)' }}
            >
              <div
                className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                style={{ background: 'var(--color-surface-sunk)' }}
              >
                {c.image
                  ? <img src={c.image} alt={c.nome} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                  : <span className="text-xl">{c.emoji}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                <p className="text-xs ink-3">
                  {c.short} · {fmtEuro(c.price)}
                  {c.ativoNoCardapio === false && (
                    <span className="ml-1.5 font-bold" style={{ color: 'var(--color-accent-dark)' }}>· oculto no caixa</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  className="text-[11px] font-bold px-2 py-1 rounded-lg"
                  style={{
                    background: c.ativoNoCardapio !== false ? 'rgba(90,158,133,0.15)' : 'var(--color-surface-sunk)',
                    color: c.ativoNoCardapio !== false ? 'var(--color-success)' : 'rgba(29,16,8,0.45)',
                  }}
                  onClick={() => toggleCardapio(c.id)}
                >
                  {c.ativoNoCardapio !== false ? 'Visível' : 'Oculto'}
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(c)}>Editar</button>
                <button
                  type="button"
                  className="btn-icon btn-icon-danger"
                  title={`Remover ${c.nome}`}
                  aria-label={`Remover ${c.nome}`}
                  onClick={() => {
                    if (cookies.length <= 1) { notify('Precisa ter pelo menos 1 cookie.'); return }
                    if (confirm(`Remover "${c.nome}" da plataforma? (perde estatísticas)`)) removeCookie(c.id)
                  }}
                ><Icon name="lixo" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bfy-card p-5 space-y-3">
        <h3 className="text-sm font-bold bfy-card-title">
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
        <h3 className="text-sm font-bold bfy-card-title">
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
        <DescricaoLoja
          valor={miniBoxConfig.descricao}
          padrao="5 mini cookies sortidos de 25 g. Os sabores são surpresa."
          onGuardar={(descricao) => setMiniBoxConfig((p) => ({ ...p, descricao }))}
        />
        <p className="text-[11px] ink-3">
          Para aparecer disponível na loja: põe a quantidade em <strong>Estoque › Cookies prontos › Mini Box</strong>.
        </p>
      </div>

      <MiniCookies50 />


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

/** Descrição que a loja mostra numa caixa especial. Grava ao sair do campo. */
function DescricaoLoja({ valor, padrao, onGuardar }) {
  const [texto, setTexto] = useState(valor ?? '')
  return (
    <label className="block">
      <span className="bfy-label">Descrição na loja</span>
      <textarea
        className="bfy-input"
        rows={2}
        value={texto}
        placeholder={padrao}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => { if ((valor ?? '') !== texto.trim()) onGuardar(texto.trim()) }}
      />
      <span className="text-[11px] mt-1 block ink-3">Vazio = “{padrao}”</span>
    </label>
  )
}

/**
 * Mini cookies de 50 g na loja: os mesmos sabores, em pequeno, a um preço só.
 * O stock é por sabor, em Estoque › Cookies 50g. Preço 0 € = não aparecem.
 */
function MiniCookies50() {
  const { config, update } = useConfiguracoes()
  const mini50 = config.mini50 ?? {}
  const [preco, setPreco] = useState(mini50.price != null ? String(mini50.price) : '')
  const disponivel = config.mini50Disponivel !== false

  function guardarPreco() {
    const p = parseFloat(String(preco).replace(',', '.'))
    const valor = Number.isFinite(p) && p > 0 ? p : 0
    if (valor !== (Number(mini50.price) || 0)) update({ mini50: { ...mini50, price: valor } })
    setPreco(valor ? String(valor) : '')
  }

  return (
    <div className="bfy-card p-5 space-y-3">
      <h3 className="text-sm font-bold bfy-card-title">Mini cookies (50 g)</h3>
      <p className="text-sm ink-3">
        Cada sabor também em 50 g. Na loja aparecem os sabores com stock em{' '}
        <strong>Estoque › Cookies 50g</strong>, todos ao mesmo preço.
      </p>
      {!disponivel ? (
        <p className="bfy-sunk p-3 text-sm ink-2">
          Para vender mini cookies na loja, corre o <code>supabase/loja.sql</code> atualizado no Supabase.
        </p>
      ) : (
        <>
          <label className="block max-w-xs">
            <span className="bfy-label">Preço de cada mini cookie (€)</span>
            <input
              className="bfy-input"
              inputMode="decimal"
              placeholder="0,00"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              onBlur={guardarPreco}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
          </label>
          <DescricaoLoja
            valor={mini50.descricao}
            padrao="Os mesmos sabores, em tamanho mini: 50 g cada."
            onGuardar={(descricao) => update({ mini50: { ...mini50, descricao } })}
          />
          <p className="text-[11px] ink-3">Com preço 0 €, os mini cookies não aparecem na loja.</p>
        </>
      )}
    </div>
  )
}
