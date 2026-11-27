import { useEffect, useMemo, useRef, useState } from 'react'
import { Menu } from './Menu'
import { Bandeja } from './Bandeja'
import { Checkout } from './Checkout'
import { Pedido } from './Sucesso'
import { Aviso } from './ui'
import { IconeBalao } from './icones'
import { linkWhatsApp } from './negocio'
import { criarPedido, criarPedidoBlack, fetchCardapio, isSupabaseConfigured } from './api'
import { Black, MontarCombo, BandejaBlack, AvisoEntregaBlack } from './Black'
import { RodapeLegal } from './RodapeLegal'
import {
  blackAtiva, blackAberta, lojaFechadaPelaBlack, lerSacoBlack, gravarSacoBlack, limparSacoBlack, resumoBlack, payloadBlack,
  taxaBlack, diasBlack,
} from './blackCrumb'
import {
  findCookie, livreSabor, livreExtra, contar, agrupar,
  resumoPedido, payloadPedido, clampEscolha, poupancaPorBox, arrumarEscolha, entraNaBox, hojeIso,
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

  // ── Black Crumb: aba própria enquanto a campanha estiver aberta ──────────
  /** 'black' | 'cookies' — null = ainda não escolhido (abre na Black Crumb se estiver ativa). */
  const [aba, setAba] = useState(null)
  const [sacoBlack, setSacoBlack] = useState(lerSacoBlack)
  const [montar, setMontar] = useState(null)
  const [abertoBlack, setAbertoBlack] = useState(false)

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
        setSacoBlack((s) => (blackAtiva(dados) ? limparSacoBlack(s, dados) : []))
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
    gravarSacoBlack(sacoBlack)
  }, [sacoBlack])

  useEffect(() => {
    const onPop = () => setPedidoRef(refDaUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Com uma folha aberta, a página por trás não rola.
  const folhaAberta = aberto || abertoBlack || Boolean(montar) || Boolean(pedidoRef)
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
    // os mais caros (ex.: Mini Cookies) ficam no fim e não contam para a Box
    const proximo = arrumarEscolha([...picks, id], cardapio)
    const size = cardapio.box.size
    const antes = agrupar(picks, cardapio)
    const depois = agrupar(proximo, cardapio)
    if (!entraNaBox(cardapio, id)) {
      toqueJuntar(size)
      setFechou(null)
      saltar(fotoEl)
      voar(fotoEl, document.querySelector('[data-alvo="total"]'))
      setPicks(proximo)
      return
    }
    const nNaBox = proximo.length - depois.fora.length
    if (depois.caixas.length > antes.caixas.length) {
      toqueBoxFechada()
      setFechou({ ids: depois.caixas[depois.caixas.length - 1].ids, n: nNaBox })
    } else {
      toqueJuntar(((nNaBox - 1) % size) + 1)
      setFechou(null)
    }
    saltar(fotoEl)
    voar(fotoEl, document.querySelector(`[data-slot="${(nNaBox - 1) % size}"]`))
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
    const nNaBox = picks.filter((x) => entraNaBox(cardapio, x)).length
    const cheias = Math.floor(nNaBox / size) * size
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
      entrega: entregaDe(form),
      cupom: form.cupom || undefined,
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
    } else if (resposta?.esgotado || resposta?.fim || ['local', 'entrega', 'morada'].includes(resposta?.campo)) {
      // stock ou locais mudaram desde que a página abriu, ou a loja fechou para uma campanha
      carregar()
    }
    return resposta
  }

  // ── Black Crumb ─────────────────────────────────────────────────────────
  function juntarCombo(combo) {
    setSacoBlack((s) => [...s, combo])
    setMontar(null)
  }
  const tirarCombo = (i) => {
    toqueTirar()
    setSacoBlack((s) => s.filter((_, k) => k !== i))
  }
  const repetirCombo = (i) => {
    toqueBoxFechada()
    setSacoBlack((s) => (s[i] ? [...s.slice(0, i + 1), { ...s[i], ids: [...s[i].ids] }, ...s.slice(i + 1)] : s))
  }

  async function enviarBlack(form) {
    const resposta = await criarPedidoBlack({
      cliente: { nome: form.nome, telefone: form.telefone },
      combos: payloadBlack(sacoBlack),
      entrega: entregaDe(form),
      notas: form.notas,
    })
    if (resposta?.ok) {
      toquePedidoFeito()
      gravarUltimoPedido({
        referencia: resposta.referencia,
        telefone: form.telefone,
        total: resposta.total,
        pagamento: 'MB WAY',
        campanha: 'black',
      })
      setAbertoBlack(false)
      setSacoBlack([])
      carregar()
      setRecemCriado(true)
      irParaPedido(resposta.referencia)
      setPedidoRef(resposta.referencia)
    } else if (resposta?.fim || ['local', 'entrega', 'morada', 'data'].includes(resposta?.campo)) {
      // a campanha acabou ou os dias/locais mudaram desde que a página abriu
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

  const temBlack = blackAtiva(cardapio)
  // durante a Black Crumb a loja normal fecha: só há a aba da campanha
  const soBlack = lojaFechadaPelaBlack(cardapio)
  const abaAtual = temBlack ? (soBlack ? 'black' : aba ?? 'black') : 'cookies'
  const podeBlack = blackAberta(cardapio)
  const resumoB = temBlack ? resumoBlack(sacoBlack, cardapio) : null
  const campanhaBlack = temBlack
    ? {
      id: 'black',
      pagamento: 'MB WAY',
      dias: diasBlack(cardapio.black, hojeIso()),
      taxa: (x) => taxaBlack(cardapio.black, x),
      avisoEntrega: <AvisoEntregaBlack black={cardapio.black} />,
      brinde: resumoB.brinde,
    }
    : null

  return (
    <div className="loja-body" data-bandeja={comBandeja}>
      <header className="loja-top">
        <div className="loja-wrap-largo py-2.5 flex items-center justify-between gap-4">
          <img className="loja-logo" src="/hero-crumb.png" alt="Crumb Lab" />
          <div className="flex items-center gap-4">
            {/* WhatsApp no topo: uma ligação discreta, no mesmo tom de "O meu pedido" */}
            <a
              className="topo-link topo-zap"
              href={linkWhatsApp('Olá! Tenho uma pergunta sobre os cookies.')}
              target="_blank"
              rel="noreferrer"
              aria-label="Dúvidas? Fala connosco no WhatsApp"
            >
              <IconeBalao size={17} />
              <span>Dúvidas?</span>
            </a>
            {(ultimo || pedidoRef) && (
              <button
                type="button"
                className="topo-link"
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
        </div>
        {temBlack && !soBlack && (
          <nav className="loja-wrap-largo loja-abas" aria-label="Secções da loja">
            <button
              type="button"
              className="loja-aba loja-aba-black"
              aria-pressed={abaAtual === 'black'}
              onClick={() => { setAba('black'); window.scrollTo({ top: 0 }) }}
            >
              {cardapio.black.nome || 'Black Crumb'}
            </button>
            <button
              type="button"
              className="loja-aba"
              aria-pressed={abaAtual === 'cookies'}
              onClick={() => { setAba('cookies'); window.scrollTo({ top: 0 }) }}
            >
              Cardápio
            </button>
          </nav>
        )}
      </header>

      {abaAtual === 'black' ? (
        <Black cardapio={cardapio} combos={sacoBlack} onMontar={setMontar} />
      ) : (
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
      )}

      <RodapeLegal legal={cardapio.legal} marca={cardapio.negocio?.nome?.trim() || 'Crumb Lab'} />

      {comBandeja && abaAtual === 'black' && (
        <BandejaBlack resumo={resumoB} aberta={podeBlack} onAbrir={() => setAbertoBlack(true)} />
      )}
      {comBandeja && abaAtual !== 'black' && (
        <Bandeja
          cardapio={cardapio}
          resumo={resumo}
          poupancaBox={poupanca}
          fechou={fechou}
          onAbrir={() => abrirPedido()}
          onAbrirCaixa={abrirPedido}
        />
      )}

      {montar && podeBlack && (
        <MontarCombo
          cardapio={cardapio}
          comboId={montar}
          onJuntar={juntarCombo}
          onFechar={() => setMontar(null)}
        />
      )}

      {abertoBlack && podeBlack && !pedidoRef && (
        <Checkout
          cardapio={cardapio}
          resumo={resumoB}
          poupancaBox={0}
          campanha={campanhaBlack}
          onFechar={() => setAbertoBlack(false)}
          onTirarDaCaixa={() => {}}
          onTirarCaixa={tirarCombo}
          onRepetirCaixa={repetirCombo}
          onPodeRepetirCaixa={() => true}
          onAjustar={() => {}}
          onPodeMais={() => false}
          onEnviar={enviarBlack}
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
          pagamento={ultimo?.referencia === pedidoRef ? ultimo.pagamento : ''}
          campanha={ultimo?.referencia === pedidoRef ? ultimo.campanha : ''}
          total={ultimo?.referencia === pedidoRef ? ultimo.total : 0}
          onNovo={fecharPedido}
        />
      )}
    </div>
  )
}

/** Levantar/entrega como o servidor o espera (lat/lng só na entrega, para a taxa por distância). */
function entregaDe(form) {
  return {
    tipo: form.tipo,
    data: form.data,
    hora: form.hora,
    local: form.tipo === 'levantar' ? form.local || undefined : undefined,
    morada: form.morada,
    localidade: form.localidade,
    cp: form.cp,
    lat: form.tipo === 'entrega' ? form.lat : undefined,
    lng: form.tipo === 'entrega' ? form.lng : undefined,
    // 'rua' ou 'localidade' (distância aproximada) — a dona vê isto em Vendas
    precisao: form.tipo === 'entrega' ? form.precisao : undefined,
  }
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
