import { useState } from 'react'
import { useReceitas, CATEGORIAS } from '../stores/useReceitas'
import { useEstoque } from '../stores/useEstoque'
import { Modal } from '../components/Modal'
import { SearchInput } from '../components/SearchInput'
import { PrecificacaoPanel } from './Precificacao'

// ─── constantes ──────────────────────────────────────────────────────────────

const UNIDADES_ING = ['g', 'kg', 'ml', 'L', 'unidade', 'colher (sopa)', 'colher (chá)', 'xícara']

const EMPTY = {
  nome: '',
  descricao: '',
  categoria: 'classico',
  ehReceitaBase: false,
  emoji: '🍪',
  cookieDoMes: false,
  rendimento: 12,
  tempoPreparo: 30,
  tempoForno: 15,
  observacoes: '',
  ingredientes: [],
}

const BASE_GRADIENT = 'linear-gradient(135deg,#5D4037 0%,#8D6E63 100%)'

// ─── helpers ─────────────────────────────────────────────────────────────────

function catById(id) {
  return CATEGORIAS.find((c) => c.id === id) ?? CATEGORIAS[0]
}

function catForReceita(r) {
  if (r.ehReceitaBase) return { gradient: BASE_GRADIENT, label: 'Massa Base' }
  return catById(r.categoria)
}

function SecTitle({ children }) {
  return (
    <p
      className="text-[11px] font-black uppercase tracking-widest mb-3"
      style={{ color: 'var(--color-accent-dark)', letterSpacing: '0.1em', opacity: 0.75 }}
    >
      {children}
    </p>
  )
}

const Divider = () => (
  <hr style={{ border: 'none', borderTop: '1.5px solid rgba(29,16,8,0.08)', margin: '1.25rem 0' }} />
)

function ReceitaCard({ receita, onClick }) {
  const cat = catForReceita(receita)
  const totalMin = (receita.tempoPreparo ?? 0) + (receita.tempoForno ?? 0)

  return (
    <button
      onClick={onClick}
      className="bfy-card text-left w-full overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none"
      style={{ cursor: 'pointer' }}
    >
      {/* Header visual */}
      <div
        className="flex items-center justify-center"
        style={{
          background: cat.gradient,
          height: 96,
          position: 'relative',
        }}
      >
        {/* Emoji da receita */}
        <span style={{ fontSize: '3rem', lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))' }}>
          {receita.emoji ?? (receita.ehReceitaBase ? '🧱' : '🍪')}
        </span>

        {/* Badge "Massa Base" */}
        {receita.ehReceitaBase && (
          <span
            className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', letterSpacing: '0.04em' }}
          >
            BASE
          </span>
        )}

        {/* Badge "Cookie do Mês" */}
        {receita.cookieDoMes && !receita.ehReceitaBase && (
          <span
            className="absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{ background: '#fff', color: 'var(--color-accent-dark)', letterSpacing: '0.04em' }}
          >
            ★ Do Mês
          </span>
        )}
      </div>

      {/* Corpo */}
      <div className="p-4">
        {/* Categoria */}
        <span
          className="inline-block text-[10px] font-black uppercase tracking-widest mb-2"
          style={{ color: receita.ehReceitaBase ? '#8D6E63' : 'var(--color-accent-dark)', opacity: 0.85 }}
        >
          {cat.label}
        </span>

        {/* Nome */}
        <h3
          className="font-black text-base leading-snug mb-1"
          style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}
        >
          {receita.nome}
        </h3>

        {/* Descrição */}
        {receita.descricao && (
          <p
            className="text-xs leading-relaxed mb-3 line-clamp-2"
            style={{ color: 'var(--color-text)', opacity: 0.55 }}
          >
            {receita.descricao}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 mt-auto">
          {receita.rendimento > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text)', opacity: 0.5 }}>
              🍪 {receita.rendimento} un.
            </span>
          )}
          {totalMin > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text)', opacity: 0.5 }}>
              ⏱ {totalMin} min
            </span>
          )}
          {(receita.ingredientes ?? []).length > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text)', opacity: 0.5 }}>
              {(receita.ingredientes).length} ing.
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── formulário ──────────────────────────────────────────────────────────────

function ReceitaForm({ initial, onSave, onDelete, onClose }) {
  const { ingredientes: ingEstoque } = useEstoque()
  const { receitas } = useReceitas()
  const baseReceitas = receitas.filter((r) => r.ehReceitaBase && r.id !== initial?.id)
  const [form, setForm] = useState({ ...EMPTY, ...initial, ingredientes: initial?.ingredientes ?? [] })
  const [novoIng, setNovoIng] = useState({ tipo: 'ingrediente', nome: '', ingredienteId: '', receitaBaseId: '', quantidade: '', unidade: 'g' })

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function addIngrediente() {
    const qtd = parseFloat(novoIng.quantidade)
    if (!qtd || qtd <= 0) return
    if (novoIng.tipo === 'base') {
      if (!novoIng.receitaBaseId) return
      const base = baseReceitas.find((r) => r.id === novoIng.receitaBaseId)
      if (!base) return
      set('ingredientes', [...form.ingredientes, {
        tipo: 'base',
        receitaBaseId: novoIng.receitaBaseId,
        nome: base.nome,
        quantidade: qtd,
        unidade: novoIng.unidade,
      }])
    } else {
      let ing = { ...novoIng, quantidade: qtd }
      if (ing.ingredienteId) {
        const found = ingEstoque.find((i) => i.id === ing.ingredienteId)
        if (found) { ing.nome = found.nome; ing.unidade = found.unidade }
      }
      if (!ing.nome.trim() && !ing.ingredienteId) return
      set('ingredientes', [...form.ingredientes, ing])
    }
    setNovoIng({ tipo: novoIng.tipo, nome: '', ingredienteId: '', receitaBaseId: '', quantidade: '', unidade: 'g' })
  }

  function removeIng(idx) {
    set('ingredientes', form.ingredientes.filter((_, i) => i !== idx))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit}>

      {/* ── Identidade ── */}
      <SecTitle>Identidade</SecTitle>

      <div className="grid grid-cols-[1fr_auto] gap-3 mb-4">
        <label className="block">
          <span className="bfy-label">Nome da receita *</span>
          <input className="bfy-input" required value={form.nome}
            onChange={(e) => set('nome', e.target.value)} placeholder="Ex: Chocolate Chip" />
        </label>
        <label className="block">
          <span className="bfy-label">Emoji</span>
          <input
            className="bfy-input text-center text-2xl"
            style={{ width: 60 }}
            value={form.emoji}
            onChange={(e) => set('emoji', e.target.value)}
          />
        </label>
      </div>

      <div className="mb-4">
        <span className="bfy-label">Categoria</span>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIAS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => set('categoria', cat.id)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: form.categoria === cat.id ? cat.gradient : 'transparent',
                color: form.categoria === cat.id ? '#fff' : 'var(--color-text)',
                border: `2px solid ${form.categoria === cat.id ? 'transparent' : 'rgba(29,16,8,0.15)'}`,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle: Receita Base */}
      <div
        className="flex items-center justify-between p-3 rounded-xl mb-4 cursor-pointer select-none"
        style={{ background: form.ehReceitaBase ? 'rgba(93,64,55,0.1)' : 'rgba(29,16,8,0.05)' }}
        onClick={() => set('ehReceitaBase', !form.ehReceitaBase)}
      >
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>🧱 Massa Base</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text)', opacity: 0.5 }}>
            Massa reutilizável como ingrediente em outras receitas
          </p>
        </div>
        <div
          className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
          style={{ background: form.ehReceitaBase ? '#8D6E63' : 'rgba(29,16,8,0.2)' }}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
            style={{ left: form.ehReceitaBase ? '1.25rem' : '0.125rem' }}
          />
        </div>
      </div>

      {form.categoria === 'sazonal' && !form.ehReceitaBase && (
        <div
          className="flex items-center justify-between p-3 rounded-xl mb-4 cursor-pointer select-none"
          style={{ background: 'rgba(29,16,8,0.05)' }}
          onClick={() => set('cookieDoMes', !form.cookieDoMes)}
        >
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>★ Cookie do Mês</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text)', opacity: 0.5 }}>
              Destaca este sabor no dashboard
            </p>
          </div>
          <div
            className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
            style={{ background: form.cookieDoMes ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.2)' }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
              style={{ left: form.cookieDoMes ? '1.25rem' : '0.125rem' }}
            />
          </div>
        </div>
      )}

      <label className="block">
        <span className="bfy-label">Descrição breve (opcional)</span>
        <input className="bfy-input" value={form.descricao}
          onChange={(e) => set('descricao', e.target.value)}
          placeholder="Ex: Clássico americano, borda crocante..." />
      </label>

      <Divider />

      {/* ── Produção ── */}
      <SecTitle>Produção</SecTitle>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="bfy-label">Rendimento (un.)</span>
          <input className="bfy-input" type="number" min="1" value={form.rendimento}
            onChange={(e) => set('rendimento', parseInt(e.target.value) || 1)} />
        </label>
        <label className="block">
          <span className="bfy-label">Preparo (min)</span>
          <input className="bfy-input" type="number" min="0" value={form.tempoPreparo}
            onChange={(e) => set('tempoPreparo', parseInt(e.target.value) || 0)} />
        </label>
        <label className="block">
          <span className="bfy-label">Forno (min)</span>
          <input className="bfy-input" type="number" min="0" value={form.tempoForno}
            onChange={(e) => set('tempoForno', parseInt(e.target.value) || 0)} />
        </label>
      </div>

      <Divider />

      {/* ── Ingredientes ── */}
      <SecTitle>Ingredientes</SecTitle>

      {form.ingredientes.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {form.ingredientes.map((ing, idx) => (
            <div key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: ing.tipo === 'base' ? 'rgba(93,64,55,0.07)' : 'rgba(29,16,8,0.05)' }}>
              {ing.tipo === 'base'
                ? <span className="text-base flex-shrink-0">🧱</span>
                : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-accent)' }} />
              }
              <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {ing.nome || '—'}
              </span>
              {ing.tipo === 'base' && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(141,110,99,0.2)', color: '#8D6E63' }}>
                  base
                </span>
              )}
              <span className="text-sm tabular-nums" style={{ color: 'var(--color-text)', opacity: 0.55 }}>
                {ing.quantidade} {ing.unidade}
              </span>
              <button
                type="button"
                onClick={() => removeIng(idx)}
                className="w-6 h-6 flex items-center justify-center rounded-full text-base leading-none transition-all hover:bg-red-50"
                style={{ color: '#e57373' }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl p-3.5 space-y-2.5"
        style={{ background: 'rgba(29,16,8,0.04)', border: '1.5px dashed rgba(29,16,8,0.14)' }}>
        <p className="text-xs font-bold" style={{ color: 'var(--color-accent-dark)', opacity: 0.85 }}>
          Adicionar ingrediente
        </p>

        {/* Tabs: Ingrediente vs Massa Base */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'rgba(29,16,8,0.07)' }}>
          {[
            { id: 'ingrediente', label: 'Ingrediente' },
            { id: 'base', label: '🧱 Massa Base' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setNovoIng((n) => ({ ...n, tipo: t.id, ingredienteId: '', receitaBaseId: '', nome: '' }))}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: novoIng.tipo === t.id ? 'var(--color-surface)' : 'transparent',
                color: novoIng.tipo === t.id ? 'var(--color-accent-dark)' : 'var(--color-text)',
                fontWeight: novoIng.tipo === t.id ? 700 : 500,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {novoIng.tipo === 'base' ? (
          baseReceitas.length > 0 ? (
            <select className="bfy-input" value={novoIng.receitaBaseId}
              onChange={(e) => setNovoIng((n) => ({ ...n, receitaBaseId: e.target.value }))}>
              <option value="">— Selecionar massa base —</option>
              {baseReceitas.map((r) => (
                <option key={r.id} value={r.id}>{r.emoji ?? '🧱'} {r.nome}</option>
              ))}
            </select>
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-text)', opacity: 0.45 }}>
              💡 Crie uma receita e ative "Massa Base" para usá-la aqui
            </p>
          )
        ) : (
          <>
            {ingEstoque.length > 0 ? (
              <select className="bfy-input" value={novoIng.ingredienteId}
                onChange={(e) => setNovoIng((n) => ({ ...n, ingredienteId: e.target.value, nome: '' }))}>
                <option value="">— Escolher do estoque (opcional) —</option>
                {ingEstoque.map((i) => (
                  <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>
                ))}
              </select>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-text)', opacity: 0.45 }}>
                💡 Cadastre ingredientes no Estoque para vinculá-los aqui
              </p>
            )}
            {!novoIng.ingredienteId && (
              <input className="bfy-input" placeholder="Ou digite o nome do ingrediente"
                value={novoIng.nome}
                onChange={(e) => setNovoIng((n) => ({ ...n, nome: e.target.value }))} />
            )}
          </>
        )}

        <div className="flex gap-2">
          <input className="bfy-input flex-1" type="number" min="0.01" step="0.1"
            placeholder="Quantidade" value={novoIng.quantidade}
            onChange={(e) => setNovoIng((n) => ({ ...n, quantidade: e.target.value }))} />
          {(novoIng.tipo === 'base' || !novoIng.ingredienteId) && (
            <select className="bfy-input" style={{ width: 130 }} value={novoIng.unidade}
              onChange={(e) => setNovoIng((n) => ({ ...n, unidade: e.target.value }))}>
              {UNIDADES_ING.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
          <button type="button" className="btn-primary px-5 whitespace-nowrap" onClick={addIngrediente}>
            + Add
          </button>
        </div>
      </div>

      <Divider />

      {/* ── Modo de Preparo ── */}
      <SecTitle>Modo de Preparo</SecTitle>

      <textarea
        className="bfy-input"
        rows={4}
        placeholder="Descreva os passos, temperatura do forno, dicas de textura..."
        value={form.observacoes}
        onChange={(e) => set('observacoes', e.target.value)}
        style={{ resize: 'vertical' }}
      />

      {/* ── Ações ── */}
      <div className="flex gap-3 pt-5">
        {onDelete && (
          <button type="button" className="btn-ghost px-4 text-sm"
            style={{ color: '#e57373', borderColor: '#e57373' }}
            onClick={onDelete}>
            Excluir
          </button>
        )}
        <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">Salvar Receita</button>
      </div>
    </form>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────

export function Receitas() {
  const { receitas, adicionar, atualizar, remover } = useReceitas()
  const [search, setSearch] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [modal, setModal] = useState(null)
  const [finModal, setFinModal] = useState(false)

  const filtradas = receitas.filter((r) => {
    const matchSearch = r.nome.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFiltro === 'todas'
      || (catFiltro === 'base' && r.ehReceitaBase)
      || (catFiltro !== 'base' && !r.ehReceitaBase && r.categoria === catFiltro)
    return matchSearch && matchCat
  })

  // Bases primeiro, depois "cookie do mês", depois restante
  const ordenadas = [...filtradas].sort((a, b) => {
    if (a.ehReceitaBase && !b.ehReceitaBase) return -1
    if (!a.ehReceitaBase && b.ehReceitaBase) return 1
    if (a.cookieDoMes && !b.cookieDoMes) return -1
    if (!a.cookieDoMes && b.cookieDoMes) return 1
    return 0
  })

  function openEdit(r) { setModal(r) }
  function openNew() { setModal({ ...EMPTY, id: null }) }

  function handleSave(form) {
    if (modal?.id) {
      atualizar(modal.id, form)
    } else {
      adicionar(form)
    }
    setModal(null)
  }

  function handleDelete() {
    if (modal?.id && confirm('Excluir esta receita?')) {
      remover(modal.id)
      setModal(null)
    }
  }

  // Totais por categoria para o header
  const totalClassico = receitas.filter((r) => r.categoria === 'classico' && !r.ehReceitaBase).length
  const totalSazonal  = receitas.filter((r) => r.categoria === 'sazonal' && !r.ehReceitaBase).length
  const totalBase     = receitas.filter((r) => r.ehReceitaBase).length

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-3xl font-black leading-none"
            style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}
          >
            Receitas
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text)', opacity: 0.55 }}>
            {totalClassico} clássica{totalClassico !== 1 ? 's' : ''} · {totalSazonal} sazonal{totalSazonal !== 1 ? 'is' : ''}
            {totalBase > 0 && ` · ${totalBase} base${totalBase !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost px-4 py-2.5 text-sm" onClick={() => setFinModal(true)}>
            💶 Análise financeira
          </button>
          <button className="btn-primary px-5 py-2.5 text-sm" onClick={openNew}>
            + Nova Receita
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Busca */}
        <SearchInput
          className="w-52"
          placeholder="Buscar receita..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Tabs de categoria */}
        <div className="flex gap-1 rounded-2xl p-1" style={{ background: 'rgba(61,43,31,0.12)' }}>
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'base', label: '🧱 Base' },
            ...CATEGORIAS,
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCatFiltro(cat.id)}
              className="px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: catFiltro === cat.id ? 'var(--color-surface)' : 'transparent',
                color: catFiltro === cat.id ? 'var(--color-accent-dark)' : 'var(--color-text)',
                fontWeight: catFiltro === cat.id ? 700 : 500,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de receitas ── */}
      {ordenadas.length === 0 ? (
        <div className="bfy-card p-16 text-center">
          <p className="text-5xl mb-4">🍪</p>
          <p className="text-lg font-bold mb-1" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)', opacity: 0.55 }}>
            {receitas.length === 0 ? 'Nenhuma receita ainda' : 'Sem resultados'}
          </p>
          <p className="text-sm mb-5" style={{ color: 'var(--color-text)', opacity: 0.4 }}>
            {receitas.length === 0
              ? 'Adicione seus 4 sabores clássicos e o cookie do mês!'
              : 'Tente outro filtro ou busca'}
          </p>
          {receitas.length === 0 && (
            <button className="btn-primary px-6 py-2.5" onClick={openNew}>
              + Adicionar primeira receita
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {ordenadas.map((r) => (
            <ReceitaCard key={r.id} receita={r} onClick={() => openEdit(r)} />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {modal !== null && (
        <Modal
          title={modal.id ? 'Editar Receita' : 'Nova Receita'}
          onClose={() => setModal(null)}
          size="lg"
        >
          <ReceitaForm
            initial={modal}
            onSave={handleSave}
            onDelete={modal.id ? handleDelete : null}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {finModal && (
        <Modal title="Análise financeira da receita" onClose={() => setFinModal(false)} size="lg">
          <PrecificacaoPanel
            embed
            initialReceitaId={modal?.id ?? ''}
            onClose={() => setFinModal(false)}
          />
        </Modal>
      )}
    </div>
  )
}
