import { useEffect, useMemo, useRef, useState } from 'react'

// ─── Configuração ────────────────────────────────────────────────────────────

const BRAND_NAME = 'Cookies Box for you'

const COOKIE_FLAVORS = [
  {
    id: 'chocolate',
    label: 'Chocolate',
    short: 'Chocolate',
    emoji: '🍫',
    price: 3,
    menuIdle:
      'bg-gradient-to-br from-amber-200 via-orange-50 to-yellow-950/10 border-[3px] border-amber-800/40 shadow-xl shadow-amber-900/20 hover:border-amber-700',
    menuActive:
      'bg-gradient-to-br from-amber-950 via-amber-900 to-orange-950 border-[3px] border-amber-300 ring-[3px] ring-amber-400/70 ring-offset-2 ring-offset-amber-100 shadow-xl',
    priceIdle: 'text-amber-950',
    priceActive: 'text-amber-300',
    labelIdle: 'text-stone-900',
    labelActive: 'text-white drop-shadow-sm',
  },
  {
    id: 'nutella',
    label: 'Nutella',
    short: 'Nutella',
    emoji: '🫙',
    price: 3.5,
    menuIdle:
      'bg-gradient-to-br from-rose-200 via-orange-50 to-amber-950/15 border-[3px] border-rose-700/35 shadow-xl shadow-rose-900/15 hover:border-rose-600',
    menuActive:
      'bg-gradient-to-br from-rose-950 via-orange-950 to-stone-950 border-[3px] border-rose-300 ring-[3px] ring-rose-400/65 ring-offset-2 ring-offset-rose-50 shadow-xl',
    priceIdle: 'text-rose-950',
    priceActive: 'text-rose-200',
    labelIdle: 'text-stone-900',
    labelActive: 'text-white drop-shadow-sm',
  },
  {
    id: 'kinder',
    label: 'Kinder',
    short: 'Kinder',
    emoji: '🥚',
    price: 3.5,
    menuIdle:
      'bg-gradient-to-br from-orange-200 via-amber-50 to-orange-950/15 border-[3px] border-orange-600/45 shadow-xl shadow-orange-900/18 hover:border-orange-500',
    menuActive:
      'bg-gradient-to-br from-orange-950 via-orange-900 to-stone-950 border-[3px] border-orange-300 ring-[3px] ring-orange-400/65 ring-offset-2 ring-offset-orange-50 shadow-xl',
    priceIdle: 'text-orange-950',
    priceActive: 'text-orange-200',
    labelIdle: 'text-stone-900',
    labelActive: 'text-white drop-shadow-sm',
  },
  {
    id: 'mm',
    label: 'M&M',
    short: 'M&M',
    emoji: '🟡',
    price: 3,
    menuIdle:
      'bg-gradient-to-br from-sky-200 via-indigo-50 to-blue-950/15 border-[3px] border-sky-700/38 shadow-xl shadow-sky-900/15 hover:border-sky-600',
    menuActive:
      'bg-gradient-to-br from-sky-950 via-blue-950 to-indigo-950 border-[3px] border-sky-300 ring-[3px] ring-sky-400/65 ring-offset-2 ring-offset-sky-50 shadow-xl',
    priceIdle: 'text-sky-950',
    priceActive: 'text-sky-200',
    labelIdle: 'text-stone-900',
    labelActive: 'text-white drop-shadow-sm',
  },
  {
    id: 'bow',
    label: 'Especial Brasil (BOW)',
    short: 'BOW',
    emoji: '🇧🇷',
    price: 3,
    menuIdle:
      'bg-gradient-to-br from-emerald-200 via-lime-50 to-green-950/15 border-[3px] border-emerald-700/42 shadow-xl shadow-emerald-900/18 hover:border-emerald-600',
    menuActive:
      'bg-gradient-to-br from-emerald-950 via-green-900 to-teal-950 border-[3px] border-emerald-300 ring-[3px] ring-emerald-400/65 ring-offset-2 ring-offset-emerald-50 shadow-xl',
    priceIdle: 'text-emerald-950',
    priceActive: 'text-emerald-200',
    labelIdle: 'text-stone-900',
    labelActive: 'text-white drop-shadow-sm',
  },
]

const EXTRA_SINGLE = [
  { id: 'mini', label: 'Mini cookies', short: 'Mini', emoji: '🍪', subtitle: 'Pacote mini', price: 2.5 },
  {
    id: 'brigadeiros',
    label: '4 Brigadeiros',
    short: 'Brig.',
    emoji: '🟤',
    subtitle: '4 unidades',
    price: 6,
  },
]

const PAYMENTS = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'mbway', label: 'MB WAY' },
  { id: 'multibanco', label: 'Multibanco' },
]

const PRICE_BOX = 10
const BOX_SIZE = 4
const STORAGE_KEY = 'cookies-sales:v1'

// ─── Utilitários ─────────────────────────────────────────────────────────────

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

function initialBoxCounts() {
  return Object.fromEntries(COOKIE_FLAVORS.map((f) => [f.id, 0]))
}

function boxTotalCount(boxCounts) {
  return COOKIE_FLAVORS.reduce((acc, f) => acc + (boxCounts[f.id] ?? 0), 0)
}

function flattenBoxToArray(boxCounts) {
  const arr = []
  for (const f of COOKIE_FLAVORS) {
    const n = boxCounts[f.id] ?? 0
    for (let i = 0; i < n; i++) arr.push(f.id)
  }
  return arr
}

function formatBoxCountsSummary(boxCounts) {
  return COOKIE_FLAVORS.filter((f) => (boxCounts[f.id] ?? 0) > 0)
    .map((f) => `${boxCounts[f.id]}× ${f.label}`)
    .join(' · ')
}

function readSales() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function paymentLabel(id) {
  if (id === 'gratis') return 'Prova grátis'
  return PAYMENTS.find((p) => p.id === id)?.label ?? id
}

function singleProductMeta(productId) {
  const c = COOKIE_FLAVORS.find((f) => f.id === productId)
  if (c) return { ...c, subtitle: '1 cookie' }
  const e = EXTRA_SINGLE.find((x) => x.id === productId)
  if (e) return { ...e }
  return { label: String(productId), emoji: '❓', subtitle: '', price: 0 }
}

function singlePrice(productId) {
  return singleProductMeta(productId).price
}

function productLabel(productId) {
  return singleProductMeta(productId).label
}

function flavorCookieLabel(id) {
  return COOKIE_FLAVORS.find((f) => f.id === id)?.label ?? id
}

function cartPieces(cart) {
  return Object.values(cart).reduce((acc, v) => acc + (v ?? 0), 0)
}

/** Linhas só com qty > 0, ordem estável para o relatório */
function buildCartOrderLines(cart) {
  const ids = [...COOKIE_FLAVORS.map((f) => f.id), ...EXTRA_SINGLE.map((e) => e.id)]
  const lines = []
  for (const id of ids) {
    const q = cart[id] ?? 0
    if (q > 0) lines.push({ productId: id, qty: q })
  }
  return lines
}

function cartOrderTotalEur(cart) {
  return buildCartOrderLines(cart).reduce(
    (sum, ln) => sum + singlePrice(ln.productId) * ln.qty,
    0,
  )
}

function saleDescription(s) {
  if (s.kind === 'single') return productLabel(s.flavorId)
  if (s.kind === 'order')
    return (s.lines ?? []).map((ln) => `${ln.qty}× ${productLabel(ln.productId)}`).join(', ')
  if (s.kind === 'demo')
    return `Demonstração (${flavorCookieLabel(s.demoFlavorId)}) · prova grátis`
  const countsFromArray = COOKIE_FLAVORS.reduce((acc, f) => {
    acc[f.id] = (s.boxFlavors ?? []).filter((x) => x === f.id).length
    return acc
  }, {})
  return (
    `BOX · ${formatBoxCountsSummary(countsFromArray) || (s.boxFlavors ?? []).map(flavorCookieLabel).join(', ')}`
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [sales, setSales] = useState(() => readSales())
  /** Lista avulsa: productId → quantidade */
  const [cart, setCart] = useState({})
  /** box | demo | null — vendas compostas ficam só no cart */
  const [order, setOrder] = useState(null)
  const [payment, setPayment] = useState(null)
  const [toast, setToast] = useState(null)
  const toastRef = useRef(0)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sales))
  }, [sales])

  useEffect(() => () => clearTimeout(toastRef.current), [])

  const metrics = useMemo(() => {
    let total = 0
    const byCookie = Object.fromEntries(COOKIE_FLAVORS.map((f) => [f.id, 0]))
    const byExtra = Object.fromEntries(EXTRA_SINGLE.map((e) => [e.id, 0]))
    const demosByFlavor = Object.fromEntries(COOKIE_FLAVORS.map((f) => [f.id, 0]))
    const byPayment = Object.fromEntries(PAYMENTS.map((p) => [p.id, { count: 0, eur: 0 }]))
    let demoCount = 0

    for (const s of sales) {
      total += s.totalEur ?? 0
      if ((s.totalEur ?? 0) > 0 && s.paymentId && s.paymentId !== 'gratis' && byPayment[s.paymentId]) {
        byPayment[s.paymentId].count++
        byPayment[s.paymentId].eur += s.totalEur ?? 0
      }
      if (s.kind === 'single') {
        const pid = s.flavorId
        if (byCookie[pid] != null) byCookie[pid]++
        else if (byExtra[pid] != null) byExtra[pid]++
      } else if (s.kind === 'order') {
        for (const ln of s.lines ?? []) {
          const pid = ln.productId
          const q = ln.qty ?? 0
          if (byCookie[pid] != null) byCookie[pid] += q
          else if (byExtra[pid] != null) byExtra[pid] += q
        }
      } else if (s.kind === 'demo') {
        demoCount++
        const df = s.demoFlavorId
        if (demosByFlavor[df] != null) demosByFlavor[df]++
      } else {
        const list = s.boxFlavors ?? []
        for (const fid of list) {
          if (byCookie[fid] != null) byCookie[fid]++
        }
      }
    }

    const revenueSaleCount = sales.filter((s) => (s.totalEur ?? 0) > 0).length

    return {
      total,
      byCookie,
      byExtra,
      demosByFlavor,
      demoCount,
      byPayment,
      revenueSaleCount,
    }
  }, [sales])

  function notify(msg) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2400)
  }

  function cancelOrder() {
    setOrder(null)
    setPayment(null)
  }

  function cancelCheckout() {
    if (order) cancelOrder()
    else {
      setCart({})
      setPayment(null)
    }
  }

  function addCartLine(productId) {
    setOrder((prev) => {
      if (!prev) return prev
      if (prev.kind === 'box') {
        notify('BOX cancelada — itens vão para a lista avulsa.')
        return null
      }
      if (prev.kind === 'demo') {
        notify('Demonstração cancelada — lista avulsa em uso.')
        return null
      }
      return prev
    })
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }))
  }

  function changeCartQty(productId, delta) {
    setCart((prev) => {
      const cur = prev[productId] ?? 0
      const next = cur + delta
      if (next <= 0) {
        const copy = { ...prev }
        delete copy[productId]
        return copy
      }
      return { ...prev, [productId]: next }
    })
  }

  function startBox() {
    setCart((prev) => {
      if (cartPieces(prev) > 0) notify('Lista avulsa limpa ao abrir a BOX.')
      return {}
    })
    setOrder({ kind: 'box', flavorId: null, boxCounts: initialBoxCounts(), demoFlavorId: null })
    setPayment(null)
  }

  function startDemo() {
    setCart((prev) => {
      if (cartPieces(prev) > 0) notify('Lista avulsa limpa ao abrir demonstração.')
      return {}
    })
    setOrder({ kind: 'demo', flavorId: null, boxCounts: initialBoxCounts(), demoFlavorId: null })
    setPayment(null)
  }

  function setDemoFlavor(cookieId) {
    setOrder((prev) =>
      prev?.kind === 'demo' ? { ...prev, demoFlavorId: cookieId } : prev,
    )
  }

  function changeBoxCount(flavorId, delta) {
    setOrder((prev) => {
      if (!prev || prev.kind !== 'box') return prev
      const counts = { ...prev.boxCounts }
      const cur = counts[flavorId] ?? 0
      const totalNow = boxTotalCount(counts)
      if (delta > 0 && totalNow >= BOX_SIZE) {
        notify(`Só podem entrar ${BOX_SIZE} cookies no total na BOX.`)
        return prev
      }
      const next = cur + delta
      if (next < 0) return prev
      counts[flavorId] = next
      return { ...prev, boxCounts: counts }
    })
  }

  function confirmSale() {
    if (order?.kind === 'demo') {
      if (!order.demoFlavorId) {
        notify('Escolhe o sabor usado para a demonstração.')
        return
      }
      const sale = {
        id: uid(),
        createdAt: new Date().toISOString(),
        kind: 'demo',
        demoFlavorId: order.demoFlavorId,
        flavorId: null,
        boxFlavors: [],
        paymentId: 'gratis',
        totalEur: 0,
      }
      setSales((prev) => [sale, ...prev])
      cancelOrder()
      notify('Demonstração registada ✓')
      return
    }

    if (!order && cartPieces(cart) > 0) {
      if (!payment) {
        notify('Seleciona o método de pagamento.')
        return
      }
      const lines = buildCartOrderLines(cart)
      const totalEur = cartOrderTotalEur(cart)
      const sale = {
        id: uid(),
        createdAt: new Date().toISOString(),
        kind: 'order',
        lines,
        flavorId: null,
        boxFlavors: [],
        paymentId: payment,
        totalEur,
      }
      setSales((prev) => [sale, ...prev])
      setCart({})
      setPayment(null)
      notify('Venda registada ✓')
      return
    }

    if (!order) {
      notify('Adiciona itens ao pedido ou escolhe BOX / Demonstração.')
      return
    }

    if (!payment) {
      notify('Seleciona o método de pagamento.')
      return
    }
    if (order.kind === 'box' && boxTotalCount(order.boxCounts) !== BOX_SIZE) {
      notify(`Seleciona exatamente ${BOX_SIZE} cookies (podes repetir sabores).`)
      return
    }

    let sale = {
      id: uid(),
      createdAt: new Date().toISOString(),
      kind: 'box',
      flavorId: null,
      boxFlavors: flattenBoxToArray(order.boxCounts),
      paymentId: payment,
      totalEur: PRICE_BOX,
    }
    setSales((prev) => [sale, ...prev])
    cancelOrder()
    notify('Venda registada ✓')
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
      `Relatório — ${BRAND_NAME}`,
      `Gerado em: ${new Date().toLocaleString('pt-PT')}`,
      '',
      `Total vendido: ${fmtEuro(metrics.total)}`,
      `Registos: ${sales.length} (${metrics.demoCount} demonstrações)`,
      '',
      'Cookies por sabor (vendas + BOX):',
      ...COOKIE_FLAVORS.map((f) => `  ${f.label}: ${metrics.byCookie[f.id] ?? 0}`),
      '',
      'Demonstrações por sabor (cookie usado na mesa — prova grátis):',
      ...COOKIE_FLAVORS.map((f) => `  ${f.label}: ${metrics.demosByFlavor[f.id] ?? 0}`),
      '',
      'Outros produtos:',
      ...EXTRA_SINGLE.map((e) => `  ${e.label}: ${metrics.byExtra[e.id] ?? 0} vendas`),
      '',
      'Por pagamento (só operações pagas):',
      ...PAYMENTS.map((p) => {
        const r = metrics.byPayment[p.id]
        return `  ${p.label}: ${r.count} vendas — ${fmtEuro(r.eur)}`
      }),
      '',
      'Últimos registos:',
      ...sales.slice(0, 50).map((s) => {
        const t = fmtTime(s.createdAt)
        const pay =
          (s.totalEur ?? 0) > 0 ? paymentLabel(s.paymentId) : 'Prova grátis'
        return `  ${t} | ${saleDescription(s)} | ${pay} | ${fmtEuro(s.totalEur ?? 0)}`
      }),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `cookies-box-for-you-${new Date().toISOString().slice(0, 10)}.txt`,
    })
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const orderPrice =
    order?.kind === 'box' ? PRICE_BOX
      : order?.kind === 'demo' ? 0
      : cartOrderTotalEur(cart)

  const boxFilled = order?.kind === 'box' ? boxTotalCount(order.boxCounts) : 0

  const nCart = cartPieces(cart)
  const payingConfirmCart = !order && nCart > 0 && !!payment
  const payingConfirmBox =
    order?.kind === 'box' &&
    !!payment &&
    boxFilled === BOX_SIZE

  const demoConfirm = order?.kind === 'demo' && !!order.demoFlavorId

  const canConfirm =
    order?.kind === 'demo'
      ? demoConfirm
      : order?.kind === 'box'
        ? payingConfirmBox
        : payingConfirmCart

  const maxCookieBar = Math.max(...COOKIE_FLAVORS.map((f) => metrics.byCookie[f.id] ?? 0), 1)
  const maxDemoBar = Math.max(...COOKIE_FLAVORS.map((f) => metrics.demosByFlavor[f.id] ?? 0), 1)

  function confirmFooterText() {
    if (order?.kind === 'demo')
      return demoConfirm ? '✓ Confirmar demonstração' : 'Escolhe o sabor'
    if (order?.kind === 'box') {
      if (payingConfirmBox) return `✓ Confirmar ${fmtEuro(orderPrice)}`
      if (boxFilled < BOX_SIZE) return `Faltam ${BOX_SIZE - boxFilled} cookie(s)`
      return 'Escolhe o pagamento'
    }
    if (nCart > 0) return payingConfirmCart ? `✓ Confirmar ${fmtEuro(orderPrice)}` : 'Escolhe o pagamento'
    return 'Escolhe itens ao lado ou BOX'
  }

  return (
    <div className="h-[100dvh] bg-stone-100 text-stone-900 flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="shrink-0 bg-stone-900 text-stone-50 px-5 py-2.5 flex items-center justify-between gap-4 border-b border-stone-700">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">🍪</span>
          <div className="min-w-0">
            <div className="font-extrabold text-sm truncate">{BRAND_NAME}</div>
            <div className="text-[10px] text-stone-400">Offline-first · Vendas + demonstrações</div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-stone-400 uppercase tracking-wide">Caixa</div>
            <div className="text-base font-extrabold text-amber-400 tabular-nums">{fmtEuro(metrics.total)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-stone-400">Pagas</div>
            <div className="text-sm font-bold tabular-nums">{metrics.revenueSaleCount}</div>
          </div>
          <button
            type="button"
            onClick={exportTxt}
            className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold text-xs px-3 py-2 rounded-lg"
          >
            Exportar .TXT
          </button>
        </div>
      </header>

      {/* 3 colunas: cardápio | checkout | dashboard */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Cardápio (principal, sem scroll intencional) ── */}
        <section className="flex-[1.15] min-w-0 flex flex-col bg-gradient-to-br from-amber-100/70 via-orange-50 to-stone-100 border-r border-stone-200 px-4 py-3">
          <div className="shrink-0 flex items-center justify-between gap-2 mb-2">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-900/80">
              Cardápio
            </h2>
            <span className="text-[10px] text-stone-500 hidden md:inline">
              Clica para somar · total em Finalizar
            </span>
          </div>

          <div className="flex-1 min-h-0 flex flex-col justify-center gap-y-4 py-2">
            {/* Cookies — cards grandes por sabor */}
            <div className="grid grid-cols-5 gap-3 xl:gap-4 shrink-0">
              {COOKIE_FLAVORS.map((f) => {
                const n = cart[f.id] ?? 0
                const on = n > 0
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => addCartLine(f.id)}
                    className={[
                      'group relative rounded-3xl px-3 py-5 xl:py-7 text-center transition-all duration-150',
                      'min-h-[7.75rem] xl:min-h-[9rem] flex flex-col items-center justify-center gap-2',
                      'active:scale-[0.97]',
                      on ? f.menuActive : f.menuIdle,
                    ].join(' ')}
                  >
                    {on ? (
                      <span className="absolute top-2 right-2 flex h-9 min-w-9 px-2 items-center justify-center rounded-full bg-white/95 font-black text-lg text-stone-900 shadow-md ring-2 ring-amber-500/70 tabular-nums z-10">
                        {n}
                      </span>
                    ) : null}
                    <div className="text-4xl xl:text-[2.85rem] leading-none translate-y-0.5 drop-shadow-sm select-none">
                      {f.emoji}
                    </div>
                    <div
                      className={[
                        'text-sm xl:text-[0.95rem] font-black leading-snug px-1 line-clamp-2 xl:min-h-[2lh]',
                        on ? f.labelActive : f.labelIdle,
                      ].join(' ')}
                    >
                      {f.short}
                    </div>
                    <div
                      className={[
                        'text-sm xl:text-base font-black tabular-nums tracking-tight',
                        on ? f.priceActive : f.priceIdle,
                      ].join(' ')}
                    >
                      {fmtEuro(f.price)}
                      <span className={['block text-[10px] font-bold mt-0.5 opacity-90', on ? 'text-white/80' : 'text-stone-600'].join(' ')}>
                        cada
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Outros + BOX */}
            <div className="grid grid-cols-2 gap-2 shrink-0">
              {EXTRA_SINGLE.map((item) => {
                const n = cart[item.id] ?? 0
                const active = n > 0
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addCartLine(item.id)}
                    className={[
                      'relative rounded-2xl border-2 px-3 py-2.5 text-left transition-all active:scale-[0.97] flex gap-3 items-center',
                      active
                        ? 'bg-stone-900 border-stone-900 text-white'
                        : 'bg-white/95 border-stone-200 hover:border-amber-500/60',
                    ].join(' ')}
                  >
                    {active ? (
                      <span className="absolute -top-1.5 -right-1 flex h-7 min-w-7 px-1.5 items-center justify-center rounded-full bg-amber-500 font-black text-sm text-stone-900 shadow z-10">
                        {n}
                      </span>
                    ) : null}
                    <span className="text-xl shrink-0">{item.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold truncate">{item.label}</div>
                      <div className={['text-[10px] truncate', active ? 'text-stone-300' : 'text-stone-500'].join(' ')}>
                        {item.subtitle}
                      </div>
                    </div>
                    <div className={['text-sm font-extrabold ml-auto shrink-0 tabular-nums', active ? 'text-amber-300' : 'text-amber-800'].join(' ')}>
                      {fmtEuro(item.price)}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
              <button
                type="button"
                onClick={startBox}
                className={[
                  'rounded-2xl border-2 px-3 py-3 flex gap-3 items-center transition-all active:scale-[0.97]',
                  order?.kind === 'box'
                    ? 'bg-amber-600 border-amber-700 text-white shadow-lg'
                    : 'bg-amber-400/35 border-amber-500 hover:bg-amber-400/50',
                ].join(' ')}
              >
                <span className="text-2xl">📦</span>
                <div className="text-left flex-1 min-w-0">
                  <div className="font-extrabold text-sm">BOX</div>
                  <div className={['text-[10px]', order?.kind === 'box' ? 'text-amber-100' : 'text-amber-900/80'].join(' ')}>
                    {BOX_SIZE} cookies · repetir sabores
                  </div>
                </div>
                <div className={['font-extrabold text-base tabular-nums shrink-0', order?.kind === 'box' ? 'text-white' : 'text-amber-950'].join(' ')}>
                  {fmtEuro(PRICE_BOX)}
                </div>
              </button>

              <button
                type="button"
                onClick={startDemo}
                className={[
                  'rounded-2xl border-2 px-3 py-3 flex gap-3 items-center transition-all active:scale-[0.97]',
                  order?.kind === 'demo'
                    ? 'bg-violet-800 border-violet-900 text-white shadow-lg'
                    : 'bg-violet-100 border-violet-300 hover:bg-violet-200/70',
                ].join(' ')}
              >
                <span className="text-2xl">✨</span>
                <div className="text-left flex-1 min-w-0">
                  <div className="font-extrabold text-sm leading-tight">Cookie demonstração</div>
                  <div className={['text-[10px] leading-snug mt-0.5', order?.kind === 'demo' ? 'text-violet-200' : 'text-violet-900/85'].join(' ')}>
                    Quebre na mesa — prova grátis ({fmtEuro(0)})
                  </div>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* ── Checkout (fixo ao centro — sem descer o cardápio) ── */}
        <section className="w-[min(380px,32vw)] shrink-0 flex flex-col bg-stone-50 border-r border-stone-200 shadow-inner">
          <div className="shrink-0 px-4 py-2 border-b border-stone-200 bg-white/70">
            <div className="text-[11px] font-black uppercase tracking-widest text-stone-400">Finalizar</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
            {!order && nCart === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 text-stone-400 text-sm">
                <span className="text-4xl mb-3 opacity-50">👉</span>
                <p>
                  Clica no <strong className="text-stone-600">cardápio</strong> para somar ao pedido —
                  vê aqui as quantidades e o{' '}
                  <strong className="text-stone-600">total</strong> antes de confirmar.
                </p>
              </div>
            ) : order ? (
              <div className="flex flex-col gap-4">
                {/* Resumo do pedido */}
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  {order.kind === 'box' && (
                    <div className="flex gap-3 items-start">
                      <span className="text-3xl">📦</span>
                      <div className="flex-1">
                        <div className="font-extrabold">BOX ({boxFilled}/{BOX_SIZE})</div>
                        <div className="text-xs text-stone-500">{fmtEuro(PRICE_BOX)} · escolher quantidades por sabor</div>
                      </div>
                    </div>
                  )}
                  {order.kind === 'demo' && (
                    <div className="flex gap-3 items-start">
                      <span className="text-3xl">✨</span>
                      <div className="flex-1">
                        <div className="font-extrabold">Cookie demonstração</div>
                        <div className="text-xs text-stone-600 mt-0.5">
                          Indica qual sabor vai ser à mesa para a prova grátis. Sem valor de venda.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {order.kind === 'box' && (
                  <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-stone-500 mb-2">
                      <span>Distribuição</span>
                      <span className="tabular-nums">{boxFilled}/{BOX_SIZE}</span>
                    </div>
                    {COOKIE_FLAVORS.map((f) => {
                      const n = order.boxCounts[f.id] ?? 0
                      return (
                        <div
                          key={f.id}
                          className="flex items-center gap-2 rounded-xl bg-stone-50 px-2 py-1.5"
                        >
                          <span>{f.emoji}</span>
                          <span className="flex-1 text-xs font-semibold truncate">{f.short}</span>
                          <button
                            type="button"
                            aria-label="menos"
                            onClick={() => changeBoxCount(f.id, -1)}
                            disabled={n <= 0}
                            className="w-8 h-8 rounded-lg border bg-white text-lg font-bold disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-black tabular-nums">{n}</span>
                          <button
                            type="button"
                            aria-label="mais"
                            onClick={() => changeBoxCount(f.id, 1)}
                            disabled={boxFilled >= BOX_SIZE}
                            className="w-8 h-8 rounded-lg border bg-white text-lg font-bold disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      )
                    })}
                    {boxFilled > 0 && (
                      <div className="text-[10px] text-stone-500 pt-1 leading-snug">
                        {formatBoxCountsSummary(order.boxCounts)}
                      </div>
                    )}
                  </div>
                )}

                {order.kind === 'demo' && (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-3 shadow-sm">
                    <div className="text-xs font-extrabold text-violet-900 mb-2">Sabor para a mesa</div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {COOKIE_FLAVORS.map((f) => {
                        const on = order.demoFlavorId === f.id
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setDemoFlavor(f.id)}
                            className={[
                              'rounded-xl border px-1 py-2 text-center transition-all',
                              on
                                ? 'bg-violet-800 border-violet-900 text-white'
                                : 'bg-white border-violet-200 hover:border-violet-400',
                            ].join(' ')}
                          >
                            <div className="text-lg leading-none">{f.emoji}</div>
                            <div className="text-[9px] font-bold mt-1 truncate">{f.short}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {order.kind !== 'demo' && (
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-extrabold text-stone-700 mb-2">Pagamento</div>
                    <div className="flex flex-col gap-2">
                      {PAYMENTS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPayment(p.id)}
                          className={[
                            'rounded-xl border-2 py-2.5 text-sm font-bold transition-all text-left px-4',
                            payment === p.id
                              ? 'bg-stone-900 border-stone-900 text-white'
                              : 'bg-stone-50 border-stone-200 hover:border-stone-400',
                          ].join(' ')}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-auto pt-2">
                  <button
                    type="button"
                    onClick={cancelCheckout}
                    className="flex-1 py-3 rounded-xl border-2 border-stone-300 bg-white text-stone-700 font-bold text-sm"
                  >
                    {order ? 'Cancelar' : 'Limpar lista'}
                  </button>
                  <button
                    type="button"
                    onClick={confirmSale}
                    disabled={!canConfirm}
                    className={[
                      'flex-[1.8] py-3 rounded-xl font-extrabold text-sm transition-all',
                      canConfirm
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed',
                    ].join(' ')}
                  >
                    {confirmFooterText()}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-stone-400">
                        Lista avulsa
                      </div>
                      <div className="text-sm text-stone-600 mt-0.5">
                        {nCart} {nCart === 1 ? 'artigo' : 'artigos'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {buildCartOrderLines(cart).map((ln) => {
                      const meta = singleProductMeta(ln.productId)
                      const unit = singlePrice(ln.productId)
                      const sub = unit * ln.qty
                      return (
                        <div
                          key={ln.productId}
                          className="flex items-center gap-2 rounded-xl bg-stone-50 border border-stone-100 px-2 py-2"
                        >
                          <span className="text-2xl shrink-0">{meta.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-extrabold text-stone-900 truncate">{meta.label}</div>
                            <div className="text-[10px] text-stone-500">
                              {ln.qty}× {fmtEuro(unit)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              aria-label="menos"
                              onClick={() => changeCartQty(ln.productId, -1)}
                              className="w-8 h-8 rounded-lg border border-stone-300 bg-white text-lg font-bold text-stone-800 active:scale-95"
                            >
                              −
                            </button>
                            <span className="w-7 text-center text-sm font-black tabular-nums">{ln.qty}</span>
                            <button
                              type="button"
                              aria-label="mais"
                              onClick={() => addCartLine(ln.productId)}
                              className="w-8 h-8 rounded-lg border border-stone-300 bg-white text-lg font-bold text-stone-800 active:scale-95"
                            >
                              +
                            </button>
                          </div>
                          <div className="text-sm font-black text-amber-800 tabular-nums w-16 text-right shrink-0">
                            {fmtEuro(sub)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-amber-300/80 bg-amber-50 px-4 py-3 flex justify-between items-center">
                  <span className="text-sm font-extrabold text-amber-950">Total a pagar</span>
                  <span className="text-xl font-black text-amber-900 tabular-nums">{fmtEuro(cartOrderTotalEur(cart))}</span>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-extrabold text-stone-700 mb-2">Pagamento</div>
                  <div className="flex flex-col gap-2">
                    {PAYMENTS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPayment(p.id)}
                        className={[
                          'rounded-xl border-2 py-2.5 text-sm font-bold transition-all text-left px-4',
                          payment === p.id
                            ? 'bg-stone-900 border-stone-900 text-white'
                            : 'bg-stone-50 border-stone-200 hover:border-stone-400',
                        ].join(' ')}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 mt-auto pt-2">
                  <button
                    type="button"
                    onClick={cancelCheckout}
                    className="flex-1 py-3 rounded-xl border-2 border-stone-300 bg-white text-stone-700 font-bold text-sm"
                  >
                    Limpar lista
                  </button>
                  <button
                    type="button"
                    onClick={confirmSale}
                    disabled={!canConfirm}
                    className={[
                      'flex-[1.8] py-3 rounded-xl font-extrabold text-sm transition-all',
                      canConfirm
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed',
                    ].join(' ')}
                  >
                    {confirmFooterText()}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Dashboard à direita (scroll apenas aqui em ecrãs baixos) ── */}
        <aside className="w-[300px] lg:w-[min(380px,28vw)] shrink-0 bg-white overflow-y-auto border-l border-stone-100">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 gap-2">
              <DashCardMini label="Total caixa" value={fmtEuro(metrics.total)} accent />
              <DashCardMini label="Demonstrações (hoje)" value={metrics.demoCount} />
              <DashCardMini
                label="Ticket médio (pagas)"
                value={
                  metrics.revenueSaleCount
                    ? fmtEuro(metrics.total / metrics.revenueSaleCount)
                    : '—'
                }
              />
            </div>

            <DashboardBlock title="Cookies vendidos (+ BOX)">
              {COOKIE_FLAVORS.map((f) => {
                const qty = metrics.byCookie[f.id] ?? 0
                return (
                  <div key={f.id} className="flex items-center gap-2 text-xs">
                    <span className="w-28 font-semibold text-stone-700 truncate">{f.short}</span>
                    <div className="flex-1 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${(qty / maxCookieBar) * 100}%` }}
                      />
                    </div>
                    <span className="w-5 text-right font-extrabold tabular-nums">{qty}</span>
                  </div>
                )
              })}
            </DashboardBlock>

            <DashboardBlock title="Demonstrações por sabor">
              {COOKIE_FLAVORS.map((f) => {
                const qty = metrics.demosByFlavor[f.id] ?? 0
                return (
                  <div key={f.id} className="flex items-center gap-2 text-xs">
                    <span className="w-28 font-semibold text-violet-900/80 truncate">{f.short}</span>
                    <div className="flex-1 bg-violet-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-violet-600 h-full rounded-full"
                        style={{ width: `${((qty ?? 0) / maxDemoBar) * 100}%` }}
                      />
                    </div>
                    <span className="w-5 text-right font-extrabold tabular-nums">{qty}</span>
                  </div>
                )
              })}
            </DashboardBlock>

            <DashboardBlock title="Pagamento (vendas pagas)">
              <div className="grid grid-cols-1 gap-2">
                {PAYMENTS.map((p) => {
                  const r = metrics.byPayment[p.id]
                  return (
                    <div key={p.id} className="rounded-xl bg-stone-50 px-3 py-2 border border-stone-100">
                      <div className="text-[10px] font-bold text-stone-500">{p.label}</div>
                      <div className="text-lg font-black text-stone-900">{fmtEuro(r.eur)}</div>
                      <div className="text-[10px] text-stone-500">{r.count}x</div>
                    </div>
                  )
                })}
              </div>
            </DashboardBlock>

            <DashboardBlock title="Outros produtos">
              <div className="space-y-2">
                {EXTRA_SINGLE.map((e) => (
                  <div key={e.id} className="flex justify-between text-xs py-1 border-b border-stone-50 last:border-0">
                    <span className="font-semibold">{e.short}</span>
                    <span className="font-extrabold tabular-nums">{metrics.byExtra[e.id]} vendas</span>
                  </div>
                ))}
              </div>
            </DashboardBlock>

            <DashboardBlock title="Últimos registos" actionRight={
              <>
                <button type="button" onClick={deleteLastSale} disabled={!sales.length} className="text-[10px] font-bold text-rose-600 disabled:opacity-30">
                  Excluir última
                </button>
                <span className="text-stone-300">·</span>
                <button type="button" onClick={clearAll} className="text-[10px] font-bold text-stone-400">
                  Limpar
                </button>
              </>
            }>
              {sales.length === 0 ? (
                <div className="text-xs text-stone-400 py-2">Nada ainda.</div>
              ) : (
                <div className="space-y-1 max-h-[220px] overflow-y-auto">
                  {sales.slice(0, 20).map((s) => (
                    <div key={s.id} className="rounded-lg px-2 py-1.5 hover:bg-stone-50 border border-transparent hover:border-stone-100">
                      <div className="flex gap-2 text-[10px] text-stone-400 font-mono">
                        {fmtTime(s.createdAt)}
                        <span className="flex-1 text-stone-600 font-sans truncate text-[11px] font-semibold">{saleDescription(s)}</span>
                      </div>
                      <div className="flex justify-between items-baseline mt-0.5">
                        <span className="text-[10px] text-stone-500">
                          {(s.totalEur ?? 0) > 0 ? paymentLabel(s.paymentId) : 'Prova grátis'}
                        </span>
                        <span className="text-xs font-bold text-amber-800 tabular-nums">{fmtEuro(s.totalEur ?? 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DashboardBlock>
          </div>
        </aside>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md">
          <div className="bg-stone-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl text-center">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}

function DashCardMini({ label, value, accent }) {
  return (
    <div
      className={[
        'rounded-xl px-3 py-2 border',
        accent ? 'bg-amber-50 border-amber-200' : 'bg-stone-50 border-stone-100',
      ].join(' ')}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`text-lg font-black tabular-nums ${accent ? 'text-amber-800' : 'text-stone-900'}`}>
        {value}
      </div>
    </div>
  )
}

function DashboardBlock({ title, children, actionRight }) {
  return (
    <div className="rounded-2xl border border-stone-200 p-3 bg-stone-50/80">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{title}</div>
        {actionRight && <div className="flex gap-1 items-center shrink-0">{actionRight}</div>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}
