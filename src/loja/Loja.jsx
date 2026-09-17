import { useEffect, useRef, useState } from 'react'
import { Menu } from './Menu'
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
import { toqueJuntar, toquePedidoFeito } from './sensacao'

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
  const [recemCriado, setRecemCriado] = useState(false)

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
    toqueJuntar()
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
        toqueJuntar()
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
      toquePedidoFeito()
      gravarUltimoPedido({
        referencia: resposta.referencia,
        telefone: form.telefone,
        total: resposta.total,
        pagamento: form.pagamento,
      })
      setAberto(false)
      limpar()
      carregar()
      setRecemCriado(true)
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
    setRecemCriado(false)
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
    return (
      <Centro fundo="var(--color-primary)">
        <img className="loja-logo loja-logo-pulse" src="/hero-crumb.png" alt="Crumb Lab" />
      </Centro>
    )
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
  const temSaco = nItens > 0 && !aberto && !pedidoRef

  return (
    <div className="loja-body" style={{ paddingBottom: temSaco ? '5.5rem' : 0 }}>
      <header className="loja-top">
        <div className="loja-wrap py-2.5 flex items-center justify-between gap-4">
          <img className="loja-logo" src="/hero-crumb.png" alt="Crumb Lab" />
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
      </header>

      <Menu
        cardapio={cardapio}
        cart={cart}
        caixas={caixas}
        draft={draft}
        setDraft={setDraft}
        temSaco={temSaco}
        onAddCaixa={(counts) => {
          toqueJuntar()
          setCaixas((cs) => [...cs, counts])
        }}
        onRemoveCaixa={(i) => setCaixas((cs) => cs.filter((_, k) => k !== i))}
        onMais={mais}
        onMenos={menos}
      />

      <footer className="loja-footer">
        <div className="loja-wrap text-center space-y-1">
          <img className="loja-logo loja-logo-on-dark mx-auto" src="/hero-crumb.png" alt="" />
          <p className="text-sm">cookies. coffee. repeat</p>
        </div>
      </footer>

      {temSaco && (
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
          recemCriado={recemCriado}
          onNovo={fecharPedido}
        />
      )}
    </div>
  )
}

function Centro({ children, fundo }) {
  return (
    <div
      className="loja-body flex items-center justify-center p-6"
      style={fundo ? { background: fundo } : undefined}
    >
      <div className="w-full max-w-sm flex flex-col items-center">{children}</div>
    </div>
  )
}
