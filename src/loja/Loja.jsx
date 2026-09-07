import { useEffect, useState } from 'react'
import { Cardapio } from './Cardapio'
import { Caixas } from './Caixas'
import { Checkout } from './Checkout'
import { Sucesso } from './Sucesso'
import { Aviso } from './ui'
import { criarPedido, fetchCardapio, isSupabaseConfigured } from './api'
import {
  fmtEuro, linhasCarrinho, totalCarrinho, totalItens,
  findCookie, disponivel, disponivelMini, disponivelTasting,
  MINI_BOX_ID, TASTING_BOX_ID,
} from './util'

export function Loja() {
  const [cardapio, setCardapio] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [recarga, setRecarga] = useState(0)

  const [cart, setCart] = useState({})
  const [caixas, setCaixas] = useState([])
  const [draft, setDraft] = useState(null)

  const [aberto, setAberto] = useState(false)
  const [sucesso, setSucesso] = useState(null)

  /** Pede o cardápio outra vez — depois de um pedido ou de um sabor esgotar. */
  const carregar = () => setRecarga((n) => n + 1)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let vivo = true
    fetchCardapio()
      .then((dados) => {
        if (!vivo) return
        setCardapio(dados)
        setErroCarga('')
      })
      .catch((e) => {
        console.error(e)
        if (vivo) setErroCarga('Não conseguimos carregar o cardápio agora. Tenta atualizar a página.')
      })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [recarga])

  // ── carrinho ──────────────────────────────────────────────────────────────
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

  function removerLinha(l) {
    if (l.tipo === 'caixa') setCaixas((cs) => cs.filter((_, i) => i !== l.indice))
    else setCart((c) => { const p = { ...c }; delete p[l.key]; return p })
  }

  function limpar() {
    setCart({})
    setCaixas([])
    setDraft(null)
  }

  // ── envio ────────────────────────────────────────────────────────────────
  async function enviar(form) {
    const resposta = await criarPedido({
      cliente: {
        nome: form.nome,
        telefone: form.telefone,
        instagram: form.instagram,
        email: form.email,
      },
      itens: Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([id, qty]) => ({ id, qty })),
      caixas,
      pagamento: form.pagamento,
      entrega: form.entrega,
      notas: form.notas,
    })

    if (resposta?.ok) {
      setSucesso({ ...resposta, pagamento: form.pagamento })
      setAberto(false)
      limpar()
      carregar()          // o stock mudou
    } else if (resposta?.esgotado) {
      carregar()          // mostra o stock real por baixo do painel
    }
    return resposta
  }

  // ── estados de carregamento ──────────────────────────────────────────────
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

  return (
    <div className="loja-body" style={{ paddingBottom: nItens > 0 ? '5.5rem' : 0 }}>
      <header className="loja-top">
        <div className="loja-wrap py-3 flex items-center justify-between gap-4">
          <p className="loja-brand text-xl">{cardapio.negocio.nome}</p>
          {nItens > 0 && (
            <button type="button" className="btn-accent btn-sm" onClick={() => setAberto(true)}>
              🛒 {nItens} · <span className="bfy-num">{fmtEuro(total)}</span>
            </button>
          )}
        </div>
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

      {nItens > 0 && !aberto && !sucesso && (
        <div className="loja-cartbar">
          <div className="loja-wrap flex items-center justify-between gap-4 !px-0 sm:!px-6">
            <div>
              <p className="text-xs" style={{ color: 'var(--ink-on-dark-2)' }}>
                {nItens} {nItens === 1 ? 'item' : 'itens'}
              </p>
              <p className="bfy-num font-black text-lg">{fmtEuro(total)}</p>
            </div>
            <button type="button" className="btn-accent px-6 py-3" onClick={() => setAberto(true)}>
              Ver pedido
            </button>
          </div>
        </div>
      )}

      {aberto && (
        <Checkout
          cardapio={cardapio}
          cart={cart}
          caixas={caixas}
          onFechar={() => setAberto(false)}
          onRemoverLinha={removerLinha}
          onEnviar={enviar}
        />
      )}

      {sucesso && (
        <Sucesso
          resultado={sucesso}
          pagamento={sucesso.pagamento}
          onNovo={() => setSucesso(null)}
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
      <div className="loja-wrap py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-5">
          <p className="bfy-chip bfy-chip-accent">🍪 Feitos à mão, todos os dias</p>
          <h1 className="loja-hero-title">
            Cookies que<br />valem a viagem.
          </h1>
          <p className="text-base md:text-lg ink-2 max-w-md">
            Escolhe os teus sabores, monta a tua caixa e faz o pedido em menos
            de um minuto. Nós tratamos do resto.
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
    ['Confirmamos', 'Ligamos ou mandamos mensagem para o teu telemóvel a acertar tudo.'],
    ['Combinamos', 'Pagas por MB WAY, Multibanco ou em dinheiro na entrega.'],
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
