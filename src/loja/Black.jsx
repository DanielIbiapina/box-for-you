import { useEffect, useRef, useState } from 'react'
import { fmtEuro, findCookie, precoNormal, vezes } from './util'
import { avisoEntregaBlack, comboDef, fmtDiaSemana, fmtPrazo, vantagemAntecipada } from './blackCrumb'
import { toqueJuntar, toqueTirar, toqueBoxFechada } from './sensacao'
import { saltar } from './voar'
import {
  IconeCalendario, IconeCookie, IconeMota, IconePresente, IconeSelos,
} from './icones'

/**
 * A aba da Black Crumb: os combos, as vantagens de encomendar já e o
 * construtor de cada combo. Os sabores estão todos sempre disponíveis.
 */
export function Black({ cardapio, combos, onMontar }) {
  const black = cardapio.black
  const normal = precoNormal(cardapio)
  const fotos = (cardapio.cookies ?? []).filter((c) => c.image).map((c) => c.image)
  const brinde = Number(black.brindePorCombo) || 0
  const prazo = fmtPrazo(black.antecipadoAte)
  const nDe = (id) => combos.filter((c) => c.combo === id).length
  const aberta = Boolean(black.aberta)
  const fimDeSemana = (black.diasNoDia ?? []).map(fmtDiaCurto).join(' e ')
  // os dias que se podem marcar agora (na pausa, os do fim de semana que aí vem)
  const diasAgora = aberta ? black.dias : (black.diasNoDia ?? [])
  const quando = black.fase === 'antecipado'
    ? `de ${fmtDiaCurto(black.dias[0])} a ${fmtDiaCurto(black.dias[black.dias.length - 1])}`
    : diasAgora.map((d) => fmtDiaSemana(d).split(',')[0]).join(' ou ')

  let aviso
  if (black.fase === 'antecipado') {
    aviso = (
      <div className="black-prazo" data-icones="true">
        <p className="black-prazo-titulo">Encomenda até {prazo}</p>
        <ul>
          <li><IconeCalendario size={18} />Recebe ou levanta de {fmtDiaCurto(black.dias[0])} a {fmtDiaCurto(black.dias[black.dias.length - 1])}</li>
          <li><IconeSelos size={18} />Selos a dobrar no teu cartão</li>
          {vantagemAntecipada(black) && <li><IconeMota size={18} />{vantagemAntecipada(black)}</li>}
        </ul>
      </div>
    )
  } else if (black.fase === 'pausa') {
    aviso = (
      <div className="black-prazo" data-fechado="true">
        <p className="black-prazo-titulo">Encomendas fechadas</p>
        <ul>
          <li>Estamos a preparar as encomendas. Voltamos a abrir {fmtDiaSemana(black.reabre)}.</li>
          {fimDeSemana && <li>Aí já só dá para receber ou levantar em {fimDeSemana}.</li>}
          <li>Já encomendaste? Está tudo certo, até já!</li>
        </ul>
      </div>
    )
  } else if (aberta) {
    aviso = (
      <div className="black-prazo">
        <p className="black-prazo-titulo">Ainda vais a tempo</p>
        <ul>
          <li>Encomendas para {black.dias.map(fmtDiaCurto).join(' e ')}</li>
        </ul>
      </div>
    )
  } else {
    aviso = (
      <div className="black-prazo" data-fechado="true">
        <p className="black-prazo-titulo">A Black Crumb terminou</p>
        <ul>
          <li>Obrigada a todos! A loja volta ao normal {fmtDiaSemana(black.fim)}.</li>
        </ul>
      </div>
    )
  }

  return (
    <main className="loja-menu">
      <section className="black-hero">
        <div className="loja-wrap-largo">
          <p className="black-kicker">Black Friday</p>
          <h1 className="black-titulo">{black.nome || 'Black Crumb'}</h1>
          <p className="black-sub">
            Combos de cookies a preço especial{brinde > 0 ? ` e ${brinde === 1 ? 'um mini cookie' : `${brinde} mini cookies`} de oferta em cada combo` : ''}.
          </p>
          {aviso}
        </div>
      </section>

      <section className="loja-wrap-largo pt-6" aria-labelledby="titulo-combos">
        <h2 id="titulo-combos" className="loja-h2">Os combos</h2>
        <p className="loja-h2-sub">Escolhes os sabores de cada cookie. Podes juntar vários combos.</p>
        <div className="black-combos">
          {black.combos.map((c) => {
            const antes = normal * c.cookies
            const n = nDe(c.id)
            return (
              <button
                key={c.id} type="button" className="black-combo" data-qty={n > 0}
                disabled={!aberta} onClick={() => onMontar(c.id)}
              >
                <span className="black-combo-fotos" data-n={Math.min(c.cookies, 6)} aria-hidden="true">
                  {Array.from({ length: Math.min(c.cookies, 6) }, (_, i) => fotos[(i * 3 + c.cookies) % Math.max(1, fotos.length)])
                    .map((src, i) => (src ? <img key={i} src={src} alt="" loading="lazy" draggable="false" /> : <span key={i} />))}
                </span>
                <span className="black-combo-txt">
                  <span className="black-combo-nome">{c.nome}</span>
                  <span className="black-combo-detalhe">
                    {c.cookies} cookies{brinde > 0 ? ` + ${brinde} mini de oferta, à tua escolha` : ''}
                    {c.gramas ? <><br />cerca de {c.gramas} g de cookies</> : null}
                  </span>
                  <span className="black-combo-precos">
                    <b className="bfy-num">{fmtEuro(c.preco)}</b>
                    {antes > Number(c.preco) && <s className="bfy-num">{fmtEuro(antes)}</s>}
                  </span>
                </span>
                <span className="black-combo-cta">{!aberta ? 'Fechado' : n > 0 ? `Mais um (${n})` : 'Montar'}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="loja-wrap-largo black-como" aria-labelledby="titulo-como">
        <h2 id="titulo-como" className="loja-h2">Como funciona</h2>
        <ol className="black-trilho">
          <li>
            <span className="black-num" aria-hidden="true">1</span>
            <div>
              <h3>Monta o combo</h3>
              <p>Escolhes o sabor de cada cookie{brinde > 0 ? ' e do mini de oferta' : ''}.</p>
            </div>
          </li>
          <li>
            <span className="black-num" aria-hidden="true">2</span>
            <div>
              <h3>Marca o dia</h3>
              <p>Recebes em casa ou levantas na nossa cozinha, {quando}.</p>
            </div>
          </li>
          <li>
            <span className="black-num" aria-hidden="true">3</span>
            <div>
              <h3>Pagas por MB WAY</h3>
              <p>Logo a seguir à encomenda. Confirmamos assim que o pagamento chegar.</p>
            </div>
          </li>
        </ol>
        <AvisoEntregaBlack black={black} />
      </section>
    </main>
  )
}

/**
 * O aviso de entrega da campanha, como um bilhete: a regra para todos e, se
 * ainda for encomenda antecipada, a vantagem extra. Na página e no checkout.
 */
export function AvisoEntregaBlack({ black }) {
  const { titulo, texto } = avisoEntregaBlack(black)
  if (!titulo && !texto) return null
  return (
    <div className="black-bilhete">
      <span className="black-bilhete-canhoto" aria-hidden="true"><IconeMota size={26} /></span>
      <div className="black-bilhete-txt">
        <p className="black-bilhete-kicker">Entregas na {black?.nome || 'Black Crumb'}</p>
        {titulo && <p className="black-bilhete-titulo">{titulo}</p>}
        {texto && <p className="black-bilhete-texto">{texto}</p>}
      </div>
    </div>
  )
}

function fmtDiaCurto(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '')
}

/**
 * Montar um combo em dois passos: primeiro os N cookies (todos os sabores à
 * escolha, sem limite de stock), depois o mini de oferta. Ao fechar os cookies
 * passa sozinho para o mini; as abas de cima deixam voltar a qualquer um.
 * Toca num espaço (ou no −) para tirar.
 */
export function MontarCombo({ cardapio, comboId, onJuntar, onFechar }) {
  const def = comboDef(cardapio.black, comboId)
  const brinde = Number(cardapio.black.brindePorCombo) || 0
  const [ids, setIds] = useState([])
  const [minis, setMinis] = useState([])
  const [modo, setModo] = useState('cookies')
  const titulo = useRef(null)
  const timer = useRef(null)
  const cheio = def ? ids.length >= def.cookies : false
  const faltam = def ? def.cookies - ids.length : 0
  const minisOk = minis.length >= brinde
  const pronto = cheio && minisOk

  useEffect(() => { titulo.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onFechar])

  if (!def) return null

  function juntar(id, el) {
    if (cheio) return
    const proximo = [...ids, id]
    saltar(el)
    setIds(proximo)
    if (proximo.length === def.cookies) {
      toqueBoxFechada()
      // deixa ver o último cookie pousar antes de passar ao mini
      if (brinde > 0 && !minisOk) timer.current = setTimeout(() => setModo('mini'), 450)
    } else {
      toqueJuntar(proximo.length)
    }
  }
  function tirarUm(id) {
    const i = ids.lastIndexOf(id)
    if (i < 0) return
    toqueTirar()
    setIds(ids.filter((_, k) => k !== i))
  }
  function tirarPos(i) {
    toqueTirar()
    setIds(ids.filter((_, k) => k !== i))
    setModo('cookies')
  }
  /** Com um só mini por combo, tocar noutro sabor troca-o. */
  function escolherMini(id, el) {
    saltar(el)
    toqueBoxFechada()
    setMinis((m) => (brinde === 1 ? [id] : m.length < brinde ? [...m, id] : m))
  }
  function tirarMini(id) {
    const i = minis.lastIndexOf(id)
    if (i < 0) return
    toqueTirar()
    setMinis(minis.filter((_, k) => k !== i))
  }

  let sub
  if (modo === 'mini') sub = minisOk ? 'Mini escolhido. Podes trocar.' : 'Agora o mini cookie de oferta (50 g)'
  else if (cheio) sub = brinde > 0 && !minisOk ? 'Cookies prontos. Falta o mini de oferta.' : 'Pronto!'
  else sub = `Escolhe ${faltam === def.cookies ? def.cookies : `mais ${faltam}`} ${faltam === 1 ? 'cookie' : 'cookies'}`

  let cta
  if (pronto) cta = `Juntar ao pedido · ${fmtEuro(def.preco)}`
  else if (!cheio) cta = `Faltam ${faltam} ${faltam === 1 ? 'cookie' : 'cookies'}`
  else cta = 'Escolhe o mini de oferta'

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="sheet checkout black-montar" role="dialog" aria-modal="true" aria-label={`Montar ${def.nome}`}>
        <header className="checkout-topo">
          <button type="button" className="btn-icon" onClick={onFechar} aria-label="Fechar">✕</button>
          <div className="black-montar-topo">
            <h2 ref={titulo} tabIndex={-1} className="black-montar-titulo">{def.nome}</h2>
            <p className="black-montar-sub">{sub} · {fmtEuro(def.preco)}</p>
          </div>
          <span className="w-9" aria-hidden="true" />
        </header>

        <div className="checkout-corpo">
          <div className="black-slots" role="list" aria-label="O teu combo">
            {Array.from({ length: def.cookies }, (_, i) => {
              const c = ids[i] ? findCookie(cardapio, ids[i]) : null
              return c ? (
                <button
                  key={`${i}-${c.id}`} type="button" role="listitem" className="black-slot" data-cheio="true"
                  onClick={() => tirarPos(i)} aria-label={`Tirar ${c.nome}`}
                >
                  {c.image ? <img src={c.image} alt="" draggable="false" /> : <IconeCookie size={26} />}
                </button>
              ) : <span key={`v${i}`} role="listitem" className="black-slot" aria-label="Espaço vazio" />
            })}
            {Array.from({ length: brinde }, (_, i) => {
              const c = minis[i] ? findCookie(cardapio, minis[i]) : null
              return (
                <button
                  key={`m${i}-${c?.id ?? 'vazio'}`} type="button" role="listitem"
                  className="black-slot black-slot-mini" data-cheio={Boolean(c)} data-ativo={modo === 'mini'}
                  onClick={() => setModo('mini')}
                  aria-label={c ? `Mini de oferta: ${c.nome}. Trocar` : 'Escolher o mini de oferta'}
                >
                  {c?.image ? <img src={c.image} alt="" draggable="false" /> : <IconePresente size={18} />}
                  <span className="black-slot-laco" aria-hidden="true" />
                </button>
              )
            })}
          </div>

          {brinde > 0 && (
            <div className="black-passos" role="tablist" aria-label="Passos do combo">
              <button type="button" role="tab" aria-selected={modo === 'cookies'} onClick={() => setModo('cookies')}>
                Cookies <b className="bfy-num">{ids.length}/{def.cookies}</b>
              </button>
              <button type="button" role="tab" aria-selected={modo === 'mini'} onClick={() => setModo('mini')}>
                Mini de oferta <b className="bfy-num">{Math.min(minis.length, brinde)}/{brinde}</b>
              </button>
            </div>
          )}

          <div className="cookie-grelha mt-4" data-modo={modo}>
            {(cardapio.cookies ?? []).map((c) => (modo === 'mini' ? (
              <Sabor
                key={c.id} cookie={c} qty={vezes(minis, c.id)} cheio={false} mini
                onJuntar={escolherMini} onTirar={tirarMini}
              />
            ) : (
              <Sabor key={c.id} cookie={c} qty={vezes(ids, c.id)} cheio={cheio} onJuntar={juntar} onTirar={tirarUm} />
            )))}
          </div>
        </div>

        <footer className="checkout-pe">
          <button
            type="button"
            className="btn-primary btn-block checkout-cta"
            disabled={!pronto}
            onClick={() => onJuntar({ combo: def.id, ids, minis: minis.slice(0, brinde) })}
          >
            {cta}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Sabor({ cookie, qty, cheio, mini = false, onJuntar, onTirar }) {
  const foto = useRef(null)
  return (
    <div className="cookie-card" data-qty={qty > 0} data-mini={mini}>
      <button
        type="button"
        className="cookie-toque"
        aria-disabled={cheio}
        aria-pressed={mini ? qty > 0 : undefined}
        onClick={() => onJuntar(cookie.id, foto.current)}
        aria-label={mini ? `Mini de oferta: ${cookie.nome}` : `Juntar ${cookie.nome}${qty ? `. Tens ${qty}.` : ''}`}
      >
        <span className="cookie-prato">
          {cookie.image
            ? <img ref={foto} className="cookie-foto" src={cookie.image} alt="" loading="lazy" draggable="false" />
            : <span ref={foto} className="cookie-emoji" aria-hidden="true"><IconeCookie size={56} /></span>}
          {qty > 0 && <span key={qty} className="cookie-qty" aria-hidden="true">{qty}</span>}
        </span>
        <span className="cookie-nome">{cookie.nome}</span>
        {mini && <span className="cookie-preco">mini 50 g</span>}
      </button>
      {qty > 0 && !mini && (
        <button type="button" className="cookie-menos" onClick={() => onTirar(cookie.id)} aria-label={`Remover um ${cookie.nome}`}>−</button>
      )}
    </div>
  )
}

/** A barra de baixo da Black Crumb: quantos combos, o brinde e o total. */
export function BandejaBlack({ resumo, aberta = true, onAbrir }) {
  const { nItens, total, brinde } = resumo
  let dica
  if (!aberta) dica = 'Encomendas fechadas por agora'
  else if (nItens === 0) dica = 'Escolhe um combo para começar'
  else dica = `${nItens} ${nItens === 1 ? 'combo' : 'combos'}${brinde > 0 ? ` · +${brinde} mini de oferta` : ''}`
  return (
    <div className="bandeja">
      <p key={dica} className="bandeja-dica" aria-live="polite">{dica}</p>
      <div className="bandeja-barra black-barra">
        <div className="bandeja-esq">
          <span className="black-barra-marca">Black Crumb</span>
        </div>
        <button type="button" className="bandeja-cta" disabled={!aberta || nItens === 0} onClick={onAbrir}>
          <span className="bandeja-cta-rotulo">Ver pedido</span>
          <span className="bandeja-cta-total bfy-num">{fmtEuro(total)}</span>
        </button>
      </div>
    </div>
  )
}
