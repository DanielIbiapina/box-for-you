import { useRef, useState } from 'react'
import { IconeBox } from './ui'
import {
  fmtEuro, livreSabor, livreExtra, vezes, precoExtra, MINI_BOX_ID, TASTING_BOX_ID,
} from './util'

function saudacao() {
  const h = new Date().getHours()
  if (h >= 6 && h < 13) return 'Bom dia'
  if (h >= 13 && h < 20) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Os cookies são a montra: fotos grandes, um toque junta. Não há "Box ou
 * avulso" para decidir à entrada — a cada 4 a Box fecha sozinha (ver util.agrupar).
 */
export function Menu({ cardapio, picks, extras, poupancaBox, onJuntar, onTirar, onJuntarExtra, onTirarExtra }) {
  const [ola] = useState(saudacao)
  const size = cardapio.box.size
  const cookies = [...(cardapio.cookies ?? [])]
    .sort((a, b) => Number((a.stock ?? 0) <= 0) - Number((b.stock ?? 0) <= 0))
  const fotos = cookies.filter((c) => c.image).map((c) => c.image)

  return (
    <main className="loja-menu">
      <section className="loja-wrap-largo loja-ola">
        <p className="loja-ola-oi">{ola}!</p>
        <h1 className="loja-ola-titulo">O que te apetece hoje?</h1>
        {poupancaBox > 0 && (
          <p className="loja-ola-regra">
            <span className="loja-ola-regra-icone"><IconeBox size={17} /></span>
            <span>A cada {size} cookies fechamos uma Box e <b>poupas {fmtEuro(poupancaBox)}</b></span>
          </p>
        )}
      </section>

      <section className="loja-wrap-largo" aria-label="Cookies">
        {cookies.length === 0 ? (
          <p className="text-sm ink-2 py-8">Neste momento não há cookies. Volta daqui a pouco.</p>
        ) : (
          <div className="cookie-grelha">
            {cookies.map((c) => (
              <CookieCard
                key={c.id}
                cookie={c}
                qty={vezes(picks, c.id)}
                livre={livreSabor(c, picks)}
                onJuntar={onJuntar}
                onTirar={onTirar}
              />
            ))}
          </div>
        )}
      </section>

      <section className="loja-wrap-largo loja-especiais" aria-labelledby="titulo-especiais">
        <h2 id="titulo-especiais" className="loja-h2">Caixas especiais</h2>
        <div className="especiais-grelha">
          <Especial
            id={TASTING_BOX_ID}
            titulo="Tasting Box"
            texto={`Um mini de cada um dos ${cardapio.tastingBox.sabores} sabores. Para quem não se decide.`}
            preco={precoExtra(cardapio, TASTING_BOX_ID)}
            fotos={fotos.slice(0, 9)}
            mosaico="tasting"
            qty={extras[TASTING_BOX_ID] ?? 0}
            livre={livreExtra(cardapio, extras, TASTING_BOX_ID)}
            esgotado={(cardapio.tastingBox.stock ?? 0) <= 0}
            onJuntar={onJuntarExtra}
            onTirar={onTirarExtra}
          />
          <Especial
            id={MINI_BOX_ID}
            titulo="Mini Box"
            texto="Cookies mini sortidos, para petiscar."
            preco={precoExtra(cardapio, MINI_BOX_ID)}
            fotos={fotos.slice(0, 4)}
            mosaico="mini"
            qty={extras[MINI_BOX_ID] ?? 0}
            livre={livreExtra(cardapio, extras, MINI_BOX_ID)}
            esgotado={(cardapio.miniBox.stock ?? 0) <= 0}
            onJuntar={onJuntarExtra}
            onTirar={onTirarExtra}
          />
        </div>
      </section>
    </main>
  )
}

function CookieCard({ cookie, qty, livre, onJuntar, onTirar }) {
  const foto = useRef(null)
  const card = useRef(null)
  const esgotado = (cookie.stock ?? 0) <= 0
  const pouco = !esgotado && livre > 0 && livre <= 3

  let etiqueta = null
  if (esgotado) etiqueta = <span className="cookie-tag cookie-tag-fim">Esgotado</span>
  else if (livre === 0) etiqueta = <span className="cookie-tag">Levas os últimos</span>
  else if (pouco) etiqueta = <span className="cookie-tag">{livre === 1 ? 'Só 1!' : `Só ${livre}`}</span>

  return (
    <div className="cookie-card" data-qty={qty > 0} data-esgotado={esgotado} ref={card}>
      <button
        type="button"
        className="cookie-toque"
        disabled={esgotado}
        onClick={() => onJuntar(cookie.id, foto.current, card.current)}
        aria-label={`Juntar ${cookie.nome}, ${fmtEuro(cookie.price)}${qty ? `. Tens ${qty}.` : ''}`}
      >
        <span className="cookie-prato">
          {cookie.image
            ? <img ref={foto} className="cookie-foto" src={cookie.image} alt="" loading="lazy" draggable="false" />
            : <span ref={foto} className="cookie-emoji" aria-hidden="true">{cookie.emoji || '🍪'}</span>}
          {etiqueta}
          {qty > 0 && <span key={qty} className="cookie-qty" aria-hidden="true">{qty}</span>}
        </span>
        <span className="cookie-nome">{cookie.nome}</span>
        <span className="cookie-preco bfy-num">{fmtEuro(cookie.price)}</span>
      </button>
      {qty > 0 && (
        <button
          type="button"
          className="cookie-menos"
          onClick={() => onTirar(cookie.id)}
          aria-label={`Tirar um ${cookie.nome}`}
        >−</button>
      )}
    </div>
  )
}

function Especial({ id, titulo, texto, preco, fotos, mosaico, qty, livre, esgotado, onJuntar, onTirar }) {
  const foto = useRef(null)
  const card = useRef(null)
  return (
    <div className="especial" data-qty={qty > 0} data-esgotado={esgotado} ref={card}>
      <button
        type="button"
        className="especial-toque"
        disabled={esgotado}
        onClick={() => onJuntar(id, foto.current, card.current)}
        aria-label={`Juntar ${titulo}, ${fmtEuro(preco)}${qty ? `. Tens ${qty}.` : ''}`}
      >
        <span ref={foto} className="especial-mosaico" data-tipo={mosaico} aria-hidden="true">
          {fotos.map((src, i) => <img key={i} src={src} alt="" loading="lazy" draggable="false" />)}
        </span>
        <span className="especial-txt">
          <span className="especial-nome">{titulo}</span>
          <span className="especial-detalhe">{texto}</span>
          <span className="especial-preco bfy-num">
            {esgotado ? 'Esgotado hoje' : livre === 0 ? 'Levas a última' : fmtEuro(preco)}
          </span>
        </span>
        {qty > 0 && <span key={qty} className="cookie-qty especial-qty" aria-hidden="true">{qty}</span>}
      </button>
      {qty > 0 && (
        <button
          type="button"
          className="cookie-menos especial-menos"
          onClick={() => onTirar(id)}
          aria-label={`Tirar uma ${titulo}`}
        >−</button>
      )}
    </div>
  )
}
