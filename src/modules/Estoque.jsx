import { useState } from 'react'
import { useEstoque, UNIDADES } from '../stores/useEstoque'
import { useCookies } from '../stores/useCookies'
import { useEstoqueCookies } from '../stores/useEstoqueCookies'
import { Modal } from '../components/Modal'
import { SearchInput } from '../components/SearchInput'

const EMPTY_ING = { nome: '', unidade: 'g', custoPorUnidade: '', estoqueAtual: '', estoqueMinimo: '' }

const STATUS_CONFIG = {
  ok:      { label: 'OK',      className: 'badge-ok' },
  baixo:   { label: 'Baixo',   className: 'badge-baixo' },
  critico: { label: 'Crítico', className: 'badge-critico' },
}

function fmtQtd(v) {
  const n = parseFloat(v) || 0
  return parseFloat(n.toFixed(2)).toString()
}

function fmtCusto(v) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(parseFloat(v) || 0)
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="bfy-label">{label}</span>
      {children}
    </label>
  )
}

const TABS = [
  { id: 'ingredientes', label: 'Ingredientes' },
  { id: 'massa',        label: 'Massa Pronta' },
  { id: 'cookies',      label: 'Cookies Prontos' },
]

// ─── Componente principal ─────────────────────────────────────────────────────

export function Estoque() {
  const {
    ingredientes,
    movimentacoes,
    adicionarIngrediente,
    atualizarIngrediente,
    removerIngrediente,
    registrarMovimentacao,
    statusIngrediente,
  } = useEstoque()

  const { cookies } = useCookies()
  const { stockCookies, stockMassa, adjustCookies, setCookieQty, adjustMassa, setMassaQty } = useEstoqueCookies()

  const [activeTab, setActiveTab] = useState('ingredientes')
  const [modal,     setModal]     = useState(null)
  const [form,      setForm]      = useState(EMPTY_ING)
  const [movModal,  setMovModal]  = useState(null)
  const [movForm,   setMovForm]   = useState({ tipo: 'entrada', quantidade: '', motivo: '' })
  const [histModal, setHistModal] = useState(null)
  const [search,    setSearch]    = useState('')

  // Inline qty editor for cookie/massa tabs
  const [editQty, setEditQty] = useState({}) // { cookieId: rawString }

  const filtrados = ingredientes.filter((i) =>
    i.nome.toLowerCase().includes(search.toLowerCase()),
  )

  function openNew() { setForm({ ...EMPTY_ING }); setModal('new') }
  function openEdit(ing) {
    setForm({
      nome: ing.nome, unidade: ing.unidade,
      custoPorUnidade: ing.custoPorUnidade ?? '',
      estoqueAtual: ing.estoqueAtual ?? '',
      estoqueMinimo: ing.estoqueMinimo ?? '',
    })
    setModal(ing.id)
  }

  function handleSave(e) {
    e.preventDefault()
    const dados = {
      nome: form.nome.trim(), unidade: form.unidade,
      custoPorUnidade: parseFloat(form.custoPorUnidade) || 0,
      estoqueAtual:    parseFloat(form.estoqueAtual)    || 0,
      estoqueMinimo:   parseFloat(form.estoqueMinimo)   || 0,
    }
    modal === 'new' ? adicionarIngrediente(dados) : atualizarIngrediente(modal, dados)
    setModal(null)
  }

  function handleMovimentacao(e) {
    e.preventDefault()
    const qtd = parseFloat(movForm.quantidade)
    if (!qtd || qtd <= 0) return
    registrarMovimentacao({ ingredienteId: movModal, tipo: movForm.tipo, quantidade: qtd, motivo: movForm.motivo })
    setMovModal(null)
  }

  const histIngrediente = histModal ? ingredientes.find((i) => i.id === histModal) : null
  const histMovs        = histModal ? movimentacoes.filter((m) => m.ingredienteId === histModal).slice(0, 30) : []

  const totalCritico = ingredientes.filter((i) => statusIngrediente(i) === 'critico').length
  const totalBaixo   = ingredientes.filter((i) => statusIngrediente(i) === 'baixo').length
  const totalOk      = ingredientes.filter((i) => statusIngrediente(i) === 'ok').length

  // Inline qty commit for cookie/massa tabs
  function commitQty(cookieId, isM) {
    const raw = editQty[cookieId]
    if (raw == null) return
    const n = parseFloat(raw) || 0
    isM ? setMassaQty(cookieId, n) : setCookieQty(cookieId, n)
    setEditQty((p) => { const c = { ...p }; delete c[cookieId]; return c })
  }

  const totalCookiesCongelados = cookies.reduce((s, c) => s + (stockCookies[c.id] ?? 0), 0)
  const totalMassaKg = cookies.reduce((s, c) => s + (stockMassa[c.id] ?? 0), 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-3xl font-black"
            style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}
          >
            Estoque
          </h1>
          <p className="text-sm mt-0.5 opacity-50" style={{ color: 'var(--color-text)' }}>
            {activeTab === 'ingredientes' && `${ingredientes.length} ingrediente${ingredientes.length !== 1 ? 's' : ''}`}
            {activeTab === 'massa'        && `${totalMassaKg.toFixed(0)}g de massa pronta`}
            {activeTab === 'cookies'      && `${totalCookiesCongelados} cookie${totalCookiesCongelados !== 1 ? 's' : ''} prontos`}
          </p>
        </div>
        {activeTab === 'ingredientes' && (
          <button className="btn-primary px-5 py-2.5" onClick={openNew}>
            + Ingrediente
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex rounded-xl overflow-hidden mb-5"
        style={{ border: '1.5px solid rgba(29,16,8,0.12)', width: 'fit-content' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="px-4 py-2 text-sm font-bold transition-all"
            style={{
              background: activeTab === t.id ? 'var(--color-accent-dark)' : 'transparent',
              color: activeTab === t.id ? '#fff' : 'var(--color-text)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ────────────────────────────────────────────────
          TAB: INGREDIENTES
      ──────────────────────────────────────────────── */}
      {activeTab === 'ingredientes' && (
        <>
          {ingredientes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {totalOk      > 0 && <span className="badge-ok">✅ {totalOk} OK</span>}
              {totalBaixo   > 0 && <span className="badge-baixo">⚠️ {totalBaixo} Baixo</span>}
              {totalCritico > 0 && <span className="badge-critico">🔴 {totalCritico} Crítico</span>}
            </div>
          )}
          {(totalCritico > 0 || totalBaixo > 0) && (
            <div
              className="rounded-2xl p-3 mb-5 text-sm font-semibold"
              style={{ background: 'var(--color-warning)', color: 'var(--color-text)' }}
            >
              {totalCritico > 0 && `🔴 ${totalCritico} ingrediente${totalCritico > 1 ? 's' : ''} em estoque crítico. `}
              {totalBaixo   > 0 && `⚠️ ${totalBaixo} abaixo do mínimo.`}
            </div>
          )}
          <div className="mb-4">
            <SearchInput
              className="max-w-xs"
              placeholder="Buscar ingrediente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {filtrados.length === 0 ? (
            <div className="bfy-card p-12 text-center">
              <span className="text-6xl block mb-3">📦</span>
              <p className="font-semibold text-lg opacity-55" style={{ color: 'var(--color-text)' }}>
                {ingredientes.length === 0 ? 'Nenhum ingrediente cadastrado' : 'Nenhum resultado'}
              </p>
              {ingredientes.length === 0 && (
                <button className="btn-primary mt-4 px-5 py-2.5" onClick={openNew}>
                  + Adicionar primeiro ingrediente
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtrados.map((ing) => {
                const st  = statusIngrediente(ing)
                const sc  = STATUS_CONFIG[st]
                const atual  = parseFloat(ing.estoqueAtual)  || 0
                const minimo = parseFloat(ing.estoqueMinimo) || 0
                const barPct = minimo > 0 ? Math.min(100, Math.round((atual / minimo) * 100)) : atual > 0 ? 100 : 0
                const barColor = st === 'critico' ? '#e57373' : st === 'baixo' ? '#E8C080' : 'var(--color-success)'
                return (
                  <div key={ing.id} className="bfy-card p-3 flex flex-col gap-2 overflow-hidden min-w-0">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--color-text)' }}>
                          {ing.nome}
                        </p>
                        <p className="text-[11px] mt-0.5 truncate opacity-45" style={{ color: 'var(--color-text)' }}>
                          {ing.unidade} · {fmtCusto(ing.custoPorUnidade)}
                        </p>
                      </div>
                      <span className={sc.className}>{sc.label}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex justify-between items-baseline gap-2 mb-1">
                        <span className="font-bold text-xs truncate" style={{ color: 'var(--color-text)' }}>
                          {fmtQtd(ing.estoqueAtual)} {ing.unidade}
                        </span>
                        {minimo > 0 && (
                          <span className="text-[10px] shrink-0 opacity-40" style={{ color: 'var(--color-text)' }}>
                            mín {fmtQtd(ing.estoqueMinimo)}
                          </span>
                        )}
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(29,16,8,0.1)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: barColor }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-auto min-w-0">
                      <button
                        className="btn-accent btn-sm flex-1 min-w-0"
                        onClick={() => { setMovForm({ tipo: 'entrada', quantidade: '', motivo: '' }); setMovModal(ing.id) }}
                      >+ Entrada</button>
                      <button
                        className="btn-ghost btn-sm flex-1 min-w-0"
                        onClick={() => { setMovForm({ tipo: 'saida', quantidade: '', motivo: '' }); setMovModal(ing.id) }}
                      >− Saída</button>
                      <button className="btn-icon-sm" title="Editar" onClick={() => openEdit(ing)}>✏️</button>
                      <button className="btn-icon-sm" title="Histórico" onClick={() => setHistModal(ing.id)}>📋</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ────────────────────────────────────────────────
          TAB: MASSA PRONTA
      ──────────────────────────────────────────────── */}
      {activeTab === 'massa' && (
        <>
          <p className="text-sm mb-4 opacity-55" style={{ color: 'var(--color-text)' }}>
            Regista a quantidade de massa pronta (em gramas) disponível por sabor. Útil para planear quantos cookies consegues assar.
          </p>
          {cookies.length === 0 ? (
            <div className="bfy-card p-10 text-center opacity-50" style={{ color: 'var(--color-text)' }}>
              Nenhum cookie no cardápio. Adiciona em Feiras → Gerenciar Cardápio.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {cookies.map((c) => {
                const qty = stockMassa[c.id] ?? 0
                const raw = editQty[c.id + ':m']
                return (
                  <div
                    key={c.id}
                    className="bfy-card p-3 flex items-center gap-3"
                  >
                    <div
                      className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(29,16,8,0.06)' }}
                    >
                      {c.image
                        ? <img src={c.image} alt={c.nome} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                        : <span className="text-2xl">{c.emoji}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                      {raw != null ? (
                        <input
                          className="bfy-input py-0.5 text-sm w-24 mt-0.5"
                          type="number"
                          min="0"
                          step="1"
                          autoFocus
                          value={raw}
                          onChange={(e) => setEditQty((p) => ({ ...p, [c.id + ':m']: e.target.value }))}
                          onBlur={() => commitQty(c.id + ':m', true)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitQty(c.id + ':m', true) }}
                        />
                      ) : (
                        <button
                          className="text-xs font-black mt-0.5 tabular-nums text-left"
                          style={{ color: qty > 0 ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.3)' }}
                          onClick={() => setEditQty((p) => ({ ...p, [c.id + ':m']: String(qty) }))}
                        >
                          {qty}g {qty === 0 && <span className="font-normal opacity-50">— toca para editar</span>}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => adjustMassa(c.id, 50)}
                        className="w-8 h-8 rounded-lg font-bold text-base flex items-center justify-center"
                        style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}
                        title="+50g"
                      >+</button>
                      <button
                        onClick={() => adjustMassa(c.id, -50)}
                        disabled={qty <= 0}
                        className="w-8 h-8 rounded-lg font-bold text-base flex items-center justify-center disabled:opacity-25"
                        style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}
                        title="-50g"
                      >−</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {totalMassaKg > 0 && (
            <div
              className="mt-4 rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(154,59,28,0.07)', border: '1px solid rgba(154,59,28,0.15)' }}
            >
              <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>Total de massa</span>
              <span className="font-black tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                {totalMassaKg.toFixed(0)}g
              </span>
            </div>
          )}
        </>
      )}

      {/* ────────────────────────────────────────────────
          TAB: COOKIES PRONTOS (CONGELADOS)
      ──────────────────────────────────────────────── */}
      {activeTab === 'cookies' && (
        <>
          <p className="text-sm mb-4 opacity-55" style={{ color: 'var(--color-text)' }}>
            Cookies prontos para venda. O stock baixa automaticamente a cada venda confirmada no caixa ou como venda rápida.
          </p>
          {cookies.length === 0 ? (
            <div className="bfy-card p-10 text-center opacity-50" style={{ color: 'var(--color-text)' }}>
              Nenhum cookie no cardápio. Adiciona em Feiras → Gerenciar Cardápio.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {cookies.map((c) => {
                const qty = stockCookies[c.id] ?? 0
                const raw = editQty[c.id + ':c']
                const low = qty <= 3 && qty > 0
                const out = qty === 0
                return (
                  <div
                    key={c.id}
                    className="bfy-card p-3 flex items-center gap-3"
                    style={{ opacity: out ? 0.65 : 1 }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(29,16,8,0.06)' }}
                    >
                      {c.image
                        ? <img src={c.image} alt={c.nome} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                        : <span className="text-2xl">{c.emoji}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                      {raw != null ? (
                        <input
                          className="bfy-input py-0.5 text-sm w-20 mt-0.5"
                          type="number"
                          min="0"
                          step="1"
                          autoFocus
                          value={raw}
                          onChange={(e) => setEditQty((p) => ({ ...p, [c.id + ':c']: e.target.value }))}
                          onBlur={() => commitQty(c.id + ':c', false)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitQty(c.id + ':c', false) }}
                        />
                      ) : (
                        <button
                          className="text-xs font-black mt-0.5 tabular-nums text-left"
                          style={{ color: out ? 'rgba(229,115,115,0.9)' : low ? '#E8A040' : 'var(--color-accent-dark)' }}
                          onClick={() => setEditQty((p) => ({ ...p, [c.id + ':c']: String(qty) }))}
                        >
                          {qty} {qty === 1 ? 'unidade' : 'unidades'}
                          {out && <span className="ml-1 font-normal opacity-60">— sem stock</span>}
                          {low && !out && <span className="ml-1 font-normal opacity-60">— pouco!</span>}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => adjustCookies(c.id, 1)}
                        className="w-8 h-8 rounded-lg font-bold text-base flex items-center justify-center"
                        style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}
                      >+</button>
                      <button
                        onClick={() => adjustCookies(c.id, -1)}
                        disabled={qty <= 0}
                        className="w-8 h-8 rounded-lg font-bold text-base flex items-center justify-center disabled:opacity-25"
                        style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}
                      >−</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {totalCookiesCongelados > 0 && (
            <div
              className="mt-4 rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(154,59,28,0.07)', border: '1px solid rgba(154,59,28,0.15)' }}
            >
              <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>Total prontos</span>
              <span className="font-black tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                {totalCookiesCongelados} {totalCookiesCongelados === 1 ? 'cookie' : 'cookies'}
              </span>
            </div>
          )}
        </>
      )}

      {/* ── Modal: Cadastrar / Editar ingrediente ── */}
      {modal !== null && (
        <Modal
          title={modal === 'new' ? 'Novo Ingrediente' : 'Editar Ingrediente'}
          onClose={() => setModal(null)}
          size="sm"
        >
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Nome *">
              <input
                className="bfy-input"
                required
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Farinha de trigo"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unidade de medida">
                <select
                  className="bfy-input"
                  value={form.unidade}
                  onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                >
                  {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Custo por unidade (€)">
                <input
                  className="bfy-input"
                  type="number" min="0" step="0.01"
                  value={form.custoPorUnidade}
                  onChange={(e) => setForm((f) => ({ ...f, custoPorUnidade: e.target.value }))}
                  placeholder="0,00"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estoque atual">
                <input
                  className="bfy-input"
                  type="number" min="0" step="0.1"
                  value={form.estoqueAtual}
                  onChange={(e) => setForm((f) => ({ ...f, estoqueAtual: e.target.value }))}
                  placeholder="0"
                />
              </Field>
              <Field label="Estoque mínimo">
                <input
                  className="bfy-input"
                  type="number" min="0" step="0.1"
                  value={form.estoqueMinimo}
                  onChange={(e) => setForm((f) => ({ ...f, estoqueMinimo: e.target.value }))}
                  placeholder="0"
                />
              </Field>
            </div>
            <div className="flex gap-3 pt-2">
              {modal !== 'new' && (
                <button
                  type="button"
                  className="btn-ghost text-xs px-4"
                  style={{ color: '#e57373', borderColor: '#e57373' }}
                  onClick={() => { if (confirm('Excluir este ingrediente?')) { removerIngrediente(modal); setModal(null) } }}
                >Excluir</button>
              )}
              <button type="button" className="btn-ghost flex-1" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Movimentação ── */}
      {movModal !== null && (
        <Modal
          title={movForm.tipo === 'entrada' ? '+ Entrada de Estoque' : '− Saída de Estoque'}
          onClose={() => setMovModal(null)}
          size="sm"
        >
          <form onSubmit={handleMovimentacao} className="space-y-4">
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}>
              {['entrada', 'saida'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className="flex-1 py-2.5 text-sm font-bold transition-all"
                  style={{
                    background: movForm.tipo === t ? 'var(--color-accent-dark)' : 'transparent',
                    color: movForm.tipo === t ? '#fff' : 'var(--color-text)',
                  }}
                  onClick={() => setMovForm((f) => ({ ...f, tipo: t }))}
                >
                  {t === 'entrada' ? '+ Entrada' : '− Saída'}
                </button>
              ))}
            </div>
            <Field label={`Quantidade (${ingredientes.find((i) => i.id === movModal)?.unidade ?? ''})`}>
              <input
                className="bfy-input"
                type="number" min="0.01" step="0.01" required
                value={movForm.quantidade}
                onChange={(e) => setMovForm((f) => ({ ...f, quantidade: e.target.value }))}
                placeholder="Ex: 500"
              />
            </Field>
            <Field label="Motivo (opcional)">
              <input
                className="bfy-input"
                value={movForm.motivo}
                onChange={(e) => setMovForm((f) => ({ ...f, motivo: e.target.value }))}
                placeholder="Ex: Compra, produção..."
              />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setMovModal(null)}>Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Registrar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Histórico ── */}
      {histModal !== null && (
        <Modal
          title={`Histórico — ${histIngrediente?.nome ?? ''}`}
          onClose={() => setHistModal(null)}
          size="sm"
        >
          {histMovs.length === 0 ? (
            <p className="text-center py-6 text-sm opacity-50" style={{ color: 'var(--color-text)' }}>
              Nenhuma movimentação registrada.
            </p>
          ) : (
            <div className="space-y-2">
              {histMovs.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(29,16,8,0.05)' }}
                >
                  <span className="text-lg shrink-0">{m.tipo === 'entrada' ? '📥' : '📤'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                      {m.tipo === 'entrada' ? '+' : '−'} {fmtQtd(m.quantidade)} {histIngrediente?.unidade}
                    </p>
                    {m.motivo && (
                      <p className="text-xs truncate opacity-55" style={{ color: 'var(--color-text)' }}>{m.motivo}</p>
                    )}
                  </div>
                  <p className="text-xs shrink-0 tabular-nums opacity-45" style={{ color: 'var(--color-text)' }}>
                    {new Date(m.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
