import { useEffect, useMemo, useRef, useState } from 'react'
import { useCookies } from '../stores/useCookies'
import { useEstoqueCookies } from '../stores/useEstoqueCookies'
import { Modal } from '../components/Modal'
import { STORAGE_SYNC_EVENT } from '../lib/syncKeys'
import { scheduleSync } from '../lib/syncService'

// ─── Constantes ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cookies-sales:v1'
const MINI_BOX_ID = 'mini-box'

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

function readSales() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

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

function productMeta(productId, cookies) {
  const c = cookies.find((c) => c.id === productId)
  if (c) return { nome: c.nome, short: c.short, emoji: c.emoji, image: c.image }
  if (productId === MINI_BOX_ID) return { nome: 'Box Mini Cookies', short: 'Box Mini', emoji: '🍪', image: '' }
  return { nome: productId, short: productId, emoji: '❓', image: '' }
}

function getPrice(productId, cookies, miniBoxPrice) {
  const c = cookies.find((c) => c.id === productId)
  if (c) return c.price
  if (productId === MINI_BOX_ID) return miniBoxPrice
  return 0
}

function cartPieces(cart) {
  return Object.values(cart).reduce((acc, v) => acc + (v ?? 0), 0)
}

function buildCartLines(cart) {
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({ productId, qty }))
}

function cartTotal(cart, cookies, miniBoxPrice) {
  return buildCartLines(cart).reduce(
    (sum, ln) => sum + getPrice(ln.productId, cookies, miniBoxPrice) * ln.qty,
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
      .map((ln) => `${ln.qty}× ${productMeta(ln.productId, cookies).short}`)
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

export function Feiras({ onPosModeChange }) {
  const {
    cookies, boxConfig, miniBoxConfig,
    addCookie, updateCookie, removeCookie,
    setBoxConfig, setMiniBoxConfig,
  } = useCookies()

  const { deductSale } = useEstoqueCookies()

  const [view,    setView]    = useState('landing') // 'landing' | 'pos' | 'manage'
  const [sales,   setSales]   = useState(() => readSales())
  const [cart,    setCart]    = useState({})
  const [order,   setOrder]   = useState(null)
  const [payment, setPayment] = useState(null)
  const [toast,   setToast]   = useState(null)
  const toastRef = useRef(0)


  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sales))
    scheduleSync(STORAGE_KEY)
  }, [sales])

  useEffect(() => {
    function onRemoteSync(e) {
      if (e.detail?.key !== STORAGE_KEY) return
      setSales(readSales())
    }
    window.addEventListener(STORAGE_SYNC_EVENT, onRemoteSync)
    return () => window.removeEventListener(STORAGE_SYNC_EVENT, onRemoteSync)
  }, [])

  useEffect(() => () => clearTimeout(toastRef.current), [])

  useEffect(() => {
    onPosModeChange?.(view === 'pos')
    return () => onPosModeChange?.(false)
  }, [view, onPosModeChange])

  const metrics = useMemo(() => {
    let total = 0
    const byCookie  = Object.fromEntries(cookies.map((c) => [c.id, 0]))
    const demoCount = { total: 0, byFlavor: Object.fromEntries(cookies.map((c) => [c.id, 0])) }
    const byPayment = Object.fromEntries(PAYMENTS.map((p) => [p.id, { count: 0, eur: 0 }]))
    let miniBoxCount = 0

    for (const s of sales) {
      total += s.totalEur ?? 0
      if ((s.totalEur ?? 0) > 0 && s.paymentId && byPayment[s.paymentId]) {
        byPayment[s.paymentId].count++
        byPayment[s.paymentId].eur += s.totalEur ?? 0
      }
      if (s.kind === 'order') {
        for (const ln of s.lines ?? []) {
          if (byCookie[ln.productId] != null) byCookie[ln.productId] += ln.qty ?? 0
          else if (ln.productId === MINI_BOX_ID)  miniBoxCount += ln.qty ?? 0
        }
      } else if (s.kind === 'demo') {
        demoCount.total++
        if (demoCount.byFlavor[s.demoFlavorId] != null) demoCount.byFlavor[s.demoFlavorId]++
      } else if (s.kind === 'box') {
        for (const fid of s.boxFlavors ?? []) {
          if (byCookie[fid] != null) byCookie[fid]++
        }
      }
    }

    const revenueSales = sales.filter((s) => (s.totalEur ?? 0) > 0).length
    return { total, byCookie, demoCount, byPayment, revenueSales, miniBoxCount }
  }, [sales, cookies])

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
    setOrder({ kind: 'box', boxCounts: initialBoxCounts(cookies), demoFlavorId: null })
  }

  function startDemo() {
    setCart((prev) => { if (cartPieces(prev) > 0) notify('Lista avulsa limpa.'); return {} })
    setOrder({ kind: 'demo', boxCounts: initialBoxCounts(cookies), demoFlavorId: null })
    setPayment(null)
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
      return
    }
    setCart({})
    setPayment(null)
  }

  function cancelBox() {
    setOrder((prev) => (prev?.kind === 'box' ? null : prev))
  }

  function confirmSale() {
    if (order?.kind === 'demo') {
      if (!order.demoFlavorId) { notify('Escolhe o sabor para a demonstração.'); return }
      setSales((prev) => [{
        id: uid(), createdAt: new Date().toISOString(),
        kind: 'demo', demoFlavorId: order.demoFlavorId,
        flavorId: null, boxFlavors: [], paymentId: 'gratis', totalEur: 0,
      }, ...prev])
      deductSale([{ cookieId: order.demoFlavorId, qty: 1 }])
      setOrder(null); setPayment(null)
      notify('Demonstração registada ✓')
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

    if (nCart > 0) {
      newSales.push({
        id: uid(), createdAt: new Date().toISOString(),
        kind: 'order', lines: buildCartLines(cart),
        flavorId: null, boxFlavors: [], paymentId: payment,
        totalEur: cartTotal(cart, cookies, miniBoxConfig.price),
      })
      for (const [productId, qty] of Object.entries(cart)) {
        if (productId !== MINI_BOX_ID) deductItems.push({ cookieId: productId, qty })
      }
    }

    if (boxReady) {
      newSales.push({
        id: uid(), createdAt: new Date().toISOString(),
        kind: 'box', flavorId: null,
        boxFlavors: flattenBoxToArray(order.boxCounts),
        paymentId: payment, totalEur: boxConfig.price,
      })
      for (const [flavorId, qty] of Object.entries(order.boxCounts)) {
        if (qty > 0) deductItems.push({ cookieId: flavorId, qty })
      }
    }

    setSales((prev) => [...newSales, ...prev])
    deductSale(deductItems)
    setCart({})
    setOrder(null)
    setPayment(null)
    notify(newSales.length > 1 ? 'Vendas registadas ✓' : 'Venda registada ✓')
  }


  function deleteLastSale() {
    if (!sales.length) return
    if (!confirm('Excluir o último registo?')) return
    setSales((prev) => prev.slice(1))
  }

  function clearAll() {
    if (!confirm('Limpar todos os registos? Esta ação não pode ser desfeita.')) return
    setSales([])
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
      ...sales.slice(0, 50).map((s) =>
        `  ${fmtTime(s.createdAt)} | ${saleDescription(s, cookies)} | ${paymentLabel(s.paymentId)} | ${fmtEuro(s.totalEur ?? 0)}`
      ),
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
  const cartTotalEur = cartTotal(cart, cookies, miniBoxConfig.price)
  const checkoutTotal = cartTotalEur + (boxReady ? boxConfig.price : 0)

  const canConfirm = order?.kind === 'demo'
    ? !!order.demoFlavorId
    : order?.kind === 'box'
      ? boxReady && !!payment
      : nCart > 0 && !!payment

  function confirmBtnText() {
    if (order?.kind === 'demo') return order.demoFlavorId ? '✓ Confirmar demonstração' : 'Escolhe o sabor'
    if (order?.kind === 'box') {
      if (boxFilled < boxConfig.size) return `Faltam ${boxConfig.size - boxFilled} cookie(s) na BOX`
      if (!payment) return 'Escolhe o pagamento'
      return `✓ Confirmar ${fmtEuro(checkoutTotal)}`
    }
    if (nCart > 0) return payment ? `✓ Confirmar ${fmtEuro(cartTotalEur)}` : 'Escolhe o pagamento'
    return 'Seleciona itens'
  }

  const maxCookieBar = Math.max(...cookies.map((c) => metrics.byCookie[c.id] ?? 0), 1)
  const maxDemoBar   = Math.max(...cookies.map((c) => metrics.demoCount.byFlavor[c.id] ?? 0), 1)

  // ── View: Landing ─────────────────────────────────────────────────────────

  if (view === 'landing') {
    return (
      <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-2xl mx-auto p-4 md:p-6 pb-10 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="text-3xl font-black"
                style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}
              >
                Feiras
              </h1>
              <p className="text-sm mt-1 opacity-55" style={{ color: 'var(--color-text)' }}>
                {cookies.length} produtos · sistema de venda
              </p>
            </div>
            <button
              className="btn-ghost text-xs px-4 py-2"
              disabled={!sales.length}
              onClick={exportTxt}
            >
              Exportar .TXT
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total caixa', value: fmtEuro(metrics.total), accent: true },
              { label: 'Vendas pagas', value: metrics.revenueSales },
              { label: 'Demonstrações', value: metrics.demoCount.total },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bfy-card p-4 text-center">
                <p
                  className="text-xl font-black tabular-nums"
                  style={{ color: accent ? 'var(--color-accent-dark)' : 'var(--color-text)', fontFamily: 'var(--font-title)' }}
                >
                  {value}
                </p>
                <p className="text-xs mt-1 opacity-50" style={{ color: 'var(--color-text)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Ações principais */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Iniciar Caixa */}
            <button
              onClick={() => setView('pos')}
              className="group relative overflow-hidden rounded-2xl p-6 flex items-center gap-4 text-left transition-all hover:scale-[1.015] active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, var(--color-success) 0%, #3a9e7a 100%)',
                boxShadow: '0 6px 24px rgba(90,158,133,0.35)',
              }}
            >
              <div
                className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                🛒
              </div>
              <div className="min-w-0">
                <p className="font-black text-xl leading-tight" style={{ fontFamily: 'var(--font-title)', color: '#fff' }}>
                  Iniciar Caixa
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  Abrir o sistema de vendas
                </p>
              </div>
              <svg className="ml-auto shrink-0 opacity-40 group-hover:opacity-70 transition-opacity" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            {/* Gerenciar Cardápio */}
            <button
              onClick={() => setView('manage')}
              className="group relative overflow-hidden rounded-2xl p-6 flex items-center gap-4 text-left transition-all hover:scale-[1.015] active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)',
                boxShadow: '0 6px 24px rgba(194,75,41,0.30)',
              }}
            >
              <div
                className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: 'rgba(255,255,255,0.18)' }}
              >
                🍪
              </div>
              <div className="min-w-0">
                <p className="font-black text-xl leading-tight" style={{ fontFamily: 'var(--font-title)', color: '#fff' }}>
                  Gerir Cardápio
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  Produtos, preços e imagens
                </p>
              </div>
              <svg className="ml-auto shrink-0 opacity-40 group-hover:opacity-70 transition-opacity" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Preview do cardápio */}
          <div className="bfy-card p-4">
            <p className="text-xs font-black uppercase tracking-widest mb-3 opacity-50" style={{ color: 'var(--color-text)' }}>
              Cardápio atual
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {cookies.map((c) => (
                <div key={c.id} className="flex flex-col items-center gap-1">
                  <div
                    className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center"
                    style={{ background: 'rgba(29,16,8,0.05)' }}
                  >
                    {c.image
                      ? <img src={c.image} alt={c.nome} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                      : <span className="text-2xl">{c.emoji}</span>
                    }
                  </div>
                  <p className="text-[10px] font-bold text-center leading-tight" style={{ color: 'var(--color-text)' }}>{c.short}</p>
                  <p className="text-[10px] font-black" style={{ color: 'var(--color-accent-dark)' }}>{fmtEuro(c.price)}</p>
                </div>
              ))}
            </div>
            <div
              className="mt-3 pt-3 flex flex-wrap gap-3 text-xs"
              style={{ borderTop: '1px solid rgba(29,16,8,0.08)', color: 'var(--color-text)' }}
            >
              <span className="opacity-55">📦 BOX {boxConfig.size} cookies — {fmtEuro(boxConfig.price)}</span>
              <span className="opacity-55">🍪 Box Mini — {fmtEuro(miniBoxConfig.price)}</span>
            </div>
          </div>

          {sales.length > 0 && (
            <div className="text-center">
              <button
                className="text-xs opacity-35 hover:opacity-60 transition-opacity"
                style={{ color: '#e57373' }}
                onClick={clearAll}
              >
                Limpar todos os registos
              </button>
            </div>
          )}
        </div>

        {toast && <Toast msg={toast} />}
      </div>
    )
  }

  // ── View: Gerenciar ───────────────────────────────────────────────────────

  if (view === 'manage') {
    return (
      <ManageView
        cookies={cookies}
        boxConfig={boxConfig}
        miniBoxConfig={miniBoxConfig}
        addCookie={addCookie}
        updateCookie={updateCookie}
        removeCookie={removeCookie}
        setBoxConfig={setBoxConfig}
        setMiniBoxConfig={setMiniBoxConfig}
        onBack={() => setView('landing')}
        notify={notify}
        toast={toast}
      />
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
            className="text-sm font-semibold opacity-60 hover:opacity-100 shrink-0 transition-opacity"
            style={{ color: 'var(--color-text-light)' }}
            onClick={() => { cancelCheckout(); setView('landing') }}
          >
            ← Voltar
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
            <div className="text-[10px] opacity-45 uppercase tracking-wide" style={{ color: 'var(--color-text-light)' }}>Caixa</div>
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
          className="flex min-h-0 flex-col px-3 py-3 sm:px-4 lg:border-r max-lg:max-h-[min(54dvh,540px)] max-lg:flex-none max-lg:overflow-y-auto lg:max-h-none lg:flex-[1.4]"
          style={{ borderColor: 'rgba(29,16,8,0.1)' }}
        >
          <div className="shrink-0 flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-45" style={{ color: 'var(--color-text)' }}>
              Cardápio
            </span>
            <span className="text-[10px] opacity-35 hidden sm:block" style={{ color: 'var(--color-text)' }}>
              Toca para adicionar
            </span>
          </div>

          <div className="flex flex-col gap-2.5 flex-1">
            {/* Grid de cookies */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {cookies.map((c) => {
                const n  = cart[c.id] ?? 0
                const on = n > 0
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => addToCart(c.id)}
                    className="relative rounded-2xl overflow-hidden flex flex-col transition-all active:scale-95"
                    style={{
                      border:     on ? '2.5px solid var(--color-accent-dark)' : '1.5px solid rgba(29,16,8,0.1)',
                      boxShadow:  on ? '0 4px 16px rgba(154,59,28,0.22)' : 'var(--shadow-card)',
                      background: on ? 'var(--color-accent-dark)' : 'var(--color-surface)',
                    }}
                  >
                    {/* Imagem / emoji */}
                    <div
                      className="relative flex items-center justify-center overflow-hidden"
                      style={{
                        aspectRatio: '1',
                        background: on ? 'rgba(255,255,255,0.07)' : 'rgba(29,16,8,0.04)',
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

            {/* Linha de extras e ações especiais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
              {/* Box Mini Cookies */}
              {(() => {
                const n  = cart[MINI_BOX_ID] ?? 0
                const on = n > 0
                return (
                  <button
                    type="button"
                    onClick={() => addToCart(MINI_BOX_ID)}
                    className="relative rounded-xl flex items-center gap-2.5 px-3 py-2.5 transition-all active:scale-95"
                    style={{
                      border:     on ? '2px solid var(--color-accent-dark)' : '1.5px solid rgba(29,16,8,0.1)',
                      background: on ? 'var(--color-accent-dark)' : 'var(--color-surface)',
                      boxShadow:  'var(--shadow-card)',
                    }}
                  >
                    {on && (
                      <span
                        className="absolute -top-1.5 -right-1 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow z-10"
                        style={{ background: 'var(--color-accent)', color: '#fff' }}
                      >
                        {n}
                      </span>
                    )}
                    <span className="text-xl shrink-0">🍪</span>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-xs font-bold truncate" style={{ color: on ? '#fff' : 'var(--color-text)' }}>Box Mini</div>
                      <div className="text-[10px]" style={{ color: on ? 'rgba(255,255,255,0.55)' : 'rgba(29,16,8,0.45)' }}>Pacote especial</div>
                    </div>
                    <span className="text-sm font-black shrink-0 tabular-nums" style={{ color: on ? 'rgba(255,255,255,0.8)' : 'var(--color-accent-dark)' }}>
                      {fmtEuro(miniBoxConfig.price)}
                    </span>
                  </button>
                )
              })()}

              {/* BOX */}
              <button
                type="button"
                onClick={startBox}
                className="rounded-xl flex items-center gap-2.5 px-3 py-2.5 transition-all active:scale-95"
                style={{
                  border:     order?.kind === 'box' ? '2px solid var(--color-accent)' : '1.5px solid rgba(194,75,41,0.25)',
                  background: order?.kind === 'box' ? 'var(--color-accent)' : 'rgba(194,75,41,0.07)',
                  boxShadow:  'var(--shadow-card)',
                }}
              >
                <span className="text-xl shrink-0">📦</span>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-xs font-bold" style={{ color: order?.kind === 'box' ? '#fff' : 'var(--color-accent-dark)' }}>
                    BOX {boxConfig.size} cookies
                  </div>
                  <div className="text-[10px]" style={{ color: order?.kind === 'box' ? 'rgba(255,255,255,0.65)' : 'rgba(154,59,28,0.65)' }}>
                    Mix de sabores
                  </div>
                </div>
                <span className="text-sm font-black shrink-0 tabular-nums" style={{ color: order?.kind === 'box' ? '#fff' : 'var(--color-accent-dark)' }}>
                  {fmtEuro(boxConfig.price)}
                </span>
              </button>

              {/* Demo */}
              <button
                type="button"
                onClick={startDemo}
                className="rounded-xl flex items-center gap-2.5 px-3 py-2.5 transition-all active:scale-95"
                style={{
                  border:     order?.kind === 'demo' ? '2px solid var(--color-primary)' : '1.5px solid rgba(29,16,8,0.1)',
                  background: order?.kind === 'demo' ? 'var(--color-primary)' : 'rgba(29,16,8,0.04)',
                  boxShadow:  'var(--shadow-card)',
                }}
              >
                <span className="text-xl shrink-0">✨</span>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-xs font-bold" style={{ color: order?.kind === 'demo' ? '#fff' : 'var(--color-text)' }}>
                    Demonstração
                  </div>
                  <div className="text-[10px]" style={{ color: order?.kind === 'demo' ? 'rgba(255,255,255,0.5)' : 'rgba(29,16,8,0.4)' }}>
                    Prova grátis
                  </div>
                </div>
                <span className="text-xs font-bold shrink-0" style={{ color: order?.kind === 'demo' ? 'rgba(255,255,255,0.5)' : 'rgba(29,16,8,0.25)' }}>
                  {fmtEuro(0)}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Finalizar ── */}
        <section
          className="flex shrink-0 flex-col max-lg:max-h-[min(40dvh,400px)] max-lg:min-h-[200px] max-lg:border-b max-lg:overflow-hidden lg:w-[min(360px,30vw)] lg:max-h-none lg:border-r"
          style={{ background: 'var(--color-surface)', borderColor: 'rgba(29,16,8,0.1)' }}
        >
          <div
            className="shrink-0 px-4 py-2 border-b"
            style={{ borderColor: 'rgba(29,16,8,0.08)' }}
          >
            <span className="text-[11px] font-black uppercase tracking-widest opacity-45" style={{ color: 'var(--color-text)' }}>
              Finalizar
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
            {!order && nCart === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <span className="text-4xl mb-3 opacity-25">👆</span>
                <p className="text-sm opacity-40" style={{ color: 'var(--color-text)' }}>
                  Toca nos cookies para adicionar ao pedido
                </p>
              </div>
            ) : (
              <>
                {/* BOX */}
                {order?.kind === 'box' && (
                  <div className="bfy-card p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📦</span>
                      <div className="flex-1">
                        <div className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                          BOX {boxConfig.size} cookies ({boxFilled}/{boxConfig.size})
                        </div>
                        <div className="text-xs opacity-45" style={{ color: 'var(--color-text)' }}>
                          {fmtEuro(boxConfig.price)} · mix de sabores
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={cancelBox}
                        className="text-xs font-semibold opacity-40 hover:opacity-70 shrink-0 px-2 py-1"
                        style={{ color: '#e57373' }}
                        title="Remover BOX"
                      >
                        ✕
                      </button>
                    </div>
                    {cookies.map((c) => {
                      const n = order.boxCounts[c.id] ?? 0
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                          style={{ background: 'rgba(29,16,8,0.04)' }}
                        >
                          <span className="text-sm shrink-0">{c.emoji}</span>
                          <span className="flex-1 text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{c.short}</span>
                          <button
                            type="button"
                            onClick={() => changeBoxCount(c.id, -1)}
                            disabled={n <= 0}
                            className="w-7 h-7 rounded-lg font-bold text-base disabled:opacity-25"
                            style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}
                          >−</button>
                          <span className="w-5 text-center text-sm font-black tabular-nums" style={{ color: 'var(--color-text)' }}>{n}</span>
                          <button
                            type="button"
                            onClick={() => changeBoxCount(c.id, 1)}
                            disabled={boxFilled >= boxConfig.size}
                            className="w-7 h-7 rounded-lg font-bold text-base disabled:opacity-25"
                            style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}
                          >+</button>
                        </div>
                      )
                    })}
                    {boxFilled > 0 && (
                      <div className="text-[10px] opacity-40 pt-0.5" style={{ color: 'var(--color-text)' }}>
                        {formatBoxCountsSummary(order.boxCounts, cookies)}
                      </div>
                    )}
                  </div>
                )}

                {/* Demo */}
                {order?.kind === 'demo' && (
                  <div className="bfy-card p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">✨</span>
                      <div>
                        <div className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Demo — prova grátis</div>
                        <div className="text-xs opacity-45" style={{ color: 'var(--color-text)' }}>Seleciona o sabor à mesa</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {cookies.map((c) => {
                        const on = order.demoFlavorId === c.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setDemoFlavor(c.id)}
                            className="rounded-xl px-1 py-2 text-center transition-all"
                            style={{
                              border:     on ? '2px solid var(--color-accent-dark)' : '1.5px solid rgba(29,16,8,0.1)',
                              background: on ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.03)',
                            }}
                          >
                            <div className="text-lg leading-none">{c.emoji}</div>
                            <div
                              className="text-[9px] font-bold mt-1 truncate"
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
                    <div className="text-[11px] font-black uppercase tracking-widest opacity-45 mb-1" style={{ color: 'var(--color-text)' }}>
                      Lista · {nCart} {nCart === 1 ? 'item' : 'itens'}
                    </div>
                    {buildCartLines(cart).map((ln) => {
                      const meta  = productMeta(ln.productId, cookies)
                      const price = getPrice(ln.productId, cookies, miniBoxConfig.price)
                      return (
                        <div
                          key={ln.productId}
                          className="flex items-center gap-2 rounded-xl px-2 py-2"
                          style={{ background: 'rgba(29,16,8,0.04)', border: '1px solid rgba(29,16,8,0.06)' }}
                        >
                          {meta.image
                            ? <img src={meta.image} alt={meta.nome} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                            : <span className="text-xl shrink-0">{meta.emoji}</span>
                          }
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>{meta.nome}</div>
                            <div className="text-[10px] opacity-45" style={{ color: 'var(--color-text)' }}>
                              {ln.qty}× {fmtEuro(price)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => changeQty(ln.productId, -1)}
                              className="w-7 h-7 rounded-lg font-bold text-base"
                              style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}
                            >−</button>
                            <span className="w-5 text-center text-sm font-black tabular-nums" style={{ color: 'var(--color-text)' }}>{ln.qty}</span>
                            <button
                              type="button"
                              onClick={() => addToCart(ln.productId)}
                              className="w-7 h-7 rounded-lg font-bold text-base"
                              style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}
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
                        style={{ background: 'rgba(154,59,28,0.07)', border: '1.5px solid rgba(154,59,28,0.18)' }}
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
                    style={{ background: 'rgba(154,59,28,0.07)', border: '1.5px solid rgba(154,59,28,0.18)' }}
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
                    <div className="text-[11px] font-black uppercase tracking-widest opacity-45 mb-1" style={{ color: 'var(--color-text)' }}>
                      Pagamento
                    </div>
                    {PAYMENTS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPayment(p.id)}
                        className="w-full rounded-xl py-2.5 text-sm font-bold text-left px-4 transition-all"
                        style={{
                          background: payment === p.id ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.04)',
                          color:      payment === p.id ? '#fff' : 'var(--color-text)',
                          border:     payment === p.id ? '2px solid var(--color-accent-dark)' : '1.5px solid rgba(29,16,8,0.1)',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
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
                      background: canConfirm ? 'var(--color-success)' : 'rgba(29,16,8,0.1)',
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
          style={{ background: 'var(--color-bg)', borderColor: 'rgba(29,16,8,0.08)' }}
        >
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Caixa" value={fmtEuro(metrics.total)} accent />
              <StatCard label="Demos" value={metrics.demoCount.total} />
              <StatCard
                label="Ticket"
                value={metrics.revenueSales ? fmtEuro(metrics.total / metrics.revenueSales) : '—'}
              />
            </div>

            <SideBlock title="Cookies vendidos">
              {cookies.map((c) => {
                const qty = metrics.byCookie[c.id] ?? 0
                return (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <span className="w-24 font-semibold truncate" style={{ color: 'var(--color-text)' }}>{c.short}</span>
                    <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(29,16,8,0.1)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(qty / maxCookieBar) * 100}%`, background: 'var(--color-accent)' }}
                      />
                    </div>
                    <span className="w-5 text-right font-black tabular-nums" style={{ color: 'var(--color-text)' }}>{qty}</span>
                  </div>
                )
              })}
            </SideBlock>

            <SideBlock title="Demonstrações por sabor">
              {cookies.map((c) => {
                const qty = metrics.demoCount.byFlavor[c.id] ?? 0
                return (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <span className="w-24 font-semibold truncate opacity-70" style={{ color: 'var(--color-text)' }}>{c.short}</span>
                    <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(29,16,8,0.08)' }}>
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
                      style={{ background: 'rgba(29,16,8,0.04)', border: '1px solid rgba(29,16,8,0.07)' }}
                    >
                      <div className="text-[10px] font-bold opacity-45" style={{ color: 'var(--color-text)' }}>{p.label}</div>
                      <div className="text-lg font-black tabular-nums" style={{ color: 'var(--color-text)' }}>{fmtEuro(r.eur)}</div>
                      <div className="text-[10px] opacity-35" style={{ color: 'var(--color-text)' }}>{r.count}×</div>
                    </div>
                  )
                })}
              </div>
            </SideBlock>

            <SideBlock
              title="Últimos registos"
              action={
                <div className="flex gap-1.5 items-center">
                  <button
                    type="button"
                    onClick={deleteLastSale}
                    disabled={!sales.length}
                    className="text-[10px] font-bold disabled:opacity-30"
                    style={{ color: '#e57373' }}
                  >Excluir última</button>
                  <span className="opacity-25" style={{ color: 'var(--color-text)' }}>·</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[10px] font-bold opacity-35"
                    style={{ color: 'var(--color-text)' }}
                  >Limpar</button>
                </div>
              }
            >
              {sales.length === 0 ? (
                <div className="text-xs opacity-35 py-2" style={{ color: 'var(--color-text)' }}>Nada ainda.</div>
              ) : (
                <div className="space-y-1 max-h-[220px] overflow-y-auto">
                  {sales.slice(0, 20).map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg px-2 py-1.5"
                      style={{ background: 'rgba(29,16,8,0.03)', border: '1px solid rgba(29,16,8,0.05)' }}
                    >
                      <div className="flex gap-2 text-[10px]">
                        <span className="font-mono opacity-40" style={{ color: 'var(--color-text)' }}>{fmtTime(s.createdAt)}</span>
                        <span className="flex-1 truncate text-[11px] font-semibold opacity-65" style={{ color: 'var(--color-text)' }}>
                          {saleDescription(s, cookies)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mt-0.5">
                        <span className="text-[10px] opacity-40" style={{ color: 'var(--color-text)' }}>
                          {(s.totalEur ?? 0) > 0 ? paymentLabel(s.paymentId) : 'Prova grátis'}
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

// ─── View de Gerenciamento ────────────────────────────────────────────────────

const EMPTY_COOKIE_FORM = { nome: '', short: '', emoji: '🍪', price: 3.50, image: '' }

function ManageView({
  cookies, boxConfig, miniBoxConfig,
  addCookie, updateCookie, removeCookie,
  setBoxConfig, setMiniBoxConfig,
  onBack, notify, toast,
}) {
  const [modal, setModal] = useState(null) // null | 'new' | id
  const [form,  setForm]  = useState(EMPTY_COOKIE_FORM)

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
      nome:  form.nome.trim(),
      short: form.short.trim() || form.nome.trim(),
      emoji: form.emoji || '🍪',
      price: parseFloat(form.price) || 0,
      image: form.image.trim(),
    }
    if (!data.nome) return
    modal === 'new' ? addCookie(data) : updateCookie(modal, data)
    setModal(null)
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto p-4 md:p-6 pb-10 space-y-5">

        <div className="flex items-center gap-3">
          <button className="btn-ghost text-sm px-4 py-2" onClick={onBack}>← Voltar</button>
          <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}>
            Gerenciar Cardápio
          </h1>
        </div>

        {/* Lista de cookies */}
        <div className="bfy-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}>
              Cookies Individuais
            </h2>
            <button className="btn-accent text-xs px-4 py-2" onClick={openAdd}>+ Novo cookie</button>
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
                    : <span className="text-xl">{c.emoji}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                  <p className="text-xs opacity-50" style={{ color: 'var(--color-text)' }}>
                    {c.short} · {fmtEuro(c.price)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => openEdit(c)}>Editar</button>
                  <button
                    className="text-xs font-semibold opacity-35 hover:opacity-75 transition-opacity"
                    style={{ color: '#e57373' }}
                    onClick={() => {
                      if (cookies.length <= 1) { notify('Precisa ter pelo menos 1 cookie.'); return }
                      if (confirm(`Remover "${c.nome}"?`)) removeCookie(c.id)
                    }}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BOX config */}
        <div className="bfy-card p-5 space-y-3">
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}>
            Configuração da BOX
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="bfy-label">Nº de cookies na BOX</span>
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
              <span className="bfy-label">Preço da BOX (€)</span>
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

        {/* Mini box config */}
        <div className="bfy-card p-5 space-y-3">
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}>
            Box Mini Cookies
          </h2>
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
      </div>

      {/* Modal add/edit */}
      {modal !== null && (
        <Modal
          title={modal === 'new' ? 'Novo Cookie' : 'Editar Cookie'}
          onClose={() => setModal(null)}
          size="sm"
        >
          <form onSubmit={handleSave} className="space-y-4">
            <label className="block">
              <span className="bfy-label">Nome completo *</span>
              <input
                className="bfy-input"
                required
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Chocolate Triplo"
              />
            </label>
            <label className="block">
              <span className="bfy-label">Nome curto (no cardápio)</span>
              <input
                className="bfy-input"
                value={form.short}
                onChange={(e) => setForm((f) => ({ ...f, short: e.target.value }))}
                placeholder="Igual ao nome se vazio"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="bfy-label">Emoji (fallback)</span>
                <input
                  className="bfy-input"
                  value={form.emoji}
                  onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                  placeholder="🍪"
                />
              </label>
              <label className="block">
                <span className="bfy-label">Preço (€) *</span>
                <input
                  className="bfy-input"
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </label>
            </div>
            <label className="block">
              <span className="bfy-label">URL da imagem (opcional)</span>
              <input
                className="bfy-input"
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                placeholder="https://... ou /imagens/cookie.png"
              />
              {form.image && (
                <img
                  src={form.image}
                  alt="preview"
                  className="mt-2 w-16 h-16 rounded-xl object-cover"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              )}
            </label>
            <div className="flex gap-3 pt-2">
              {modal !== 'new' && (
                <button
                  type="button"
                  className="btn-ghost text-xs px-4"
                  style={{ color: '#e57373', borderColor: '#e57373' }}
                  onClick={() => {
                    if (confirm('Excluir este cookie?')) { removeCookie(modal); setModal(null) }
                  }}
                >
                  Excluir
                </button>
              )}
              <button type="button" className="btn-ghost flex-1" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

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
        background: accent ? 'rgba(194,75,41,0.08)' : 'rgba(29,16,8,0.05)',
        border: `1px solid ${accent ? 'rgba(194,75,41,0.18)' : 'rgba(29,16,8,0.07)'}`,
      }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide opacity-45" style={{ color: 'var(--color-text)' }}>{label}</div>
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
        <div className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--color-text)' }}>{title}</div>
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
