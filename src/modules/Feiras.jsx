import { useEffect, useMemo, useRef, useState } from 'react'
import { useCookies } from '../stores/useCookies'
import { useEstoqueCookies } from '../stores/useEstoqueCookies'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { FeiraHistoricoPanel } from '../components/FeiraHistoricoPanel'
import { FeiraCardapio } from '../components/FeiraCardapio'
import { useEventos } from '../stores/useEventos'
import { useVendas } from '../stores/useVendas'
import { listFeirasWithStats, formatEventDateRange } from '../lib/feiraHistory'
import { menuCookies, MINI_BOX_ID, TASTING_BOX_ID } from '../lib/catalog'
import { todayKey, filterSalesByDay, computePosMetrics, topFlavorsRanking } from '../lib/salesAnalytics'
import { isSupabaseConfigured } from '../lib/supabase'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAYMENTS = [
  { id: 'dinheiro',    label: 'Dinheiro' },
  { id: 'mbway',       label: 'MB WAY' },
  { id: 'multibanco',  label: 'Multibanco' },
]


// ─── Utilitários ──────────────────────────────────────────────────────────────

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

function initialBoxCounts(cookies) {
  return Object.fromEntries(cookies.map((c) => [c.id, 0]))
}

function boxTotalCount(boxCounts) {
  return Object.values(boxCounts).reduce((acc, v) => acc + (v ?? 0), 0)
}

function flattenBoxToArray(boxCounts) {
  const arr = []
  for (const [id, n] of Object.entries(boxCounts)) {
    for (let i = 0; i < n; i++) arr.push(id)
  }
  return arr
}

function formatBoxCountsSummary(boxCounts, cookies) {
  return cookies
    .filter((c) => (boxCounts[c.id] ?? 0) > 0)
    .map((c) => `${boxCounts[c.id]}× ${c.short}`)
    .join(' · ')
}

function paymentLabel(id) {
  if (id === 'gratis') return 'Prova grátis'
  return PAYMENTS.find((p) => p.id === id)?.label ?? id
}

function productMeta(productId, cookies, line = null) {
  if (line?.customLabel) {
    return { nome: line.customLabel, short: line.customLabel, emoji: line.customEmoji ?? '✨', image: '' }
  }
  const c = cookies.find((c) => c.id === productId)
  if (c) return { nome: c.nome, short: c.short, emoji: c.emoji, image: c.image }
  if (productId === MINI_BOX_ID) return { nome: 'Box Mini Cookies', short: 'Box Mini', emoji: '🍪', image: '' }
  if (productId === TASTING_BOX_ID) return { nome: 'Tasting Box', short: 'Tasting Box', emoji: '🍪', image: '' }
  return { nome: productId, short: productId, emoji: '❓', image: '' }
}

function getPrice(productId, cookies, miniBoxPrice, line = null, tastingBoxPrice = 16) {
  if (line?.unitPrice != null) return line.unitPrice
  const c = cookies.find((c) => c.id === productId)
  if (c) return c.price
  if (productId === MINI_BOX_ID) return miniBoxPrice
  if (productId === TASTING_BOX_ID) return tastingBoxPrice
  return 0
}

function cartPieces(cart) {
  return Object.values(cart).reduce((acc, v) => acc + (v ?? 0), 0)
}

function buildCartLines(cart, customMeta = {}) {
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({
      productId,
      qty,
      ...(customMeta[productId] ?? {}),
    }))
}

function cartTotal(cart, cookies, miniBoxPrice, customMeta = {}, tastingBoxPrice = 16) {
  return buildCartLines(cart, customMeta).reduce(
    (sum, ln) => sum + getPrice(ln.productId, cookies, miniBoxPrice, ln, tastingBoxPrice) * ln.qty,
    0,
  )
}

function saleDescription(s, cookies) {
  if (s.kind === 'demo') {
    const m = productMeta(s.demoFlavorId, cookies)
    return `Demo (${m.short}) · grátis`
  }
  if (s.kind === 'order') {
    return (s.lines ?? [])
      .map((ln) => `${ln.qty}× ${productMeta(ln.productId, cookies, ln).short}`)
      .join(', ')
  }
  if (s.kind === 'box') {
    const counts = {}
    for (const id of s.boxFlavors ?? []) counts[id] = (counts[id] ?? 0) + 1
    return 'BOX · ' + Object.entries(counts)
      .map(([id, n]) => `${n}× ${productMeta(id, cookies).short}`)
      .join(' · ')
  }
  return String(s.kind)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function Feiras({ onPosModeChange, perfilFeira = false }) {
  const {
    cookies, boxConfig, miniBoxConfig, tastingBoxConfig,
    setBoxConfig, setMiniBoxConfig,
  } = useCookies()

  const { deductSale, deductSale50, stockCookies50 } = useEstoqueCookies()

  const { eventos } = useEventos()

  const { sales, addSale, removeSale } = useVendas()

  const [view,    setView]    = useState('landing') // 'landing' | 'pos' | 'cardapio'
  const [cart,    setCart]    = useState({})
  const [order,   setOrder]   = useState(null)
  const [payment, setPayment] = useState(null)
  const [desconto, setDesconto] = useState(0)
  const [paymentFilter, setPaymentFilter] = useState('all') // 'all' | payment id | 'gratis'
  const [toast,   setToast]   = useState(null)
  const [historicoEvent, setHistoricoEvent] = useState(null)
  const toastRef = useRef(0)

  const menuItems = useMemo(() => menuCookies(cookies), [cookies])
  const dayKey = todayKey()
  const todaySales = useMemo(() => filterSalesByDay(sales, dayKey), [sales, dayKey])


  useEffect(() => () => clearTimeout(toastRef.current), [])

  useEffect(() => {
    onPosModeChange?.(view === 'pos')
    return () => onPosModeChange?.(false)
  }, [view, onPosModeChange])

  const metricsAll = useMemo(() => computePosMetrics(sales, cookies), [sales, cookies])
  const metrics = useMemo(() => computePosMetrics(todaySales, cookies), [todaySales, cookies])
  const feirasHistorico = useMemo(
    () => listFeirasWithStats(sales, eventos, cookies),
    [sales, eventos, cookies],
  )

  /** Evento agendado para hoje — as vendas do caixa serão atribuídas a ele */
  const feiraDeHoje = useMemo(
    () => eventos.find((e) => e.data === dayKey) ?? null,
    [eventos, dayKey],
  )

  function notify(msg) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2400)
  }

  function addToCart(productId) {
    setOrder((prev) => {
      if (prev?.kind === 'demo') {
        notify('Demo cancelada — lista avulsa em uso.')
        return null
      }
      return prev
    })
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }))
  }

  function changeQty(productId, delta) {
    setCart((prev) => {
      const next = (prev[productId] ?? 0) + delta
      if (next <= 0) { const c = { ...prev }; delete c[productId]; return c }
      return { ...prev, [productId]: next }
    })
  }

  function startBox() {
    setOrder({ kind: 'box', boxCounts: initialBoxCounts(menuItems), demoFlavorId: null })
  }

  function startDemo() {
    setCart((prev) => {
      if (cartPieces(prev) > 0) notify('Lista avulsa limpa.')
      return {}
    })
    setOrder({ kind: 'demo', boxCounts: initialBoxCounts(cookies), demoFlavorId: null })
    setPayment(null)
    setDesconto(0)
  }

  function changeBoxCount(flavorId, delta) {
    setOrder((prev) => {
      if (!prev || prev.kind !== 'box') return prev
      const counts = { ...prev.boxCounts }
      if (delta > 0 && boxTotalCount(counts) >= boxConfig.size) {
        notify(`Máximo ${boxConfig.size} cookies na BOX.`)
        return prev
      }
      counts[flavorId] = Math.max(0, (counts[flavorId] ?? 0) + delta)
      return { ...prev, boxCounts: counts }
    })
  }

  function setDemoFlavor(id) {
    setOrder((prev) => prev?.kind === 'demo' ? { ...prev, demoFlavorId: id } : prev)
  }

  function cancelCheckout() {
    if (order?.kind === 'box' || order?.kind === 'demo') {
      setOrder(null)
      setPayment(null)
      setDesconto(0)
      return
    }
    setCart({})
    setPayment(null)
    setDesconto(0)
  }

  function cancelBox() {
    setOrder((prev) => (prev?.kind === 'box' ? null : prev))
  }

  function confirmSale() {
    if (isSupabaseConfigured && !navigator.onLine) {
      notify('Sem internet — liga-te à rede para guardar na nuvem.')
      return
    }

    if (order?.kind === 'demo') {
      if (!order.demoFlavorId) { notify('Escolhe o sabor para a demonstração.'); return }
      addSale({
        kind: 'demo', demoFlavorId: order.demoFlavorId,
        flavorId: null, boxFlavors: [], paymentId: 'gratis', totalEur: 0,
      })
      deductSale([{ cookieId: order.demoFlavorId, qty: 1 }])
      setOrder(null); setPayment(null); setDesconto(0)
      notify('Demonstração registada')
      return
    }

    const nCart = cartPieces(cart)
    const hasBox = order?.kind === 'box'
    const boxReady = hasBox && boxFilled === boxConfig.size

    if (!hasBox && nCart === 0) { notify('Adiciona itens ou escolhe BOX / Demo.'); return }
    if (hasBox && !boxReady && nCart === 0) { notify(`Seleciona exatamente ${boxConfig.size} cookies na BOX.`); return }
    if (hasBox && !boxReady && nCart > 0) { notify(`Completa a BOX (${boxFilled}/${boxConfig.size}) ou remove-a para confirmar só os avulsos.`); return }
    if (!payment) { notify('Seleciona o método de pagamento.'); return }

    const newSales = []
    const deductItems = []
    const deductItems50 = []
    const disc = Math.max(0, Number(desconto) || 0)

    if (nCart > 0) {
      const full = cartTotal(cart, cookies, miniBoxConfig.price, {}, tastingBoxConfig.price)
      newSales.push({
        id: uid(), createdAt: new Date().toISOString(),
        kind: 'order', lines: buildCartLines(cart),
        flavorId: null, boxFlavors: [], paymentId: payment,
        totalEur: full,
        desconto: 0,
        eventId: null,
      })
      for (const [productId, qty] of Object.entries(cart)) {
        if (productId.startsWith('custom-')) continue
        if (productId === TASTING_BOX_ID) {
          // Cada Tasting Box leva 1 cookie de 50g de cada sabor ativo no cardápio
          for (const c of menuItems) deductItems50.push({ cookieId: c.id, qty })
        } else {
          deductItems.push({ cookieId: productId, qty })
        }
      }
    }

    if (boxReady) {
      newSales.push({
        id: uid(), createdAt: new Date().toISOString(),
        kind: 'box', flavorId: null,
        boxFlavors: flattenBoxToArray(order.boxCounts),
        paymentId: payment, totalEur: boxConfig.price,
        desconto: 0,
      })
      for (const [flavorId, qty] of Object.entries(order.boxCounts)) {
        if (qty > 0) deductItems.push({ cookieId: flavorId, qty })
      }
    }

    // Alocar desconto inteiro na primeira venda paga
    if (disc > 0 && newSales.length > 0) {
      const applied = Math.min(disc, newSales[0].totalEur)
      newSales[0] = {
        ...newSales[0],
        desconto: applied,
        totalEur: Math.max(0, newSales[0].totalEur - applied),
      }
    }

    newSales.forEach((s) => addSale(s))
    deductSale(deductItems)
    deductSale50(deductItems50)
    setCart({})
    setOrder(null)
    setPayment(null)
    setDesconto(0)
    notify(newSales.length > 1 ? 'Vendas registadas' : 'Venda registada')
  }


  function deleteLastSale() {
    if (!sales.length) return
    if (!confirm('Excluir o último registo?')) return
    removeSale(sales[0].id)
  }

  function deleteSale(id) {
    if (!confirm('Excluir este registo?')) return
    removeSale(id)
  }


  function exportTxt() {
    const lines = [
      'Relatório — Crumb Lab',
      `Gerado em: ${new Date().toLocaleString('pt-PT')}`,
      '',
      `Total: ${fmtEuro(metrics.total)}`,
      `Vendas pagas: ${metrics.revenueSales}  ·  Demonstrações: ${metrics.demoCount.total}`,
      '',
      'Cookies vendidos:',
      ...cookies.map((c) => `  ${c.nome}: ${metrics.byCookie[c.id] ?? 0}`),
      '',
      'Por pagamento:',
      ...PAYMENTS.map((p) => {
        const r = metrics.byPayment[p.id]
        return `  ${p.label}: ${r.count}x — ${fmtEuro(r.eur)}`
      }),
      '',
      'Últimos 50 registos:',
      ...sales.slice(0, 50).map((s) => {
        const disc = (s.desconto ?? 0) > 0 ? ` (−${fmtEuro(s.desconto)})` : ''
        return `  ${fmtTime(s.createdAt)} | ${saleDescription(s, cookies)} | ${paymentLabel(s.paymentId)} | ${fmtEuro(s.totalEur ?? 0)}${disc}`
      }),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `crumb-lab-${new Date().toISOString().slice(0, 10)}.txt`,
    })
    document.body.appendChild(a); a.click(); a.remove()
  }

  // ── Valores derivados ─────────────────────────────────────────────────────

  const nCart      = cartPieces(cart)
  const boxFilled  = order?.kind === 'box' ? boxTotalCount(order.boxCounts) : 0
  const boxReady   = order?.kind === 'box' && boxFilled === boxConfig.size
  const cartTotalEur = cartTotal(cart, cookies, miniBoxConfig.price, {}, tastingBoxConfig.price)
  const checkoutTotal = cartTotalEur + (boxReady ? boxConfig.price : 0)
  const descontoAplicado = Math.min(Math.max(0, Number(desconto) || 0), checkoutTotal)
  const totalFinal = Math.max(0, checkoutTotal - descontoAplicado)

  const canConfirm = order?.kind === 'demo'
    ? !!order.demoFlavorId
    : order?.kind === 'box'
      ? boxReady && !!payment
      : nCart > 0 && !!payment

  function confirmBtnText() {
    if (order?.kind === 'demo') return order.demoFlavorId ? 'Confirmar prova grátis' : 'Escolhe o sabor'
    if (order?.kind === 'box') {
      if (boxFilled < boxConfig.size) return `Faltam ${boxConfig.size - boxFilled} cookie(s) na BOX`
      if (!payment) return 'Escolhe o pagamento'
      return `Confirmar ${fmtEuro(totalFinal)}`
    }
    if (nCart > 0) return payment ? `Confirmar ${fmtEuro(totalFinal)}` : 'Escolhe o pagamento'
    return 'Seleciona itens'
  }

  const todayRanking = useMemo(() => topFlavorsRanking(todaySales, cookies, 12), [todaySales, cookies])
  const maxRankBar = Math.max(...todayRanking.map((r) => r.qty), 1)
  const maxDemoBar = Math.max(...cookies.map((c) => metrics.demoCount.byFlavor[c.id] ?? 0), 1)

  const filteredTodaySales = useMemo(() => {
    if (paymentFilter === 'all') return todaySales
    if (paymentFilter === 'gratis') return todaySales.filter((s) => s.kind === 'demo' || s.paymentId === 'gratis')
    return todaySales.filter((s) => s.paymentId === paymentFilter && (s.totalEur ?? 0) > 0)
  }, [todaySales, paymentFilter])

  // ── View: Landing ─────────────────────────────────────────────────────────

  if (view === 'landing') {
    return (
      <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
        <div className="bfy-page space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="bfy-page-title">Feiras</h1>
              <p className="ink-3 mt-1" style={{ fontSize: 'var(--text-md)' }}>
                Caixa e histórico das feiras
              </p>
            </div>
            <button className="btn-ghost btn-sm shrink-0" disabled={!sales.length} onClick={exportTxt}>
              <Icon name="descarregar" size={15} /> Exportar
            </button>
          </div>

          {/* A que feira as vendas de hoje pertencem (a ligação é pela data) */}
          {feiraDeHoje && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
              style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(154,59,28,0.2)' }}
            >
              <span style={{ color: 'var(--color-accent-dark)' }}><Icon name="feiras" size={17} /></span>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-dark)' }}>
                Hoje é <strong>{feiraDeHoje.nome}</strong> — as vendas entram nesta feira
              </p>
            </div>
          )}

          {/* Caixa de hoje */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Caixa hoje', value: fmtEuro(metrics.total), destaque: true },
              { label: 'Vendas', value: metrics.revenueSales },
              { label: 'Provas', value: metrics.demoCount.total },
            ].map(({ label, value, destaque }) => (
              <div key={label} className="bfy-card p-4 text-center">
                <p
                  className="bfy-title bfy-num"
                  style={{ fontSize: 'var(--text-xl)', color: destaque ? 'var(--color-accent-dark)' : 'var(--ink-1)' }}
                >
                  {value}
                </p>
                <p className="ink-3 mt-1" style={{ fontSize: 'var(--text-xs)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Ação principal */}
          <button
            onClick={() => setView('pos')}
            className="w-full rounded-2xl p-6 flex items-center gap-4 text-left transition-transform active:scale-[0.99]"
            style={{ background: 'var(--color-primary)' }}
          >
            <span
              className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              <Icon name="carrinho" size={26} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="bfy-title block" style={{ fontSize: 'var(--text-xl)', color: 'var(--ink-on-dark)' }}>
                Abrir caixa
              </span>
              <span className="block mt-0.5" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-on-dark-2)' }}>
                Registar as vendas de hoje
              </span>
            </span>
            <span style={{ color: 'var(--ink-on-dark-3)' }}><Icon name="avancar" size={20} /></span>
          </button>

          {/* Cardápio */}
          <div className="bfy-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="bfy-eyebrow">Cardápio do caixa</h2>
              {!perfilFeira && (
                <button className="btn-ghost btn-sm" onClick={() => setView('cardapio')}>
                  <Icon name="editar" size={14} /> Gerir
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {menuItems.map((c) => (
                <div key={c.id} className="flex flex-col items-center gap-1">
                  <div
                    className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center"
                    style={{ background: 'var(--color-surface-sunk)' }}
                  >
                    {c.image
                      ? <img src={c.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                      : <span style={{ fontSize: '1.4rem' }}>{c.emoji}</span>
                    }
                  </div>
                  <p className="font-bold text-center leading-tight ink-2" style={{ fontSize: 'var(--text-2xs)' }}>{c.short}</p>
                  <p className="bfy-num font-bold" style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-accent-dark)' }}>
                    {fmtEuro(c.price)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--line-1)' }}>
              <span className="bfy-chip">BOX {boxConfig.size} cookies · {fmtEuro(boxConfig.price)}</span>
              <span className="bfy-chip">Box Mini · {fmtEuro(miniBoxConfig.price)}</span>
              <span className="bfy-chip">Tasting Box {menuItems.length} × 50g · {fmtEuro(tastingBoxConfig.price)}</span>
            </div>
          </div>

          {/* Histórico */}
          <div className="bfy-card p-4 space-y-3">
            <h2 className="bfy-eyebrow">Histórico de feiras</h2>
            {feirasHistorico.length === 0 ? (
              <div className="bfy-empty">
                <Icon name="feiras" size={28} />
                <p style={{ fontSize: 'var(--text-md)' }}>Ainda não há feiras com vendas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {feirasHistorico.map(({ ev, stats }) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setHistoricoEvent(ev)}
                    className="bfy-sunk w-full flex items-center gap-3 px-3 py-3 text-left transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate ink-1" style={{ fontSize: 'var(--text-md)' }}>{ev.nome}</p>
                      <p className="ink-3 mt-0.5" style={{ fontSize: 'var(--text-xs)' }}>
                        {formatEventDateRange(ev)}
                        {ev.local ? ` · ${ev.local}` : ''}
                        {stats.dayBreakdown.length > 1 ? ` · ${stats.dayBreakdown.length} dias` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="bfy-num font-bold" style={{ color: 'var(--color-accent-dark)', fontSize: 'var(--text-md)' }}>
                        {fmtEuro(stats.total)}
                      </p>
                      <p className="ink-4" style={{ fontSize: 'var(--text-2xs)' }}>
                        {stats.vendas} venda{stats.vendas !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="ink-4"><Icon name="avancar" size={16} /></span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {toast && <Toast msg={toast} />}

        {historicoEvent && (
          <Modal title={historicoEvent.nome} onClose={() => setHistoricoEvent(null)} size="lg">
            <FeiraHistoricoPanel evento={historicoEvent} sales={sales} catalog={cookies} />
          </Modal>
        )}
      </div>
    )
  }

  if (view === 'cardapio') {
    return (
      <>
        <FeiraCardapio onBack={() => setView('landing')} notify={notify} />
        {toast && <Toast msg={toast} />}
      </>
    )
  }

  // ── View: POS ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden select-none" style={{ background: 'var(--color-bg)' }}>

      {/* Header do POS */}
      <header
        className="shrink-0 flex items-center justify-between gap-4 px-4 py-2.5"
        style={{ background: 'var(--color-primary)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="flex items-center gap-1.5 shrink-0 font-semibold transition-opacity hover:opacity-100"
            style={{ color: 'var(--ink-on-dark-2)', fontSize: 'var(--text-sm)' }}
            onClick={() => { cancelCheckout(); setView('landing') }}
          >
            <Icon name="voltar" size={16} /> Voltar
          </button>
          <span className="opacity-20 shrink-0" style={{ color: 'var(--color-text-light)' }}>|</span>
          <span
            className="font-black text-sm truncate"
            style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text-light)' }}
          >
            Caixa · Crumb Lab
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-[11px] opacity-45 uppercase tracking-wide" style={{ color: 'var(--color-text-light)' }}>Caixa hoje</div>
            <div className="text-base font-black tabular-nums" style={{ color: 'var(--color-accent)' }}>
              {fmtEuro(metrics.total)}
            </div>
          </div>
          <button
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity opacity-60 hover:opacity-100"
            style={{ color: 'var(--color-text-light)', border: '1px solid rgba(239,228,203,0.25)' }}
            disabled={!sales.length}
            onClick={exportTxt}
          >
            Exportar
          </button>
        </div>
      </header>

      {/* Corpo */}
      <main className="flex flex-1 min-h-0 flex-col overflow-hidden lg:flex-row">

        {/* ── Cardápio ── */}
        <section
          className="flex min-h-0 flex-col px-3 py-3 sm:px-4 lg:border-r max-lg:max-h-[min(54dvh,540px)] max-lg:flex-none max-lg:overflow-y-auto lg:max-h-none lg:flex-[1.4] lg:overflow-y-auto"
          style={{ borderColor: 'var(--line-2)' }}
        >
          <div className="shrink-0 flex items-center justify-between mb-3">
            <span className="bfy-eyebrow">
              Cardápio
            </span>
            <span className="text-[11px] hidden sm:block ink-4">
              Toca para adicionar
            </span>
          </div>

          <div className="flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto lg:overflow-y-auto">
            {/* Grid de cookies */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {menuItems.map((c) => {
                const n  = cart[c.id] ?? 0
                const on = n > 0
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => addToCart(c.id)}
                    className="relative rounded-2xl overflow-hidden flex flex-col transition-all active:scale-95"
                    style={{
                      border:     on ? '2.5px solid var(--color-accent-dark)' : '1.5px solid var(--line-2)',
                      boxShadow:  on ? '0 4px 16px rgba(154,59,28,0.22)' : 'var(--shadow-card)',
                      background: on ? 'var(--color-accent-dark)' : 'var(--color-surface)',
                    }}
                  >
                    {/* Imagem / emoji */}
                    <div
                      className="relative flex items-center justify-center overflow-hidden"
                      style={{
                        aspectRatio: '1',
                        background: on ? 'rgba(255,255,255,0.07)' : 'var(--color-surface-sunk)',
                      }}
                    >
                      {c.image
                        ? (
                          <img
                            src={c.image}
                            alt={c.nome}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        )
                        : <span className="text-3xl sm:text-4xl leading-none">{c.emoji}</span>
                      }
                      {on && (
                        <span
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center font-black text-sm shadow-md"
                          style={{ background: 'var(--color-accent)', color: '#fff' }}
                        >
                          {n}
                        </span>
                      )}
                    </div>
                    {/* Rodapé */}
                    <div className="px-1.5 py-1.5 text-center shrink-0">
                      <div
                        className="text-[11px] font-bold truncate leading-tight"
                        style={{ color: on ? 'rgba(255,255,255,0.88)' : 'var(--color-text)' }}
                      >
                        {c.short}
                      </div>
                      <div
                        className="text-[11px] font-black tabular-nums"
                        style={{ color: on ? 'rgba(255,255,255,0.6)' : 'var(--color-accent-dark)' }}
                      >
                        {fmtEuro(c.price)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Linha de extras e ações especiais — mesmo layout vertical dos cards
                de cookie (imagem/ícone em cima, texto embaixo): a versão anterior
                em linha (ícone + texto + preço lado a lado) não cabia na coluna
                estreita do Cardápio quando a tela de Caixa divide em 3 colunas
                (≥1024px) — o texto ficava cortado/sumido no iPad. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
              {/* Tasting Box — 1 cookie de 50g de cada sabor do cardápio */}
              {(() => {
                const n  = cart[TASTING_BOX_ID] ?? 0
                const on = n > 0
                const podeMontar = menuItems.length > 0
                  ? Math.min(...menuItems.map((c) => stockCookies50[c.id] ?? 0))
                  : 0
                const semStock = podeMontar <= n
                return (
                  <button
                    type="button"
                    onClick={() => addToCart(TASTING_BOX_ID)}
                    className="relative rounded-2xl overflow-hidden flex flex-col transition-all active:scale-95"
                    style={{
                      border:     on ? '2.5px solid var(--color-accent-dark)' : '1.5px solid var(--line-2)',
                      boxShadow:  on ? '0 4px 16px rgba(154,59,28,0.22)' : 'var(--shadow-card)',
                      background: on ? 'var(--color-accent-dark)' : 'var(--color-surface)',
                    }}
                  >
                    <div
                      className="relative flex items-center justify-center py-3"
                      style={{ background: on ? 'rgba(255,255,255,0.07)' : 'var(--color-surface-sunk)' }}
                    >
                      <span style={{ color: on ? 'rgba(255,255,255,0.85)' : 'var(--ink-3)' }}>
                        <Icon name="caixa" size={24} />
                      </span>
                      {on && (
                        <span
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow-md"
                          style={{ background: 'var(--color-accent)', color: '#fff' }}
                        >
                          {n}
                        </span>
                      )}
                    </div>
                    <div className="px-1.5 py-1.5 text-center shrink-0">
                      <div className="text-[11px] font-bold truncate leading-tight" style={{ color: on ? '#fff' : 'var(--color-text)' }}>
                        Tasting Box
                      </div>
                      <div
                        className="text-[10px] truncate leading-tight"
                        style={{
                          color: on
                            ? 'rgba(255,255,255,0.55)'
                            : semStock ? 'var(--color-danger)' : 'rgba(29,16,8,0.45)',
                        }}
                      >
                        {semStock ? 'sem stock' : `${menuItems.length} sabores`}
                      </div>
                      <div className="text-[11px] font-black tabular-nums" style={{ color: on ? 'rgba(255,255,255,0.8)' : 'var(--color-accent-dark)' }}>
                        {fmtEuro(tastingBoxConfig.price)}
                      </div>
                    </div>
                  </button>
                )
              })()}

              {/* Box Mini Cookies */}
              {(() => {
                const n  = cart[MINI_BOX_ID] ?? 0
                const on = n > 0
                return (
                  <button
                    type="button"
                    onClick={() => addToCart(MINI_BOX_ID)}
                    className="relative rounded-2xl overflow-hidden flex flex-col transition-all active:scale-95"
                    style={{
                      border:     on ? '2.5px solid var(--color-accent-dark)' : '1.5px solid var(--line-2)',
                      boxShadow:  on ? '0 4px 16px rgba(154,59,28,0.22)' : 'var(--shadow-card)',
                      background: on ? 'var(--color-accent-dark)' : 'var(--color-surface)',
                    }}
                  >
                    <div
                      className="relative flex items-center justify-center py-3"
                      style={{ background: on ? 'rgba(255,255,255,0.07)' : 'var(--color-surface-sunk)' }}
                    >
                      <span style={{ color: on ? 'rgba(255,255,255,0.85)' : 'var(--ink-3)' }}>
                        <Icon name="cookie" size={24} />
                      </span>
                      {on && (
                        <span
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow-md"
                          style={{ background: 'var(--color-accent)', color: '#fff' }}
                        >
                          {n}
                        </span>
                      )}
                    </div>
                    <div className="px-1.5 py-1.5 text-center shrink-0">
                      <div className="text-[11px] font-bold truncate leading-tight" style={{ color: on ? '#fff' : 'var(--color-text)' }}>
                        Box Mini
                      </div>
                      <div className="text-[10px] truncate leading-tight" style={{ color: on ? 'rgba(255,255,255,0.55)' : 'rgba(29,16,8,0.45)' }}>
                        Pacote especial
                      </div>
                      <div className="text-[11px] font-black tabular-nums" style={{ color: on ? 'rgba(255,255,255,0.8)' : 'var(--color-accent-dark)' }}>
                        {fmtEuro(miniBoxConfig.price)}
                      </div>
                    </div>
                  </button>
                )
              })()}

              {/* BOX */}
              <button
                type="button"
                onClick={startBox}
                className="relative rounded-2xl overflow-hidden flex flex-col transition-all active:scale-95"
                style={{
                  border:     order?.kind === 'box' ? '2.5px solid var(--color-accent)' : '1.5px solid rgba(194,75,41,0.25)',
                  boxShadow:  order?.kind === 'box' ? '0 4px 16px rgba(154,59,28,0.22)' : 'var(--shadow-card)',
                  background: order?.kind === 'box' ? 'var(--color-accent)' : 'rgba(194,75,41,0.07)',
                }}
              >
                <div className="flex items-center justify-center py-3" style={{ background: 'rgba(194,75,41,0.08)' }}>
                  <span style={{ color: order?.kind === 'box' ? '#fff' : 'var(--color-accent-dark)' }}>
                    <Icon name="caixa" size={24} />
                  </span>
                </div>
                <div className="px-1.5 py-1.5 text-center shrink-0">
                  <div className="text-[11px] font-bold truncate leading-tight" style={{ color: order?.kind === 'box' ? '#fff' : 'var(--color-accent-dark)' }}>
                    BOX {boxConfig.size} cookies
                  </div>
                  <div className="text-[10px] truncate leading-tight" style={{ color: order?.kind === 'box' ? 'rgba(255,255,255,0.65)' : 'rgba(154,59,28,0.65)' }}>
                    Mix de sabores
                  </div>
                  <div className="text-[11px] font-black tabular-nums" style={{ color: order?.kind === 'box' ? '#fff' : 'var(--color-accent-dark)' }}>
                    {fmtEuro(boxConfig.price)}
                  </div>
                </div>
              </button>

              {/* Demo */}
              <button
                type="button"
                onClick={startDemo}
                className="relative rounded-2xl overflow-hidden flex flex-col transition-all active:scale-95"
                style={{
                  border:     order?.kind === 'demo' ? '2.5px solid var(--color-primary)' : '1.5px solid var(--line-2)',
                  boxShadow:  order?.kind === 'demo' ? '0 4px 16px rgba(154,59,28,0.22)' : 'var(--shadow-card)',
                  background: order?.kind === 'demo' ? 'var(--color-primary)' : 'var(--color-surface-sunk)',
                }}
              >
                <div className="flex items-center justify-center py-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
                  <span style={{ color: order?.kind === 'demo' ? '#fff' : 'var(--ink-2)' }}>
                    <Icon name="cookie" size={24} />
                  </span>
                </div>
                <div className="px-1.5 py-1.5 text-center shrink-0">
                  <div className="text-[11px] font-bold truncate leading-tight" style={{ color: order?.kind === 'demo' ? '#fff' : 'var(--color-text)' }}>
                    Prova grátis
                  </div>
                  <div className="text-[10px] truncate leading-tight" style={{ color: order?.kind === 'demo' ? 'rgba(255,255,255,0.5)' : 'rgba(29,16,8,0.4)' }}>
                    Amostra
                  </div>
                  <div className="text-[11px] font-black tabular-nums" style={{ color: order?.kind === 'demo' ? 'rgba(255,255,255,0.85)' : 'var(--color-accent-dark)' }}>
                    {fmtEuro(0)}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* ── Finalizar ── */}
        <section
          className="flex shrink-0 flex-col max-lg:max-h-[min(40dvh,400px)] max-lg:min-h-[200px] max-lg:border-b max-lg:overflow-hidden lg:w-[min(360px,30vw)] lg:max-h-none lg:border-r"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--line-2)' }}
        >
          <div
            className="shrink-0 px-4 py-2 border-b"
            style={{ borderColor: 'var(--line-1)' }}
          >
            <span className="bfy-eyebrow">
              Finalizar
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
            {!order && nCart === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <span className="mb-3 ink-4"><Icon name="carrinho" size={30} /></span>
                <p className="text-sm ink-3">
                  Toca nos cookies para adicionar ao pedido
                </p>
              </div>
            ) : (
              <>
                {/* BOX */}
                {order?.kind === 'box' && (
                  <div className="bfy-card p-3 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span style={{ color: 'var(--color-accent-dark)' }}><Icon name="caixa" size={21} /></span>
                      <div className="flex-1">
                        <div className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                          BOX {boxConfig.size} cookies ({boxFilled}/{boxConfig.size})
                        </div>
                        <div className="ink-3" style={{ fontSize: 'var(--text-xs)' }}>
                          {fmtEuro(boxConfig.price)} · mix de sabores
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={cancelBox}
                        className="btn-icon btn-icon-danger shrink-0"
                        title="Remover BOX"
                        aria-label="Remover BOX"
                      >
                        <Icon name="fechar" size={15} />
                      </button>
                    </div>
                    {menuItems.map((c) => {
                      const n = order.boxCounts[c.id] ?? 0
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                          style={{ background: 'var(--color-surface-sunk)' }}
                        >
                          <span className="text-sm shrink-0">{c.emoji}</span>
                          <span className="flex-1 text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{c.short}</span>
                          <button
                            type="button"
                            onClick={() => changeBoxCount(c.id, -1)}
                            disabled={n <= 0}
                            className="btn-step"
                          >−</button>
                          <span className="w-5 text-center text-sm font-black tabular-nums" style={{ color: 'var(--color-text)' }}>{n}</span>
                          <button
                            type="button"
                            onClick={() => changeBoxCount(c.id, 1)}
                            disabled={boxFilled >= boxConfig.size}
                            className="btn-step"
                          >+</button>
                        </div>
                      )
                    })}
                    {boxFilled > 0 && (
                      <div className="text-[11px] pt-0.5 ink-3">
                        {formatBoxCountsSummary(order.boxCounts, menuItems)}
                      </div>
                    )}
                  </div>
                )}

                {/* Demo */}
                {order?.kind === 'demo' && (
                  <div className="bfy-card p-3 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="ink-2"><Icon name="cookie" size={21} /></span>
                      <div>
                        <div className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Prova grátis</div>
                        <div className="ink-3" style={{ fontSize: 'var(--text-xs)' }}>Seleciona o sabor dado a provar</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {menuItems.map((c) => {
                        const on = order.demoFlavorId === c.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setDemoFlavor(c.id)}
                            className="rounded-xl px-1 py-2 text-center transition-all"
                            style={{
                              border:     on ? '2px solid var(--color-accent-dark)' : '1.5px solid var(--line-2)',
                              background: on ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.03)',
                            }}
                          >
                            <div className="text-lg leading-none">{c.emoji}</div>
                            <div
                              className="text-[11px] font-bold mt-1 truncate"
                              style={{ color: on ? '#fff' : 'var(--color-text)' }}
                            >{c.short}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Lista avulsa — visível junto com BOX */}
                {nCart > 0 && order?.kind !== 'demo' && (
                  <div className="bfy-card p-3 space-y-2">
                    <div className="bfy-eyebrow mb-1">
                      Lista · {nCart} {nCart === 1 ? 'item' : 'itens'}
                    </div>
                    {buildCartLines(cart).map((ln) => {
                      const meta  = productMeta(ln.productId, cookies, ln)
                      const price = getPrice(ln.productId, cookies, miniBoxConfig.price, ln, tastingBoxConfig.price)
                      return (
                        <div
                          key={ln.productId}
                          className="flex items-center gap-2 rounded-xl px-2 py-2"
                          style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)' }}
                        >
                          {meta.image
                            ? <img src={meta.image} alt={meta.nome} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                            : <span className="text-xl shrink-0">{meta.emoji}</span>
                          }
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>{meta.nome}</div>
                            <div className="text-[11px] ink-3">
                              {ln.qty}× {fmtEuro(price)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => changeQty(ln.productId, -1)}
                              className="btn-step"
                            >−</button>
                            <span className="w-5 text-center text-sm font-black tabular-nums" style={{ color: 'var(--color-text)' }}>{ln.qty}</span>
                            <button
                              type="button"
                              onClick={() => addToCart(ln.productId)}
                              className="btn-step"
                            >+</button>
                          </div>
                          <div
                            className="text-sm font-black w-14 text-right shrink-0 tabular-nums"
                            style={{ color: 'var(--color-accent-dark)' }}
                          >
                            {fmtEuro(price * ln.qty)}
                          </div>
                        </div>
                      )
                    })}
                    {order?.kind !== 'box' && (
                      <div
                        className="flex justify-between items-center rounded-xl px-3 py-2"
                        style={{ background: 'var(--color-accent-soft)', border: '1.5px solid rgba(154,59,28,0.18)' }}
                      >
                        <span className="text-sm font-bold" style={{ color: 'var(--color-accent-dark)' }}>Total</span>
                        <span className="text-lg font-black tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                          {fmtEuro(cartTotalEur)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Total combinado (lista + BOX) */}
                {order?.kind === 'box' && (nCart > 0 || boxReady) && (
                  <div
                    className="flex justify-between items-center rounded-xl px-3 py-2.5"
                    style={{ background: 'var(--color-accent-soft)', border: '1.5px solid rgba(154,59,28,0.18)' }}
                  >
                    <span className="text-sm font-bold" style={{ color: 'var(--color-accent-dark)' }}>
                      Total{boxReady ? '' : ' (completa a BOX)'}
                    </span>
                    <span className="text-lg font-black tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                      {fmtEuro(checkoutTotal)}
                    </span>
                  </div>
                )}

                {/* Pagamento */}
                {order?.kind !== 'demo' && (nCart > 0 || boxReady || order?.kind === 'box') && (
                  <div className="bfy-card p-3 space-y-1.5">
                    <div className="bfy-eyebrow mb-1">
                      Pagamento
                    </div>
                    {PAYMENTS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPayment(p.id)}
                        className="w-full rounded-xl py-2.5 text-sm font-bold text-left px-4 transition-all"
                        style={{
                          background: payment === p.id ? 'var(--color-accent-dark)' : 'var(--color-surface-sunk)',
                          color:      payment === p.id ? '#fff' : 'var(--color-text)',
                          border:     payment === p.id ? '2px solid var(--color-accent-dark)' : '1.5px solid var(--line-2)',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}

                    {(nCart > 0 || boxReady) && (
                      <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--line-1)' }}>
                        <div className="bfy-eyebrow">
                          Desconto
                        </div>
                        <div className="flex gap-2 items-center">
                          <button
                            type="button"
                            onClick={() => setDesconto((d) => (Number(d) === 1 ? 0 : 1))}
                            className="rounded-xl px-3 py-2 text-sm font-bold shrink-0 transition-all"
                            style={{
                              background: descontoAplicado === 1 ? 'var(--color-success)' : 'var(--color-surface-sunk)',
                              color: descontoAplicado === 1 ? '#fff' : 'var(--color-text)',
                              border: descontoAplicado === 1
                                ? '2px solid var(--color-success)'
                                : '1.5px solid var(--line-2)',
                            }}
                          >
                            −€1,00
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            inputMode="decimal"
                            placeholder="Outro valor"
                            value={desconto || ''}
                            onChange={(e) => setDesconto(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="bfy-input flex-1 py-2 text-sm"
                          />
                        </div>
                        {descontoAplicado > 0 && (
                          <div className="flex justify-between text-xs font-semibold px-1">
                            <span style={{ color: 'var(--color-success)' }}>Desconto</span>
                            <span className="tabular-nums" style={{ color: 'var(--color-success)' }}>
                              −{fmtEuro(descontoAplicado)}
                            </span>
                          </div>
                        )}
                        {descontoAplicado > 0 && (
                          <div className="flex justify-between items-center text-sm font-bold px-1">
                            <span style={{ color: 'var(--color-accent-dark)' }}>A pagar</span>
                            <span className="tabular-nums text-base font-black" style={{ color: 'var(--color-accent-dark)' }}>
                              {fmtEuro(totalFinal)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Botões */}
                <div className="flex gap-2 mt-auto pt-1">
                  <button type="button" onClick={cancelCheckout} className="btn-ghost flex-1 py-3 text-sm">
                    {order?.kind === 'box' ? 'Remover BOX' : order?.kind === 'demo' ? 'Cancelar' : 'Limpar'}
                  </button>
                  <button
                    type="button"
                    onClick={confirmSale}
                    disabled={!canConfirm}
                    className="flex-[1.8] py-3 rounded-[10px] font-black text-sm transition-all"
                    style={{
                      background: canConfirm ? 'var(--color-success)' : 'var(--line-2)',
                      color:      canConfirm ? '#fff' : 'rgba(29,16,8,0.3)',
                      cursor:     canConfirm ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {confirmBtnText()}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Dashboard ── */}
        <aside
          className="min-h-0 w-full flex-1 overflow-y-auto max-lg:border-t lg:w-[min(340px,26vw)] lg:flex-none lg:shrink-0"
          style={{ background: 'var(--color-bg)', borderColor: 'var(--line-1)' }}
        >
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Caixa hoje" value={fmtEuro(metrics.total)} accent />
              <StatCard label="Demos" value={metrics.demoCount.total} />
              <StatCard
                label="Ticket"
                value={metrics.revenueSales ? fmtEuro(metrics.total / metrics.revenueSales) : '—'}
              />
            </div>

            <SideBlock title="Cookies vendidos hoje">
              {todayRanking.length === 0 ? (
                <div className="text-xs py-1 ink-4">Nenhum cookie vendido hoje.</div>
              ) : todayRanking.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  <span className="w-24 font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                    {r.emoji} {r.short ?? r.label}
                  </span>
                  <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--line-2)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(r.qty / maxRankBar) * 100}%`, background: 'var(--color-accent)' }}
                    />
                  </div>
                  <span className="w-5 text-right font-black tabular-nums" style={{ color: 'var(--color-text)' }}>{r.qty}</span>
                </div>
              ))}
            </SideBlock>

            <SideBlock title="Demonstrações por sabor">
              {cookies.map((c) => {
                const qty = metrics.demoCount.byFlavor[c.id] ?? 0
                return (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <span className="w-24 font-semibold truncate ink-2">{c.short}</span>
                    <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--color-surface-sunk)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(qty / maxDemoBar) * 100}%`, background: 'var(--color-accent-dark)' }}
                      />
                    </div>
                    <span className="w-5 text-right font-black tabular-nums" style={{ color: 'var(--color-text)' }}>{qty}</span>
                  </div>
                )
              })}
            </SideBlock>

            <SideBlock title="Pagamento">
              <div className="grid grid-cols-1 gap-2">
                {PAYMENTS.map((p) => {
                  const r = metrics.byPayment[p.id]
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl px-3 py-2"
                      style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)' }}
                    >
                      <div className="text-[11px] font-bold ink-3">{p.label}</div>
                      <div className="text-lg font-black tabular-nums" style={{ color: 'var(--color-text)' }}>{fmtEuro(r.eur)}</div>
                      <div className="text-[11px] ink-4">{r.count}×</div>
                    </div>
                  )
                })}
              </div>
            </SideBlock>

            <SideBlock
              title="Últimos registos"
              action={
                <button
                  type="button"
                  onClick={deleteLastSale}
                  disabled={!sales.length}
                  className="font-bold disabled:opacity-30 transition-colors"
                  style={{ color: 'var(--color-danger)', fontSize: 'var(--text-2xs)' }}
                >Anular última</button>
              }
            >
              <div className="flex flex-wrap gap-1 mb-2">
                {[
                  { id: 'all', label: 'Todos' },
                  ...PAYMENTS,
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPaymentFilter(p.id)}
                    className="rounded-lg px-2 py-1 text-[11px] font-bold transition-all"
                    style={{
                      background: paymentFilter === p.id ? 'var(--color-accent-dark)' : 'var(--color-surface-sunk)',
                      color: paymentFilter === p.id ? '#fff' : 'var(--color-text)',
                      border: paymentFilter === p.id
                        ? '1.5px solid var(--color-accent-dark)'
                        : '1px solid var(--line-2)',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {filteredTodaySales.length === 0 ? (
                <div className="text-xs py-2 ink-4">
                  {todaySales.length === 0 ? 'Nada registado hoje.' : 'Nenhum registo com este pagamento.'}
                </div>
              ) : (
                <div className="space-y-1 max-h-[220px] overflow-y-auto">
                  {filteredTodaySales.slice(0, 50).map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg px-2 py-1.5"
                      style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)' }}
                    >
                      <div className="flex gap-2 text-[11px]">
                        <span className="font-mono ink-3">{fmtTime(s.createdAt)}</span>
                        <span className="flex-1 truncate text-[11px] font-semibold ink-2">
                          {saleDescription(s, cookies)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mt-0.5">
                        <span className="text-[11px] ink-3">
                          {(s.totalEur ?? 0) > 0 || (s.desconto ?? 0) > 0
                            ? paymentLabel(s.paymentId)
                            : 'Prova grátis'}
                          {(s.desconto ?? 0) > 0 ? ` · −${fmtEuro(s.desconto)}` : ''}
                        </span>
                        <span className="text-xs font-black tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                          {fmtEuro(s.totalEur ?? 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SideBlock>
          </div>
        </aside>
      </main>

      {toast && <Toast msg={toast} />}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatCard({ label, value, accent }) {
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{
        background: accent ? 'rgba(194,75,41,0.08)' : 'var(--color-surface-sunk)',
        border: `1px solid ${accent ? 'rgba(194,75,41,0.18)' : 'var(--line-1)'}`,
      }}
    >
      <div className="bfy-eyebrow">{label}</div>
      <div
        className="text-lg font-black tabular-nums"
        style={{ color: accent ? 'var(--color-accent-dark)' : 'var(--color-text)' }}
      >{value}</div>
    </div>
  )
}

function SideBlock({ title, children, action }) {
  return (
    <div className="bfy-card p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="bfy-eyebrow">{title}</div>
        {action && <div className="flex gap-1 items-center shrink-0">{action}</div>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Toast({ msg }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm pointer-events-none">
      <div
        className="text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl text-center"
        style={{ background: 'var(--color-primary)', color: 'var(--color-text-light)' }}
      >
        {msg}
      </div>
    </div>
  )
}
