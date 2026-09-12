import { useEffect, useRef, useState } from 'react'
import { Cardapio } from './Cardapio'
import { Caixas } from './Caixas'
import { Checkout } from './Checkout'
import { Pedido } from './Sucesso'
import { Aviso } from './ui'
import { criarPedido, fetchCardapio, isSupabaseConfigured } from './api'
import {
  fmtEuro, linhasCarrinho, totalCarrinho, totalItens,
  findCookie, disponivel, disponivelMini, disponivelTasting,
  clampCarrinho, podeDuplicarCaixa,
  MINI_BOX_ID, TASTING_BOX_ID,
} from './util'
import {
  lerCarrinho, gravarCarrinho, limparCarrinho,
  lerContacto, lerUltimoPedido, gravarUltimoPedido,
  refDaUrl, irParaPedido, sairDoPedido,
} from './storage'

const ANCORAS = [
  { href: '#cardapio', label: 'Cookies' },
  { href: '#box', label: 'Box' },
  { href: '#mini', label: 'Mini' },
  { href: '#tasting', label: 'Tasting' },
]

export function Loja() {
  const [cardapio, setCardapio] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [recarga, setRecarga] = useState(0)

  const [boot] = useState(lerCarrinho)
  const [cart, setCart] = useState(boot.cart)
  const [caixas, setCaixas] = useState(boot.caixas)
  const [draft, setDraft] = useState(boot.draft)

  const [aberto, setAberto] = useState(false)
  const [pedidoRef, setPedidoRef] = useState(() => refDaUrl())

  const carregar = () => setRecarga((n) => n + 1)

  const sacoRef = useRef({ cart, caixas, draft })
  sacoRef.current = { cart, caixas, draft }

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let vivo = true
    fetchCardapio()
      .then((dados) => {
        if (!vivo) return
        setCardapio(dados)
        setErroCarga('')
        const next = clampCarrinho(
          dados,
          sacoRef.current.cart,
          sacoRef.current.caixas,
          sacoRef.current.draft,
        )
        setCart(next.cart)
        setCaixas(next.caixas)
        setDraft(next.draft)
      })
      .catch((e) => {
        console.error(e)
        if (vivo) setErroCarga('Não conseguimos carregar o cardápio agora. Tenta atualizar a página.')
      })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [recarga])

  useEffect(() => {
    gravarCarrinho({ cart, caixas, draft })
  }, [cart, caixas, draft])

  useEffect(() => {
    const onPop = () => setPedidoRef(refDaUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function mais(id) {
    if (!podeJuntar(id)) return
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
  }

  function menos(id) {
    setCart((c) => {
      const n = (c[id] ?? 0) - 1
      const proximo = { ...c }
      if (n <= 0) delete proximo[id]
      else proximo[id] = n
      return proximo
    })
  }

  function podeJuntar(id) {
    if (!cardapio) return false
    if (id === MINI_BOX_ID) return disponivelMini(cardapio, cart) > 0
    if (id === TASTING_BOX_ID) return disponivelTasting(cardapio, cart) > 0
    const c = findCookie(cardapio, id)
    return c ? disponivel(c, cart, caixas, draft) > 0 : false
  }

  function ajustarLinha(l, delta) {
    if (l.tipo === 'caixa') {
      if (delta < 0) setCaixas((cs) => cs.filter((_, i) => i !== l.indice))
      else if (podeDuplicarCaixa(caixas[l.indice], cardapio, cart, caixas, draft)) {
        setCaixas((cs) => [...cs, { ...cs[l.indice] }])
      }
      return
    }
    if (delta > 0) mais(l.key)
    else menos(l.key)
  }

  function podeMaisLinha(l) {
    if (l.tipo === 'caixa') {
      return podeDuplicarCaixa(caixas[l.indice], cardapio, cart, caixas, draft)
    }
    return podeJuntar(l.key)
  }

  function limpar() {
    setCart({})
    setCaixas([])
    setDraft(null)
    limparCarrinho()
  }

  async function enviar(form) {
    const resposta = await criarPedido({
      cliente: {
        nome: form.nome,
        telefone: form.telefone,
      },
      itens: Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([id, qty]) => ({ id, qty })),
      caixas,
      pagamento: form.pagamento,
      entrega: {
        tipo: form.tipo,
        data: form.data,
        morada: form.morada,
        localidade: form.localidade,
        cp: form.cp,
      },
      notas: form.notas,
    })

    if (resposta?.ok) {
      gravarUltimoPedido({
        referencia: resposta.referencia,
        telefone: form.telefone,
        total: resposta.total,
        pagamento: form.pagamento,
      })
      setAberto(false)
      limpar()
      carregar()
      irParaPedido(resposta.referencia)
      setPedidoRef(resposta.referencia)
    } else if (resposta?.esgotado) {
      carregar()
    }
    return resposta
  }

  function fecharPedido() {
    sairDoPedido()
    setPedidoRef('')
  }

  if (!isSupabaseConfigured) {
    return (
      <Centro>
        <Aviso>
          Loja por configurar: faltam <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>.
        </Aviso>
      </Centro>
    )
  }

  if (carregando && !cardapio) {
    return <Centro><p className="text-sm font-semibold ink-2">A tirar os cookies do forno…</p></Centro>
  }

  if (erroCarga && !cardapio) {
    return (
      <Centro>
        <div className="space-y-4 text-center">
          <Aviso>{erroCarga}</Aviso>
          <button type="button" className="btn-primary" onClick={carregar}>Tentar de novo</button>
        </div>
      </Centro>
    )
  }

  const linhas = linhasCarrinho(cardapio, cart, caixas)
  const total = totalCarrinho(linhas)
  const nItens = totalItens(cart, caixas)
  const ultimo = lerUltimoPedido()
  const telPedido = (ultimo?.referencia === pedidoRef ? ultimo.telefone : '') || lerContacto().telefone

  return (
    <div className="loja-body" style={{ paddingBottom: nItens > 0 && !aberto && !pedidoRef ? '5.5rem' : 0 }}>
      <header className="loja-top">
        <div className="loja-wrap py-3 flex items-center justify-between gap-4">
          <p className="loja-brand text-xl">{cardapio.negocio.nome}</p>
          <div className="flex items-center gap-2">
            {(ultimo || pedidoRef) && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  const ref = pedidoRef || ultimo.referencia
                  if (!ref) return
                  if (ref !== pedidoRef) irParaPedido(ref)
                  setPedidoRef(ref)
                }}
              >
                O meu pedido
              </button>
            )}
            {nItens > 0 && !pedidoRef && (
              <button type="button" className="btn-accent btn-sm" onClick={() => setAberto(true)}>
                {nItens} · <span className="bfy-num">{fmtEuro(total)}</span>
              </button>
            )}
          </div>
        </div>
        <nav className="loja-ancoras" aria-label="Cardápio">
          <div className="loja-wrap flex gap-1 overflow-x-auto">
            {ANCORAS.map((a) => (
              <a key={a.href} href={a.href} className="loja-ancora">{a.label}</a>
            ))}
          </div>
        </nav>
      </header>

      <Hero nome={cardapio.negocio.nome} />

      <Cardapio
        cardapio={cardapio}
        cart={cart}
        caixas={caixas}
        boxDraft={draft}
        onMais={mais}
        onMenos={menos}
      />

      <Caixas
        cardapio={cardapio}
        cart={cart}
        caixas={caixas}
        draft={draft}
        setDraft={setDraft}
        onAddCaixa={(counts) => setCaixas((cs) => [...cs, counts])}
        onRemoveCaixa={(i) => setCaixas((cs) => cs.filter((_, k) => k !== i))}
        onMais={mais}
        onMenos={menos}
      />

      <ComoFunciona />

      <footer className="loja-footer">
        <div className="loja-wrap text-center space-y-1">
          <p className="loja-brand text-lg" style={{ color: 'var(--ink-on-dark)' }}>
            {cardapio.negocio.nome}
          </p>
          <p className="text-sm">cookies. coffee. repeat</p>
          <p className="text-xs" style={{ color: 'var(--ink-on-dark-3)' }}>
            Feitos à mão, em pequenos lotes.
          </p>
        </div>
      </footer>

      {nItens > 0 && !aberto && !pedidoRef && (
        <div className="loja-cartbar">
          <div className="loja-wrap flex items-center justify-between gap-4 !px-0 sm:!px-6">
            <div>
              <p className="text-xs" style={{ color: 'var(--ink-on-dark-2)' }}>
                {nItens} {nItens === 1 ? 'item' : 'itens'}
              </p>
              <p className="bfy-num font-black text-lg">{fmtEuro(total)}</p>
            </div>
            <button type="button" className="btn-accent px-6 py-3" onClick={() => setAberto(true)}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {aberto && !pedidoRef && (
        <Checkout
          cardapio={cardapio}
          cart={cart}
          caixas={caixas}
          onFechar={() => setAberto(false)}
          onAjustarLinha={ajustarLinha}
          onPodeMais={podeMaisLinha}
          onEnviar={enviar}
        />
      )}

      {pedidoRef && (
        <Pedido
          referencia={pedidoRef}
          telefoneInicial={telPedido}
          onNovo={fecharPedido}
        />
      )}
    </div>
  )
}

function Centro({ children }) {
  return (
    <div className="loja-body flex items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

function Hero({ nome }) {
  return (
    <section className="loja-hero">
      <div className="loja-wrap loja-hero-inner grid md:grid-cols-2 gap-5 md:gap-8 items-center">
        <div className="space-y-3 md:space-y-5">
          <p className="bfy-chip bfy-chip-accent">Feitos à mão, todos os dias</p>
          <h1 className="loja-hero-title">
            Cookies que<br />valem a viagem.
          </h1>
          <p className="text-sm md:text-lg ink-2 max-w-md">
            Escolhe, diz se levantas ou se entregamos, e fica com um código.
            O pagamento combinamos depois.
          </p>
          <a href="#cardapio" className="btn-primary px-6 py-3 text-base">
            Escolher os meus cookies
          </a>
        </div>
        <div className="justify-self-center">
          <img
            className="loja-hero-img"
            src="/hero-crumb.png"
            alt={`Cookies da ${nome}`}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      </div>
    </section>
  )
}

function ComoFunciona() {
  const passos = [
    ['Escolhes', 'Cookies avulsos, uma Box montada por ti ou uma caixa pronta.'],
    ['Dizes como recebes', 'Levantas connosco ou entregamos na tua morada.'],
    ['Combinamos o pagamento', 'MB WAY, Multibanco ou dinheiro — nada é cobrado no site.'],
  ]
  return (
    <section className="loja-wrap py-9 md:py-12">
      <div className="bfy-card p-5 md:p-7">
        <h2 className="bfy-title text-xl mb-4">Como funciona</h2>
        <ol className="grid sm:grid-cols-3 gap-4">
          {passos.map(([titulo, texto], i) => (
            <li key={titulo} className="flex gap-3">
              <span className="passo-num" aria-hidden="true">{i + 1}</span>
              <div>
                <p className="font-bold text-sm ink-1">{titulo}</p>
                <p className="text-sm ink-2 mt-0.5">{texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
