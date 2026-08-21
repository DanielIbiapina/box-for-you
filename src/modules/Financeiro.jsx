import { useMemo, useState } from 'react'
import { useFinanceiro } from '../stores/useFinanceiro'
import { usePedidosVendas } from '../stores/usePedidosVendas'
import { useEventos } from '../stores/useEventos'
import { useVendas } from '../stores/useVendas'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  CATEGORIAS_DESPESA,
  CATEGORIAS_VARIAVEIS,
  CATEGORIAS_TAXAS,
  labelCategoria,
} from '../lib/financeiroCategorias'
import { describePosSale } from '../lib/salesAnalytics'
import { readCookieCatalog } from '../lib/catalog'

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDay = (isoOrDay) => {
  const d = (isoOrDay ?? '').slice(0, 10)
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function monthKeyFromDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(mesRef, delta) {
  const [y, m] = mesRef.split('-').map(Number)
  const dt = new Date(y, m - 1 + delta, 1)
  return monthKeyFromDate(dt)
}

function labelMes(mesRef) {
  const [y, m] = mesRef.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

const EMPTY_FORM = {
  data: new Date().toISOString().slice(0, 10),
  categoria: 'materia-prima',
  valorEur: '',
  descricao: '',
  eventId: '',
  pago: true,
}

export function Financeiro() {
  const {
    despesas,
    custosFixos,
    adicionarDespesa,
    atualizarDespesa,
    removerDespesa,
    adicionarCustoFixo,
    removerCustoFixo,
    atualizarCustoFixo,
    despesaCustoFixoMes,
    setCustoFixoPago,
  } = useFinanceiro()
  const { pedidos } = usePedidosVendas()
  const { eventos } = useEventos()

  const [mesRef, setMesRef] = useState(() => monthKeyFromDate())
  const [tab, setTab] = useState('resumo') // resumo | saidas | fixos | entradas
  const [formModal, setFormModal] = useState(null) // 'new' | id | null
  const [form, setForm] = useState(EMPTY_FORM)
  const [novoFixoNome, setNovoFixoNome] = useState('')
  const catalog = useMemo(() => readCookieCatalog(), [])
  const { sales: posSales } = useVendas()

  const despesasMes = useMemo(
    () =>
      despesas.filter((d) => {
        const key = d.mesRef || (d.data ?? '').slice(0, 7)
        return key === mesRef
      }),
    [despesas, mesRef],
  )

  const saidasPagas = useMemo(
    () => despesasMes.filter((d) => d.pago !== false),
    [despesasMes],
  )

  const totalSaidas = useMemo(
    () => saidasPagas.reduce((s, d) => s + (Number(d.valorEur) || 0), 0),
    [saidasPagas],
  )

  const entradasPos = useMemo(
    () =>
      posSales.filter(
        (s) => (s.createdAt ?? '').startsWith(mesRef) && (s.totalEur ?? 0) > 0,
      ),
    [posSales, mesRef],
  )

  const entradasDiretas = useMemo(
    () =>
      pedidos.filter((p) => {
        if (p.status === 'cancelado') return false
        const day = (p.dataPedido || p.criadoEm || '').slice(0, 10)
        return day.startsWith(mesRef) && (p.totalEur ?? 0) > 0
      }),
    [pedidos, mesRef],
  )

  const totalPos = useMemo(
    () => entradasPos.reduce((s, x) => s + (x.totalEur ?? 0), 0),
    [entradasPos],
  )
  const totalDiretas = useMemo(
    () => entradasDiretas.reduce((s, x) => s + (x.totalEur ?? 0), 0),
    [entradasDiretas],
  )
  const totalEntradas = totalPos + totalDiretas
  const balanco = totalEntradas - totalSaidas

  const porCategoria = useMemo(() => {
    const map = {}
    for (const d of saidasPagas) {
      const k = d.categoria || 'outro'
      map[k] = (map[k] ?? 0) + (Number(d.valorEur) || 0)
    }
    return Object.entries(map)
      .map(([id, valor]) => ({ id, label: labelCategoria(id), valor }))
      .sort((a, b) => b.valor - a.valor)
  }, [saidasPagas])

  function openNew() {
    const today = new Date().toISOString().slice(0, 10)
    setForm({
      ...EMPTY_FORM,
      data: today.startsWith(mesRef) ? today : `${mesRef}-01`,
    })
    setFormModal('new')
  }

  function openEdit(d) {
    setForm({
      data: d.data ?? '',
      categoria: d.categoria ?? 'outro',
      valorEur: d.valorEur ?? '',
      descricao: d.descricao ?? '',
      eventId: d.eventId ?? '',
      pago: d.pago !== false,
    })
    setFormModal(d.id)
  }

  function saveDespesa(e) {
    e.preventDefault()
    const valor = parseFloat(form.valorEur)
    if (!form.data || !(valor > 0)) return
    const payload = {
      data: form.data,
      categoria: form.categoria,
      valorEur: valor,
      descricao: form.descricao,
      eventId: form.eventId || null,
      pago: form.pago,
      mesRef: form.data.slice(0, 7),
    }
    if (formModal === 'new') {
      adicionarDespesa({ ...payload, origem: 'manual' })
    } else {
      atualizarDespesa(formModal, payload)
    }
    setFormModal(null)
  }

  function addFixo() {
    const nome = novoFixoNome.trim()
    if (!nome) return
    adicionarCustoFixo({ nome, valorPadrao: 0 })
    setNovoFixoNome('')
  }

  const tabs = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'saidas', label: 'Saídas' },
    { id: 'fixos', label: 'Custos fixos' },
    { id: 'entradas', label: 'Entradas' },
  ]

  return (
    <div className="bfy-page space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="bfy-page-title">
            Entradas e Saídas
          </h1>
          <p className="text-sm mt-0.5 ink-3">
            Balanço do mês com vendas e gastos categorizados
          </p>
        </div>
        <button type="button" className="btn-accent shrink-0" onClick={openNew}>
          <Icon name="mais" size={15} /> Nova saída
        </button>
      </div>

      {/* Seletor de mês */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn-icon"
          aria-label="Mês anterior"
          onClick={() => setMesRef((m) => shiftMonth(m, -1))}
        >
          <Icon name="voltar" size={16} />
        </button>
        <span className="font-bold capitalize ink-1" style={{ fontSize: 'var(--text-md)' }}>
          {labelMes(mesRef)}
        </span>
        <button
          type="button"
          className="btn-icon"
          aria-label="Mês seguinte"
          onClick={() => setMesRef((m) => shiftMonth(m, 1))}
        >
          <Icon name="avancar" size={16} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Entradas" value={fmtEuro(totalEntradas)} tone="in" />
        <Kpi label="Saídas" value={fmtEuro(totalSaidas)} tone="out" />
        <Kpi
          label="Balanço"
          value={fmtEuro(balanco)}
          tone={balanco >= 0 ? 'in' : 'out'}
        />
      </div>

      {/* Tabs */}
      <div className="bfy-segment" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumo' && (
        <div className="space-y-4">
          <div className="bfy-card p-4 space-y-2">
            <p className="bfy-eyebrow">
              Origem das entradas
            </p>
            <Row label="Feiras (POS)" value={fmtEuro(totalPos)} />
            <Row label="Vendas diretas" value={fmtEuro(totalDiretas)} />
          </div>

          <div className="bfy-card p-4 space-y-2">
            <p className="bfy-eyebrow">
              Saídas por categoria
            </p>
            {porCategoria.length === 0 ? (
              <p className="text-sm ink-3">
                Sem saídas pagas neste mês.
              </p>
            ) : (
              porCategoria.map((c) => (
                <Row key={c.id} label={c.label} value={fmtEuro(c.valor)} />
              ))
            )}
          </div>

          <div className="bfy-card p-4 space-y-1">
            <p className="bfy-eyebrow mb-2">
              Categorias da planilha
            </p>
            <p className="text-xs mb-2 ink-3">
              Variáveis: {CATEGORIAS_VARIAVEIS.map((c) => c.label).join(', ')}.
            </p>
            <p className="text-xs ink-3">
              Taxas: {CATEGORIAS_TAXAS.map((c) => c.label).join(', ')}.
            </p>
          </div>
        </div>
      )}

      {tab === 'saidas' && (
        <div className="space-y-2">
          {despesasMes.length === 0 ? (
            <p className="text-sm text-center py-8 ink-3">
              Nenhuma saída neste mês. Usa “Nova saída” para registar.
            </p>
          ) : (
            despesasMes
              .slice()
              .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
              .map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openEdit(d)}
                  className="w-full text-left bfy-card p-3 transition-all hover:bg-black/[0.02]"
                >
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>
                        {d.descricao || labelCategoria(d.categoria)}
                      </p>
                      <p className="text-[11px] ink-3">
                        {fmtDay(d.data)} · {labelCategoria(d.categoria)}
                        {d.origem === 'inscricao-evento' ? ' · inscrição' : ''}
                        {d.origem === 'custo-fixo' ? ' · fixo' : ''}
                        {d.pago === false ? ' · por pagar' : ''}
                      </p>
                    </div>
                    <span
                      className="font-black tabular-nums shrink-0"
                      style={{ color: d.pago === false ? 'rgba(29,16,8,0.35)' : '#c44' }}
                    >
                      −{fmtEuro(d.valorEur)}
                    </span>
                  </div>
                </button>
              ))
          )}
        </div>
      )}

      {tab === 'fixos' && (
        <div className="space-y-3">
          <p className="text-xs ink-3">
            Marca o check quando o custo do mês já foi pago. Entra automaticamente nas saídas.
          </p>
          {custosFixos.map((c) => {
            const desp = despesaCustoFixoMes(c.id, mesRef)
            const pago = !!desp
            const valor = desp?.valorEur ?? c.valorPadrao ?? 0
            return (
              <div
                key={c.id}
                className="bfy-card p-3 flex items-center gap-3"
              >
                <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pago}
                    onChange={(e) => setCustoFixoPago(c, mesRef, e.target.checked, valor)}
                    className="w-5 h-5 accent-[var(--color-accent-dark)]"
                  />
                </label>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>
                    {c.nome}
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="bfy-input py-1.5 text-sm mt-1 max-w-[140px]"
                    value={valor || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0
                      atualizarCustoFixo(c.id, { valorPadrao: v })
                      if (pago) setCustoFixoPago(c, mesRef, true, v)
                    }}
                  />
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className="text-sm font-black tabular-nums"
                    style={{ color: pago ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.35)' }}
                  >
                    {fmtEuro(valor)}
                  </span>
                  <button
                    type="button"
                    className="text-[11px] opacity-40 hover:opacity-80"
                    style={{ color: 'var(--color-danger)' }}
                    onClick={() => {
                      if (confirm(`Remover “${c.nome}” dos custos fixos?`)) removerCustoFixo(c.id)
                    }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            )
          })}

          <div className="flex gap-2">
            <input
              className="bfy-input flex-1"
              placeholder="Novo custo fixo…"
              value={novoFixoNome}
              onChange={(e) => setNovoFixoNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFixo())}
            />
            <button type="button" className="btn-ghost" onClick={addFixo}>
              Adicionar
            </button>
          </div>
        </div>
      )}

      {tab === 'entradas' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="bfy-eyebrow">
              Feiras (POS) · {fmtEuro(totalPos)}
            </p>
            {entradasPos.length === 0 ? (
              <p className="text-sm ink-3">Sem vendas POS neste mês.</p>
            ) : (
              <div className="space-y-1 max-h-[280px] overflow-y-auto">
                {entradasPos
                  .slice()
                  .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                  .map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg px-2.5 py-2 text-xs"
                      style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)' }}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="opacity-45">{fmtDay(s.createdAt)}</span>
                        <span className="font-black tabular-nums" style={{ color: 'var(--color-success)' }}>
                          +{fmtEuro(s.totalEur)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate ink-2">
                        {describePosSale(s, catalog)}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="bfy-eyebrow">
              Vendas diretas · {fmtEuro(totalDiretas)}
            </p>
            {entradasDiretas.length === 0 ? (
              <p className="text-sm ink-3">Sem pedidos neste mês.</p>
            ) : (
              <div className="space-y-1 max-h-[280px] overflow-y-auto">
                {entradasDiretas
                  .slice()
                  .sort((a, b) =>
                    (b.dataPedido || b.criadoEm || '').localeCompare(a.dataPedido || a.criadoEm || ''),
                  )
                  .map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg px-2.5 py-2 text-xs"
                      style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)' }}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="opacity-45">{fmtDay(p.dataPedido || p.criadoEm)}</span>
                        <span className="font-black tabular-nums" style={{ color: 'var(--color-success)' }}>
                          +{fmtEuro(p.totalEur)}
                        </span>
                      </div>
                      <p className="mt-0.5 ink-2">
                        {p.formaPagamento || 'Pedido'} · {p.status}
                        {(p.desconto ?? 0) > 0 ? ` · −${fmtEuro(p.desconto)} desc.` : ''}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {formModal !== null && (
        <Modal
          title={formModal === 'new' ? 'Nova saída' : 'Editar saída'}
          onClose={() => setFormModal(null)}
          size="sm"
        >
          <form onSubmit={saveDespesa} className="space-y-3">
            <label className="block">
              <span className="bfy-label">Data *</span>
              <input
                className="bfy-input"
                type="date"
                required
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="bfy-label">Categoria *</span>
              <select
                className="bfy-input"
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              >
                {CATEGORIAS_DESPESA.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="bfy-label">Valor (€) *</span>
              <input
                className="bfy-input"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.valorEur}
                onChange={(e) => setForm((f) => ({ ...f, valorEur: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="bfy-label">Descrição</span>
              <input
                className="bfy-input"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex.: compra Continente 13.07"
              />
            </label>
            <label className="block">
              <span className="bfy-label">Evento / feira (opcional)</span>
              <select
                className="bfy-input"
                value={form.eventId}
                onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}
              >
                <option value="">— Nenhum —</option>
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.nome}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={form.pago}
                onChange={(e) => setForm((f) => ({ ...f, pago: e.target.checked }))}
                className="w-4 h-4"
              />
              Já foi pago
            </label>
            <div className="flex gap-2 pt-2">
              {formModal !== 'new' && (
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  style={{ color: 'var(--color-danger)' }}
                  onClick={() => {
                    if (confirm('Excluir esta saída?')) {
                      removerDespesa(formModal)
                      setFormModal(null)
                    }
                  }}
                >
                  Excluir
                </button>
              )}
              <button type="button" className="btn-ghost flex-1" onClick={() => setFormModal(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary flex-1">
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Kpi({ label, value, tone }) {
  const accent = tone === 'in'
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: accent ? 'rgba(46,125,50,0.08)' : 'var(--color-accent-soft)',
        border: `1px solid ${accent ? 'rgba(46,125,50,0.18)' : 'rgba(154,59,28,0.15)'}`,
      }}
    >
      <div className="bfy-eyebrow">
        {label}
      </div>
      <div
        className="text-base font-black tabular-nums mt-0.5"
        style={{ color: accent ? 'var(--color-success)' : 'var(--color-accent-dark)' }}
      >
        {value}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="truncate ink-2">{label}</span>
      <span className="font-bold tabular-nums shrink-0" style={{ color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}
