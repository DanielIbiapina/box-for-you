import { useMemo, useState } from 'react'
import { useCookies } from '../stores/useCookies'
import { useEstoqueCookies } from '../stores/useEstoqueCookies'
import { useClientes } from '../stores/useClientes'
import { usePedidosVendas, STATUS_PEDIDO } from '../stores/usePedidosVendas'
import { Modal } from '../components/Modal'
import { SearchInput } from '../components/SearchInput'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const fmtDateFull = (iso) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

const PAGAMENTOS = ['Dinheiro', 'MB WAY', 'Multibanco', 'Transferência', 'Outro']

function statusInfo(id) {
  return STATUS_PEDIDO.find((s) => s.id === id) ?? STATUS_PEDIDO[0]
}

function linhaSummary(linhas, cookies) {
  return linhas
    .map((l) => {
      const c = cookies.find((x) => x.id === l.cookieId)
      return `${l.qty}× ${c?.short ?? l.cookieId}`
    })
    .join(', ')
}

const EMPTY_CLIENTE = { nome: '', telefone: '', instagram: '', email: '', notas: '' }
const EMPTY_PEDIDO  = { clienteId: '', status: 'pendente', formaPagamento: 'Dinheiro', notas: '' }

// ─── Ícones SVG ──────────────────────────────────────────────────────────────

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.77 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.68 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  )
}

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function Vendas() {
  const { cookies } = useCookies()
  const { stockCookies, adjustCookies, deductSale } = useEstoqueCookies()
  const { clientes, adicionar: addCliente, atualizar: updateCliente, remover: removeCliente } = useClientes()
  const { pedidos, adicionar: addPedido, atualizar: updatePedido, remover: removePedido } = usePedidosVendas()

  // ── Views ──
  const [tab,            setTab]            = useState('pedidos') // 'pedidos' | 'clientes'
  const [clienteDetalhe, setClienteDetalhe] = useState(null)    // id do cliente selecionado

  // ── Modais ──
  const [modalCliente, setModalCliente] = useState(null)  // null | 'new' | id
  const [modalPedido,  setModalPedido]  = useState(null)  // null | 'new' | id
  const [clienteForm,  setClienteForm]  = useState(EMPTY_CLIENTE)
  const [pedidoForm,   setPedidoForm]   = useState(EMPTY_PEDIDO)
  const [pedidoCart,   setPedidoCart]   = useState({}) // { cookieId: qty }

  // ── Busca ──
  const [searchCliente, setSearchCliente] = useState('')

  // ── Computed ──────────────────────────────────────────────────────────────

  const clientesFiltrados = useMemo(() =>
    clientes.filter((c) =>
      !searchCliente ||
      c.nome.toLowerCase().includes(searchCliente.toLowerCase()) ||
      c.instagram?.toLowerCase().includes(searchCliente.toLowerCase()) ||
      c.telefone?.includes(searchCliente),
    ), [clientes, searchCliente])

  const clienteDetalheObj = clienteDetalhe
    ? clientes.find((c) => c.id === clienteDetalhe) ?? null
    : null

  const pedidosDoCliente = clienteDetalhe
    ? pedidos.filter((p) => p.clienteId === clienteDetalhe)
    : []

  const pedidosMes = useMemo(() => {
    const now  = new Date()
    const key  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return pedidos.filter((p) => p.criadoEm.startsWith(key))
  }, [pedidos])

  const totalMes    = pedidosMes.filter((p) => p.status !== 'cancelado').reduce((s, p) => s + p.totalEur, 0)
  const pendenteMes = pedidosMes.filter((p) => p.status === 'pendente').length

  const pedidoCartTotal = useMemo(() =>
    Object.entries(pedidoCart).reduce((sum, [id, qty]) => {
      const c = cookies.find((x) => x.id === id)
      return sum + (c ? c.price * qty : 0)
    }, 0), [pedidoCart, cookies])

  // ── Handlers clientes ─────────────────────────────────────────────────────

  function openNewCliente(prefilledClienteId = '') {
    setClienteForm({ ...EMPTY_CLIENTE })
    setModalCliente('new')
  }

  function openEditCliente(c) {
    setClienteForm({ nome: c.nome, telefone: c.telefone, instagram: c.instagram, email: c.email, notas: c.notas })
    setModalCliente(c.id)
  }

  function handleSaveCliente(e) {
    e.preventDefault()
    const dados = {
      nome: clienteForm.nome.trim(),
      telefone: clienteForm.telefone.trim(),
      instagram: clienteForm.instagram.trim(),
      email: clienteForm.email.trim(),
      notas: clienteForm.notas.trim(),
    }
    if (!dados.nome) return
    if (modalCliente === 'new') {
      const novo = addCliente(dados)
      setClienteDetalhe(novo.id)
      setTab('clientes')
    } else {
      updateCliente(modalCliente, dados)
    }
    setModalCliente(null)
  }

  // ── Handlers pedidos ──────────────────────────────────────────────────────

  function openNewPedido(clienteId = '') {
    setPedidoForm({ ...EMPTY_PEDIDO, clienteId })
    setPedidoCart({})
    setModalPedido('new')
  }

  function openEditPedido(p) {
    setPedidoForm({
      clienteId: p.clienteId ?? '',
      status: p.status,
      formaPagamento: p.formaPagamento,
      notas: p.notas,
    })
    const cart = {}
    for (const l of p.linhas) cart[l.cookieId] = l.qty
    setPedidoCart(cart)
    setModalPedido(p.id)
  }

  function cartAdjust(cookieId, delta) {
    setPedidoCart((prev) => {
      const n = (prev[cookieId] ?? 0) + delta
      if (n <= 0) { const c = { ...prev }; delete c[cookieId]; return c }
      return { ...prev, [cookieId]: n }
    })
  }

  function buildLinhas() {
    return Object.entries(pedidoCart).map(([cookieId, qty]) => {
      const c = cookies.find((x) => x.id === cookieId)
      return { cookieId, qty, preco: c?.price ?? 0 }
    })
  }

  function handleSavePedido(e) {
    e.preventDefault()
    const linhas = buildLinhas()
    if (!linhas.length) return

    const dados = {
      clienteId: pedidoForm.clienteId || null,
      linhas,
      totalEur: pedidoCartTotal,
      formaPagamento: pedidoForm.formaPagamento,
      status: pedidoForm.status,
      notas: pedidoForm.notas,
    }

    if (modalPedido === 'new') {
      addPedido(dados)
      if (pedidoForm.status !== 'cancelado') {
        deductSale(linhas.map((l) => ({ cookieId: l.cookieId, qty: l.qty })))
      }
    } else {
      const old = pedidos.find((p) => p.id === modalPedido)
      updatePedido(modalPedido, dados)

      const wasActive  = old?.status !== 'cancelado'
      const isNowActive = dados.status !== 'cancelado'

      if (wasActive && !isNowActive) {
        // Cancelado → devolver stock
        for (const l of old.linhas) adjustCookies(l.cookieId, l.qty)
      } else if (!wasActive && isNowActive) {
        // Reativado → deduzir stock
        deductSale(linhas.map((l) => ({ cookieId: l.cookieId, qty: l.qty })))
      }
    }
    setModalPedido(null)
  }

  function handleDeletePedido(p) {
    if (!confirm(`Excluir pedido de ${fmtEuro(p.totalEur)}?`)) return
    if (p.status !== 'cancelado') {
      for (const l of p.linhas) adjustCookies(l.cookieId, l.qty)
    }
    removePedido(p.id)
  }

  // ── Render: detalhe do cliente ─────────────────────────────────────────────

  if (clienteDetalhe && clienteDetalheObj) {
    const totalCliente = pedidosDoCliente
      .filter((p) => p.status !== 'cancelado')
      .reduce((s, p) => s + p.totalEur, 0)

    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto pb-10 space-y-5">
        <div className="flex items-center gap-3">
          <button
            className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5"
            onClick={() => setClienteDetalhe(null)}
          >
            <IconBack /> Clientes
          </button>
        </div>

        {/* Info do cliente */}
        <div className="bfy-card p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(154,59,28,0.1)', color: 'var(--color-accent-dark)' }}
              >
                <IconUser />
              </div>
              <div>
                <h2
                  className="text-xl font-black"
                  style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}
                >
                  {clienteDetalheObj.nome}
                </h2>
                <p className="text-xs opacity-45" style={{ color: 'var(--color-text)' }}>
                  Cliente desde {fmtDateFull(clienteDetalheObj.criadoEm)}
                </p>
              </div>
            </div>
            <button
              className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0"
              onClick={() => openEditCliente(clienteDetalheObj)}
            >
              <IconEdit /> Editar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {clienteDetalheObj.telefone && (
              <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <span className="opacity-40"><IconPhone /></span>
                <a href={`tel:${clienteDetalheObj.telefone}`} className="text-sm font-semibold">
                  {clienteDetalheObj.telefone}
                </a>
              </div>
            )}
            {clienteDetalheObj.instagram && (
              <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <span className="opacity-40"><IconInstagram /></span>
                <span className="text-sm font-semibold">@{clienteDetalheObj.instagram.replace('@', '')}</span>
              </div>
            )}
            {clienteDetalheObj.email && (
              <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <span className="text-sm font-semibold opacity-70">{clienteDetalheObj.email}</span>
              </div>
            )}
          </div>

          {clienteDetalheObj.notas && (
            <p className="text-xs opacity-55 italic border-t pt-3" style={{ color: 'var(--color-text)', borderColor: 'rgba(29,16,8,0.08)' }}>
              {clienteDetalheObj.notas}
            </p>
          )}

          {/* Stats do cliente */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              { label: 'Total gasto', value: fmtEuro(totalCliente), accent: true },
              { label: 'Pedidos', value: pedidosDoCliente.length },
              { label: 'Pendentes', value: pedidosDoCliente.filter((p) => p.status === 'pendente').length },
            ].map((k, i) => (
              <div
                key={i}
                className="rounded-2xl p-3 text-center"
                style={{
                  background: k.accent ? 'rgba(154,59,28,0.07)' : 'rgba(29,16,8,0.04)',
                  border: `1px solid ${k.accent ? 'rgba(154,59,28,0.15)' : 'rgba(29,16,8,0.07)'}`,
                }}
              >
                <div
                  className="text-lg font-black tabular-nums"
                  style={{ color: k.accent ? 'var(--color-accent-dark)' : 'var(--color-text)', fontFamily: 'var(--font-title)' }}
                >
                  {k.value}
                </div>
                <div className="text-[10px] opacity-45 mt-0.5" style={{ color: 'var(--color-text)' }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pedidos do cliente */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: 'var(--color-text)' }}>
            Histórico de pedidos
          </h3>
          <button
            className="btn-accent text-xs px-4 py-2"
            onClick={() => openNewPedido(clienteDetalhe)}
          >
            + Novo pedido
          </button>
        </div>

        {pedidosDoCliente.length === 0 ? (
          <div className="bfy-card p-10 text-center opacity-45" style={{ color: 'var(--color-text)' }}>
            Nenhum pedido ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {pedidosDoCliente.map((p) => {
              const st = statusInfo(p.status)
              return (
                <PedidoCard
                  key={p.id}
                  pedido={p}
                  cookies={cookies}
                  st={st}
                  onEdit={() => openEditPedido(p)}
                  onDelete={() => handleDeletePedido(p)}
                />
              )
            })}
          </div>
        )}

        {/* Modais */}
        {modalCliente !== null && (
          <ClienteModal
            title="Editar Cliente"
            form={clienteForm}
            setForm={setClienteForm}
            onClose={() => setModalCliente(null)}
            onSave={handleSaveCliente}
            canDelete
            onDelete={() => {
              if (confirm(`Excluir cliente "${clienteDetalheObj?.nome}"? Os pedidos serão mantidos.`)) {
                removeCliente(clienteDetalhe)
                setClienteDetalhe(null)
                setModalCliente(null)
              }
            }}
          />
        )}
        {modalPedido !== null && (
          <PedidoModal
            title={modalPedido === 'new' ? 'Novo Pedido' : 'Editar Pedido'}
            form={pedidoForm}
            setForm={setPedidoForm}
            cart={pedidoCart}
            cartAdjust={cartAdjust}
            total={pedidoCartTotal}
            cookies={cookies}
            stockCookies={stockCookies}
            clientes={clientes}
            onClose={() => setModalPedido(null)}
            onSave={handleSavePedido}
          />
        )}
      </div>
    )
  }

  // ── Render: principal ─────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-10 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-black"
            style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}
          >
            Vendas Diretas
          </h1>
          <p className="text-sm mt-1 opacity-55" style={{ color: 'var(--color-text)' }}>
            WhatsApp, Instagram e encomendas
          </p>
        </div>
        <button
          className="btn-accent text-sm px-4 py-2 shrink-0"
          onClick={() => openNewPedido('')}
        >
          + Novo Pedido
        </button>
      </div>

      {/* Stats do mês */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Receita (mês)', value: fmtEuro(totalMes), accent: true },
          { label: 'Pedidos (mês)', value: pedidosMes.filter((p) => p.status !== 'cancelado').length },
          { label: 'Pendentes', value: pendenteMes },
        ].map((k, i) => (
          <div
            key={i}
            className="bfy-card p-4 text-center"
          >
            <div
              className="text-xl font-black tabular-nums"
              style={{ color: k.accent ? 'var(--color-accent-dark)' : 'var(--color-text)', fontFamily: 'var(--font-title)' }}
            >
              {k.value}
            </div>
            <div className="text-xs mt-1 opacity-50" style={{ color: 'var(--color-text)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="flex rounded-xl overflow-hidden"
        style={{ border: '1.5px solid rgba(29,16,8,0.12)', width: 'fit-content' }}
      >
        {[
          { id: 'pedidos',  label: `Pedidos (${pedidos.length})` },
          { id: 'clientes', label: `Clientes (${clientes.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-5 py-2 text-sm font-bold transition-all"
            style={{
              background: tab === t.id ? 'var(--color-accent-dark)' : 'transparent',
              color: tab === t.id ? '#fff' : 'var(--color-text)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Pedidos ── */}
      {tab === 'pedidos' && (
        <>
          {pedidos.length === 0 ? (
            <div className="bfy-card p-12 text-center space-y-3">
              <p className="text-lg font-semibold opacity-40" style={{ color: 'var(--color-text)' }}>
                Nenhum pedido ainda
              </p>
              <button className="btn-accent px-5 py-2.5" onClick={() => openNewPedido('')}>
                + Criar primeiro pedido
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {pedidos.map((p) => {
                const st     = statusInfo(p.status)
                const cliente = clientes.find((c) => c.id === p.clienteId)
                return (
                  <div
                    key={p.id}
                    className="bfy-card p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                          {cliente ? cliente.nome : <span className="opacity-40">Sem cliente</span>}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-black"
                          style={{
                            background: `${st.color}20`,
                            color: st.color,
                            border: `1px solid ${st.color}40`,
                          }}
                        >
                          {st.label}
                        </span>
                        {p.formaPagamento && (
                          <span className="text-[10px] opacity-40" style={{ color: 'var(--color-text)' }}>
                            · {p.formaPagamento}
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-55 truncate" style={{ color: 'var(--color-text)' }}>
                        {linhaSummary(p.linhas, cookies)}
                      </p>
                      {p.notas && (
                        <p className="text-[10px] opacity-40 italic truncate" style={{ color: 'var(--color-text)' }}>
                          {p.notas}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-black text-base tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                          {fmtEuro(p.totalEur)}
                        </p>
                        <p className="text-[10px] opacity-40" style={{ color: 'var(--color-text)' }}>
                          {fmtDate(p.criadoEm)}
                        </p>
                      </div>
                      <button
                        className="btn-ghost text-xs px-3 py-1.5"
                        onClick={() => openEditPedido(p)}
                      >
                        Editar
                      </button>
                      <button
                        className="opacity-30 hover:opacity-70 transition-opacity text-xs"
                        style={{ color: '#e57373' }}
                        onClick={() => handleDeletePedido(p)}
                        title="Excluir"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Clientes ── */}
      {tab === 'clientes' && (
        <>
          <div className="flex items-center gap-3">
            <SearchInput
              className="flex-1 max-w-xs"
              placeholder="Buscar cliente..."
              value={searchCliente}
              onChange={(e) => setSearchCliente(e.target.value)}
            />
            <button className="btn-accent text-sm px-4 py-2 shrink-0" onClick={() => openNewCliente()}>
              + Novo cliente
            </button>
          </div>

          {clientesFiltrados.length === 0 ? (
            <div className="bfy-card p-12 text-center space-y-3">
              <p className="text-lg font-semibold opacity-40" style={{ color: 'var(--color-text)' }}>
                {clientes.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum resultado'}
              </p>
              {clientes.length === 0 && (
                <button className="btn-accent px-5 py-2.5" onClick={() => openNewCliente()}>
                  + Adicionar primeiro cliente
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {clientesFiltrados.map((c) => {
                const clientePedidos = pedidos.filter((p) => p.clienteId === c.id)
                const total = clientePedidos.filter((p) => p.status !== 'cancelado').reduce((s, p) => s + p.totalEur, 0)
                return (
                  <button
                    key={c.id}
                    className="bfy-card p-4 w-full text-left flex items-center gap-4 transition-all hover:shadow-md active:scale-[0.99]"
                    onClick={() => setClienteDetalhe(c.id)}
                  >
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(154,59,28,0.08)', color: 'var(--color-accent-dark)' }}
                    >
                      <IconUser />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        {c.telefone && (
                          <span className="text-xs opacity-45 flex items-center gap-1" style={{ color: 'var(--color-text)' }}>
                            <IconPhone /> {c.telefone}
                          </span>
                        )}
                        {c.instagram && (
                          <span className="text-xs opacity-45 flex items-center gap-1" style={{ color: 'var(--color-text)' }}>
                            <IconInstagram /> @{c.instagram.replace('@', '')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                        {fmtEuro(total)}
                      </p>
                      <p className="text-[10px] opacity-40" style={{ color: 'var(--color-text)' }}>
                        {clientePedidos.length} pedido{clientePedidos.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modais */}
      {modalCliente !== null && (
        <ClienteModal
          title={modalCliente === 'new' ? 'Novo Cliente' : 'Editar Cliente'}
          form={clienteForm}
          setForm={setClienteForm}
          onClose={() => setModalCliente(null)}
          onSave={handleSaveCliente}
          canDelete={modalCliente !== 'new'}
          onDelete={() => {
            const c = clientes.find((x) => x.id === modalCliente)
            if (confirm(`Excluir cliente "${c?.nome}"? Os pedidos serão mantidos.`)) {
              removeCliente(modalCliente)
              setModalCliente(null)
            }
          }}
        />
      )}
      {modalPedido !== null && (
        <PedidoModal
          title={modalPedido === 'new' ? 'Novo Pedido' : 'Editar Pedido'}
          form={pedidoForm}
          setForm={setPedidoForm}
          cart={pedidoCart}
          cartAdjust={cartAdjust}
          total={pedidoCartTotal}
          cookies={cookies}
          stockCookies={stockCookies}
          clientes={clientes}
          onClose={() => setModalPedido(null)}
          onSave={handleSavePedido}
        />
      )}
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function PedidoCard({ pedido, cookies, st, onEdit, onDelete }) {
  return (
    <div
      className="bfy-card p-4 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-black"
            style={{ background: `${st.color}20`, color: st.color, border: `1px solid ${st.color}40` }}
          >
            {st.label}
          </span>
          <span className="text-[10px] opacity-40" style={{ color: 'var(--color-text)' }}>
            {new Date(pedido.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            · {pedido.formaPagamento}
          </span>
        </div>
        <p className="text-xs opacity-55 truncate" style={{ color: 'var(--color-text)' }}>
          {linhaSummary(pedido.linhas, cookies)}
        </p>
        {pedido.notas && (
          <p className="text-[10px] opacity-40 italic" style={{ color: 'var(--color-text)' }}>{pedido.notas}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-black text-base tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
          {fmtEuro(pedido.totalEur)}
        </span>
        <button className="btn-ghost text-xs px-3 py-1.5" onClick={onEdit}>Editar</button>
        <button
          className="opacity-30 hover:opacity-70 transition-opacity text-xs"
          style={{ color: '#e57373' }}
          onClick={onDelete}
          title="Excluir"
        >✕</button>
      </div>
    </div>
  )
}

function ClienteModal({ title, form, setForm, onClose, onSave, canDelete, onDelete }) {
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <form onSubmit={onSave} className="space-y-4">
        <label className="block">
          <span className="bfy-label">Nome *</span>
          <input
            className="bfy-input"
            required
            autoFocus
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Nome do cliente"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="bfy-label">Telefone / WhatsApp</span>
            <input
              className="bfy-input"
              type="tel"
              value={form.telefone}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              placeholder="+351 912 345 678"
            />
          </label>
          <label className="block">
            <span className="bfy-label">Instagram</span>
            <input
              className="bfy-input"
              value={form.instagram}
              onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
              placeholder="@usuario"
            />
          </label>
        </div>
        <label className="block">
          <span className="bfy-label">Email</span>
          <input
            className="bfy-input"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="email@exemplo.com"
          />
        </label>
        <label className="block">
          <span className="bfy-label">Notas</span>
          <textarea
            className="bfy-input resize-none"
            rows={2}
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            placeholder="Preferências, alergias, obs..."
          />
        </label>
        <div className="flex gap-3 pt-2">
          {canDelete && (
            <button
              type="button"
              className="btn-ghost text-xs px-3"
              style={{ color: '#e57373', borderColor: '#e57373' }}
              onClick={onDelete}
            >
              Excluir
            </button>
          )}
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary flex-1">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

function PedidoModal({ title, form, setForm, cart, cartAdjust, total, cookies, stockCookies, clientes, onClose, onSave }) {
  return (
    <Modal title={title} onClose={onClose} size="md">
      <form onSubmit={onSave} className="space-y-4">
        {/* Cliente */}
        <label className="block">
          <span className="bfy-label">Cliente</span>
          <select
            className="bfy-input"
            value={form.clienteId}
            onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
          >
            <option value="">— Sem cliente (anónimo) —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>

        {/* Cookies */}
        <div>
          <span className="bfy-label mb-2 block">Cookies *</span>
          <div className="grid grid-cols-2 gap-2">
            {cookies.map((c) => {
              const n = cart[c.id] ?? 0
              const available = stockCookies[c.id] ?? 0
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{
                    background: n > 0 ? 'rgba(154,59,28,0.07)' : 'rgba(29,16,8,0.04)',
                    border: `1.5px solid ${n > 0 ? 'rgba(154,59,28,0.2)' : 'rgba(29,16,8,0.08)'}`,
                  }}
                >
                  <span className="text-lg shrink-0">{c.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: 'var(--color-text)' }}>{c.short}</p>
                    <p className="text-[10px] opacity-40" style={{ color: 'var(--color-text)' }}>
                      {available > 0 ? `${available} em stock` : 'sem stock'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => cartAdjust(c.id, -1)}
                      disabled={n <= 0}
                      className="w-7 h-7 rounded-lg font-bold text-base flex items-center justify-center disabled:opacity-25"
                      style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}
                    >−</button>
                    <span
                      className="w-5 text-center text-sm font-black tabular-nums"
                      style={{ color: n > 0 ? 'var(--color-accent-dark)' : 'var(--color-text)', opacity: n > 0 ? 1 : 0.3 }}
                    >{n}</span>
                    <button
                      type="button"
                      onClick={() => cartAdjust(c.id, 1)}
                      className="w-7 h-7 rounded-lg font-bold text-base flex items-center justify-center"
                      style={{ border: '1.5px solid rgba(29,16,8,0.15)' }}
                    >+</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Total */}
        {total > 0 && (
          <div
            className="flex justify-between items-center rounded-xl px-4 py-2.5"
            style={{ background: 'rgba(154,59,28,0.07)', border: '1px solid rgba(154,59,28,0.18)' }}
          >
            <span className="text-sm font-bold opacity-60" style={{ color: 'var(--color-text)' }}>Total</span>
            <span className="font-black text-lg tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
              {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(total)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Pagamento */}
          <label className="block">
            <span className="bfy-label">Pagamento</span>
            <select
              className="bfy-input"
              value={form.formaPagamento}
              onChange={(e) => setForm((f) => ({ ...f, formaPagamento: e.target.value }))}
            >
              {PAGAMENTOS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          {/* Status */}
          <label className="block">
            <span className="bfy-label">Estado</span>
            <select
              className="bfy-input"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {STATUS_PEDIDO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="bfy-label">Notas</span>
          <input
            className="bfy-input"
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            placeholder="Endereço de entrega, obs especiais..."
          />
        </label>

        <div className="flex gap-3 pt-2">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={total <= 0}
          >
            Salvar pedido
          </button>
        </div>
      </form>
    </Modal>
  )
}
