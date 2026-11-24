import { useEffect, useRef, useState } from 'react'
import { fmtEuro, findCookie, precoNormal, vezes } from './util'
import { comboDef, fmtDiaSemana, fmtPrazo, regrasEntregaBlack, vantagemAntecipada } from './blackCrumb'
import { toqueJuntar, toqueTirar, toqueBoxFechada } from './sensacao'
import { saltar } from './voar'
import {
  IconeCalendario, IconeCookie, IconeMota, IconePresente, IconeSaco, IconeSelos, IconeTelemovel,
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
                    {c.cookies} cookies{brinde > 0 ? ` + ${brinde} mini cookie de oferta` : ''}
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

      <section className="loja-wrap-largo black-regras" aria-labelledby="titulo-regras">
        <h2 id="titulo-regras" className="loja-h2">Como funciona</h2>
        <ul>
          <li><IconeTelemovel size={20} /><span>Pagas por MB WAY no momento da encomenda. Confirmamos assim que o pagamento chegar.</span></li>
          {regrasEntregaBlack(black).map((t, i) => (
            <li key={t}>{i === 0 ? <IconeSaco size={20} /> : <IconeMota size={20} />}<span>{t}</span></li>
          ))}
          {brinde > 0 && <li><IconePresente size={20} /><span>O mini cookie de oferta (50 g) é de sabor surpresa.</span></li>}
        </ul>
      </section>
    </main>
  )
}

function fmtDiaCurto(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '')
}

/**
 * Montar um combo: N espaços, todos os sabores à escolha (sem limite de stock).
 * Toca para juntar; toca num espaço (ou no −) para tirar.
 */
export function MontarCombo({ cardapio, comboId, onJuntar, onFechar }) {
  const def = comboDef(cardapio.black, comboId)
  const [ids, setIds] = useState([])
  const titulo = useRef(null)
  const cheio = def ? ids.length >= def.cookies : false
  const faltam = def ? def.cookies - ids.length : 0
  const brinde = Number(cardapio.black.brindePorCombo) || 0

  useEffect(() => { titulo.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onFechar])

  if (!def) return null

  function juntar(id, el) {
    if (cheio) return
    const proximo = [...ids, id]
    if (proximo.length === def.cookies) toqueBoxFechada()
    else toqueJuntar(proximo.length)
    saltar(el)
    setIds(proximo)
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
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="sheet checkout black-montar" role="dialog" aria-modal="true" aria-label={`Montar ${def.nome}`}>
        <header className="checkout-topo">
          <button type="button" className="btn-icon" onClick={onFechar} aria-label="Fechar">✕</button>
          <div className="black-montar-topo">
            <h2 ref={titulo} tabIndex={-1} className="black-montar-titulo">{def.nome}</h2>
            <p className="black-montar-sub">
              {cheio ? 'Pronto!' : `Escolhe ${faltam === def.cookies ? def.cookies : `mais ${faltam}`} ${faltam === 1 ? 'cookie' : 'cookies'}`}
              {' · '}{fmtEuro(def.preco)}
            </p>
          </div>
          <span className="w-9" aria-hidden="true" />
        </header>

        <div className="checkout-corpo">
          <div className="black-slots" role="list" aria-label="Cookies do combo">
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
            {brinde > 0 && (
              <span className="black-slot black-slot-brinde" role="listitem" title="Mini cookie de oferta" aria-label="Mini cookie de oferta">
                <IconePresente size={22} />
              </span>
            )}
          </div>

          <div className="cookie-grelha mt-4">
            {(cardapio.cookies ?? []).map((c) => (
              <Sabor key={c.id} cookie={c} qty={vezes(ids, c.id)} cheio={cheio} onJuntar={juntar} onTirar={tirarUm} />
            ))}
          </div>
        </div>

        <footer className="checkout-pe">
          <button
            type="button"
            className="btn-primary btn-block checkout-cta"
            disabled={!cheio}
            onClick={() => onJuntar({ combo: def.id, ids })}
          >
            {cheio ? `Juntar ao pedido · ${fmtEuro(def.preco)}` : `Faltam ${faltam}`}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Sabor({ cookie, qty, cheio, onJuntar, onTirar }) {
  const foto = useRef(null)
  return (
    <div className="cookie-card" data-qty={qty > 0}>
      <button
        type="button"
        className="cookie-toque"
        aria-disabled={cheio}
        onClick={() => onJuntar(cookie.id, foto.current)}
        aria-label={`Juntar ${cookie.nome}${qty ? `. Tens ${qty}.` : ''}`}
      >
        <span className="cookie-prato">
          {cookie.image
            ? <img ref={foto} className="cookie-foto" src={cookie.image} alt="" loading="lazy" draggable="false" />
            : <span ref={foto} className="cookie-emoji" aria-hidden="true"><IconeCookie size={56} /></span>}
          {qty > 0 && <span key={qty} className="cookie-qty" aria-hidden="true">{qty}</span>}
        </span>
        <span className="cookie-nome">{cookie.nome}</span>
      </button>
      {qty > 0 && (
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
