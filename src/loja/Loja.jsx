import { useEffect, useMemo, useRef, useState } from 'react'
import { Menu } from './Menu'
import { Bandeja } from './Bandeja'
import { Checkout } from './Checkout'
import { Pedido } from './Sucesso'
import { Aviso } from './ui'
import { criarPedido, fetchCardapio, isSupabaseConfigured } from './api'
import {
  findCookie, livreSabor, livreExtra, contar, agrupar,
  resumoPedido, payloadPedido, clampEscolha, poupancaPorBox,
} from './util'
import {
  lerCarrinho, gravarCarrinho, limparCarrinho,
  lerContacto, lerUltimoPedido, gravarUltimoPedido,
  refDaUrl, irParaPedido, sairDoPedido,
} from './storage'
import { toqueJuntar, toqueTirar, toqueBoxFechada, toqueSemStock, toquePedidoFeito } from './sensacao'
import { voar, saltar, abanar } from './voar'

export function Loja() {
  const [cardapio, setCardapio] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [recarga, setRecarga] = useState(0)

  const [boot] = useState(lerCarrinho)
  const [picks, setPicks] = useState(boot.picks)
  const [extras, setExtras] = useState(boot.extras)
  /** A Box que acabou de fechar com o último toque — só vive até ao gesto seguinte. */
  const [fechou, setFechou] = useState(null)

  const [aberto, setAberto] = useState(false)
  /** Box que o pedido abre já expandida (quando se toca no contador de Boxes). */
  const [caixaAberta, setCaixaAberta] = useState(null)
  const [pedidoRef, setPedidoRef] = useState(() => refDaUrl())
  const [recemCriado, setRecemCriado] = useState(false)

  const carregar = () => setRecarga((n) => n + 1)

  const sacoRef = useRef({ picks, extras })
  useEffect(() => { sacoRef.current = { picks, extras } }, [picks, extras])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let vivo = true
    fetchCardapio()
      .then((dados) => {
        if (!vivo) return
        setCardapio(dados)
        setErroCarga('')
        const next = clampEscolha(dados, sacoRef.current.picks, sacoRef.current.extras)
        setPicks(next.picks)
        setExtras(next.extras)
      })
      .catch((e) => {
        console.error(e)
        if (vivo) setErroCarga('Não conseguimos carregar o cardápio agora. Tenta atualizar a página.')
      })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [recarga])

  useEffect(() => {
    gravarCarrinho({ picks, extras })
  }, [picks, extras])

  useEffect(() => {
    const onPop = () => setPedidoRef(refDaUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Com uma folha aberta, a página por trás não rola.
  const folhaAberta = aberto || Boolean(pedidoRef)
  useEffect(() => {
    if (!folhaAberta) return undefined
    const antes = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => { document.documentElement.style.overflow = antes }
  }, [folhaAberta])

  const resumo = useMemo(
    () => (cardapio ? resumoPedido(picks, extras, cardapio) : null),
    [picks, extras, cardapio],
  )

  // ── gestos no cardápio ──────────────────────────────────────────────────
  function juntar(id, fotoEl = null, cardEl = null) {
    const c = findCookie(cardapio, id)
    if (!c) return
    if (livreSabor(c, picks) <= 0) {
      toqueSemStock()
      abanar(cardEl)
      return
    }
    const proximo = [...picks, id]
    const size = cardapio.box.size
    const fechouAgora = agrupar(proximo, cardapio).caixas.length > agrupar(picks, cardapio).caixas.length
    if (fechouAgora) {
      toqueBoxFechada()
      setFechou({ ids: proximo.slice(-size), n: proximo.length })
    } else {
      toqueJuntar(((proximo.length - 1) % size) + 1)
      setFechou(null)
    }
    saltar(fotoEl)
    voar(fotoEl, document.querySelector(`[data-slot="${(proximo.length - 1) % size}"]`))
    setPicks(proximo)
  }

  function tirar(id) {
    const i = picks.lastIndexOf(id)
    if (i < 0) return
    toqueTirar()
    setFechou(null)
    setPicks(picks.filter((_, k) => k !== i))
  }

  function juntarExtra(id, fotoEl = null, cardEl = null) {
    if (livreExtra(cardapio, extras, id) <= 0) {
      toqueSemStock()
      abanar(cardEl)
      return
    }
    toqueJuntar(4)
    saltar(fotoEl)
    voar(fotoEl, document.querySelector('[data-alvo="total"]'))
    setFechou(null)
    setExtras((e) => ({ ...e, [id]: (e[id] ?? 0) + 1 }))
  }

  function tirarExtra(id) {
    toqueTirar()
    setExtras((e) => {
      const n = (e[id] ?? 0) - 1
      const next = { ...e }
      if (n <= 0) delete next[id]
      else next[id] = n
      return next
    })
  }

  // ── ajustes na revisão do pedido ────────────────────────────────────────
  /** Tira um cookie de dentro de uma Box. A escolha volta a agrupar-se sozinha. */
  function tirarNaPosicao(i) {
    if (i < 0 || i >= picks.length) return
    toqueTirar()
    setFechou(null)
    setPicks(picks.filter((_, k) => k !== i))
  }

  function abrirPedido(inicioCaixa = null) {
    setCaixaAberta(inicioCaixa)
    setAberto(true)
  }

  function tirarCaixa(inicio) {
    toqueTirar()
    setFechou(null)
    setPicks(picks.filter((_, k) => k < inicio || k >= inicio + cardapio.box.size))
  }

  function podeRepetirCaixa(inicio) {
    const ids = picks.slice(inicio, inicio + cardapio.box.size)
    return Object.entries(contar(ids)).every(([id, q]) => livreSabor(findCookie(cardapio, id), picks) >= q)
  }

  /** Uma Box igual entra logo a seguir às Boxes cheias, para não baralhar com os soltos. */
  function repetirCaixa(inicio) {
    if (!podeRepetirCaixa(inicio)) {
      toqueSemStock()
      return
    }
    const size = cardapio.box.size
    const ids = picks.slice(inicio, inicio + size)
    const cheias = Math.floor(picks.length / size) * size
    toqueBoxFechada()
    setFechou(null)
    setPicks([...picks.slice(0, cheias), ...ids, ...picks.slice(cheias)])
  }

  function ajustarLinha(l, delta) {
    if (l.tipo === 'avulso') return delta > 0 ? juntar(l.id) : tirar(l.id)
    if (l.tipo === 'extra') return delta > 0 ? juntarExtra(l.id) : tirarExtra(l.id)
    return undefined
  }

  function podeMaisLinha(l) {
    if (l.tipo === 'avulso') return livreSabor(findCookie(cardapio, l.id), picks) > 0
    if (l.tipo === 'extra') return livreExtra(cardapio, extras, l.id) > 0
    return false
  }

  function limpar() {
    setPicks([])
    setExtras({})
    setFechou(null)
    limparCarrinho()
  }

  async function enviar(form) {
    const resposta = await criarPedido({
      cliente: { nome: form.nome, telefone: form.telefone },
      ...payloadPedido(picks, extras, cardapio),
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

  const ultimo = lerUltimoPedido()
  const contacto = lerContacto()
  const telPedido = (ultimo?.referencia === pedidoRef ? ultimo.telefone : '') || contacto.telefone
  const poupanca = poupancaPorBox(cardapio)
  const comBandeja = !folhaAberta

  return (
    <div className="loja-body" data-bandeja={comBandeja}>
      <header className="loja-top">
        <div className="loja-wrap-largo py-2.5 flex items-center justify-between gap-4">
          <img className="loja-logo" src="/hero-crumb.png" alt="Crumb Lab" />
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
        </div>
      </header>

      <Menu
        cardapio={cardapio}
        picks={picks}
        extras={extras}
        poupancaBox={poupanca}
        onJuntar={juntar}
        onTirar={tirar}
        onJuntarExtra={juntarExtra}
        onTirarExtra={tirarExtra}
      />

      <footer className="loja-footer">
        <div className="loja-wrap text-center space-y-1">
          <img className="loja-logo loja-logo-on-dark mx-auto" src="/hero-crumb.png" alt="" />
          <p className="text-sm">cookies. coffee. repeat</p>
        </div>
      </footer>

      {comBandeja && (
        <Bandeja
          cardapio={cardapio}
          resumo={resumo}
          poupancaBox={poupanca}
          fechou={fechou}
          onAbrir={() => abrirPedido()}
          onAbrirCaixa={abrirPedido}
        />
      )}

      {aberto && !pedidoRef && (
        <Checkout
          cardapio={cardapio}
          resumo={resumo}
          poupancaBox={poupanca}
          caixaInicial={caixaAberta}
          onFechar={() => setAberto(false)}
          onTirarDaCaixa={tirarNaPosicao}
          onTirarCaixa={tirarCaixa}
          onRepetirCaixa={repetirCaixa}
          onPodeRepetirCaixa={podeRepetirCaixa}
          onAjustar={ajustarLinha}
          onPodeMais={podeMaisLinha}
          onEnviar={enviar}
        />
      )}

      {pedidoRef && (
        <Pedido
          referencia={pedidoRef}
          telefoneInicial={telPedido}
          recemCriado={recemCriado}
          nome={contacto.nome}
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
