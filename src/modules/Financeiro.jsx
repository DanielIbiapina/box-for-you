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
import { describePosSale, todayKey } from '../lib/salesAnalytics'
import { withLegacyCookies } from '../lib/catalog'
import { useCookies } from '../stores/useCookies'
import { contasDoMes, mesDaDespesa } from '../lib/contas'
import { SearchInput } from '../components/SearchInput'

/** Para pesquisar sem ligar a maiúsculas nem acentos ("cafe" encontra "Café"). */
const semAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

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
  data: todayKey(),
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
  const { cookies: cookiesAtivos } = useCookies()
  const catalog = useMemo(() => withLegacyCookies(cookiesAtivos), [cookiesAtivos])
  const { sales: posSales } = useVendas()

  // As contas do mês vêm de lib/contas.js — as mesmas regras do Início e dos Relatórios.
  const contas = useMemo(
    () => contasDoMes({ sales: posSales, pedidos, despesas }, mesRef),
    [posSales, pedidos, despesas, mesRef],
  )
  const {
    pos: entradasPos, diretas: entradasDiretas, saidas: saidasPagas,
    totalPos, totalDiretas, taxaMultibanco,
    entradas: totalEntradas, totalSaidas, balanco,
  } = contas

  /** Todas as saídas do mês, pagas e por pagar (a lista mostra as duas). */
  const despesasMes = useMemo(
    () => despesas.filter((d) => mesDaDespesa(d) === mesRef),
    [despesas, mesRef],
  )

  // ── Filtros da lista de saídas ──────────────────────────────────────────────
  const [busca, setBusca] = useState('')
  const [filtroCat, setFiltroCat] = useState('todas') // 'todas' | id da categoria | 'por-pagar'
  const [todosMeses, setTodosMeses] = useState(false)

  const baseSaidas = todosMeses ? despesas : despesasMes
  const categoriasPresentes = useMemo(() => {
    const ids = [...new Set(baseSaidas.map((d) => d.categoria || 'outro'))]
    return ids
      .map((id) => ({ id, label: labelCategoria(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt'))
  }, [baseSaidas])
  const haPorPagar = baseSaidas.some((d) => d.pago === false)

  const saidasFiltradas = useMemo(() => {
    const q = semAcentos(busca.trim())
    return baseSaidas
      .filter((d) => {
        if (filtroCat === 'por-pagar') { if (d.pago !== false) return false }
        else if (filtroCat !== 'todas' && (d.categoria || 'outro') !== filtroCat) return false
        if (!q) return true
        return semAcentos(d.descricao).includes(q) || semAcentos(labelCategoria(d.categoria)).includes(q)
      })
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  }, [baseSaidas, filtroCat, busca])
  const totalFiltradoPago = saidasFiltradas
    .filter((d) => d.pago !== false)
    .reduce((s, d) => s + (Number(d.valorEur) || 0), 0)
  const totalFiltradoPorPagar = saidasFiltradas
    .filter((d) => d.pago === false)
    .reduce((s, d) => s + (Number(d.valorEur) || 0), 0)
  const filtrando = busca.trim() !== '' || filtroCat !== 'todas' || todosMeses

  /** A despesa aberta no formulário é a inscrição automática de uma feira? */
  const despesaEmEdicao = typeof formModal === 'string' && formModal !== 'new'
    ? despesas.find((d) => d.id === formModal) ?? null
    : null
  const inscricaoDaFeira = despesaEmEdicao?.origem === 'inscricao-evento'
    ? eventos.find((ev) => ev.id === despesaEmEdicao.eventId) ?? null
    : null
  const ehInscricaoAuto = despesaEmEdicao?.origem === 'inscricao-evento'

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
    const today = todayKey()
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
            {taxaMultibanco > 0 && (
              <Row label="Taxa Multibanco (1,5%)" value={`−${fmtEuro(taxaMultibanco)}`} />
            )}
            {taxaMultibanco > 0 && (
              <div className="flex justify-between gap-3 text-sm pt-2" style={{ borderTop: '1px solid var(--line-1)' }}>
                <span className="font-bold ink-1">Entradas líquidas</span>
                <span className="font-black tabular-nums" style={{ color: 'var(--color-text)' }}>
                  {fmtEuro(totalEntradas)}
                </span>
              </div>
            )}
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
          {/* Filtros: texto (ex.: "lidl", "café"), categoria e período */}
          <div className="space-y-2.5 pb-1">
            <SearchInput
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar (ex.: Lidl, café, River Market)"
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'todas', label: 'Todas' },
                ...categoriasPresentes,
                ...(haPorPagar ? [{ id: 'por-pagar', label: 'Por pagar' }] : []),
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`bfy-chip ${filtroCat === c.id ? 'bfy-chip-accent' : ''}`}
                  aria-pressed={filtroCat === c.id}
                  onClick={() => setFiltroCat(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs ink-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={todosMeses}
                onChange={(e) => setTodosMeses(e.target.checked)}
              />
              Procurar em todos os meses
            </label>
            {filtrando && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="ink-3">
                  {saidasFiltradas.length} saída{saidasFiltradas.length !== 1 ? 's' : ''}
                  {todosMeses ? ' (todos os meses)' : ''}
                </span>
                <span className="font-black tabular-nums" style={{ color: '#c44' }}>
                  −{fmtEuro(totalFiltradoPago)}
                  {totalFiltradoPorPagar > 0 && (
                    <span className="font-semibold ink-3"> · {fmtEuro(totalFiltradoPorPagar)} por pagar</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {saidasFiltradas.length === 0 ? (
            <p className="text-sm text-center py-8 ink-3">
              {filtrando
                ? 'Nenhuma saída com estes filtros.'
                : 'Nenhuma saída neste mês. Usa “Nova saída” para registar.'}
            </p>
          ) : (
            saidasFiltradas
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
            {ehInscricaoAuto && (
              <p className="bfy-sunk p-3 text-xs ink-2">
                Esta é a inscrição da feira
                {inscricaoDaFeira ? <> <strong>{inscricaoDaFeira.nome}</strong> de {fmtDay(inscricaoDaFeira.data)}</> : ''}.
                {' '}O valor e a data vêm da feira: para os mudar (ou pôr a inscrição a zero),
                edita a feira em <strong>Definições → Eventos & Feiras</strong>.
              </p>
            )}
            <label className="block">
              <span className="bfy-label">Data *</span>
              <input
                className="bfy-input"
                type="date"
                required
                disabled={ehInscricaoAuto}
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="bfy-label">Categoria *</span>
              <select
                className="bfy-input"
                disabled={ehInscricaoAuto}
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
                disabled={ehInscricaoAuto}
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
                disabled={ehInscricaoAuto}
                value={form.eventId}
                onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}
              >
                <option value="">— Nenhum —</option>
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.nome} · {fmtDay(ev.data)}</option>
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
              {formModal !== 'new' && !ehInscricaoAuto && (
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
