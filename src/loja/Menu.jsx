import { useRef, useState } from 'react'
import { IconeBox } from './ui'
import {
  fmtEuro, livreSabor, livreExtra, vezes, precoExtra, MINI_BOX_ID, chaveMini50,
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
  // sabores com mini cookies de 50 g em stock (só os cookies normais têm versão mini)
  const mini50 = cookies.filter((c) => (c.stock50 ?? 0) > 0)

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

      <section className="loja-wrap-largo" aria-labelledby="titulo-cookies">
        <h2 id="titulo-cookies" className="loja-h2">Cookies</h2>
        {cardapio.negocio?.textoCookies && (
          <p className="loja-h2-sub">{cardapio.negocio.textoCookies}</p>
        )}
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

      {/* Mini cookies de 50 g: os mesmos sabores, stock próprio, um preço só. Sem preço, não aparecem. */}
      {(Number(cardapio.mini50?.price) || 0) > 0 && (
        <section className="loja-wrap-largo loja-mini50" aria-labelledby="titulo-mini50">
          <h2 id="titulo-mini50" className="loja-h2">Mini cookies</h2>
          <p className="loja-h2-sub">{cardapio.mini50?.descricao || 'Os mesmos sabores, em tamanho mini: 50 g cada.'}</p>
          {mini50.length === 0 ? (
            <p className="text-sm ink-2 py-2">Neste momento não há mini cookies. Volta daqui a pouco.</p>
          ) : (
            <div className="cookie-grelha">
              {mini50.map((c) => {
                const chave = chaveMini50(c.id)
                return (
                  <CookieCard
                    key={chave}
                    cookie={{ ...c, id: chave, nome: `${c.nome} · 50 g`, price: cardapio.mini50.price, stock: c.stock50 }}
                    qty={extras[chave] ?? 0}
                    livre={livreExtra(cardapio, extras, chave)}
                    onJuntar={onJuntarExtra}
                    onTirar={onTirarExtra}
                  />
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* A Tasting Box foi extinta. Sem preço (0 €), a Mini Box também não aparece. */}
      {precoExtra(cardapio, MINI_BOX_ID) > 0 && (
      <section className="loja-wrap-largo loja-especiais" aria-labelledby="titulo-especiais">
        <h2 id="titulo-especiais" className="loja-h2">Caixas especiais</h2>
        <div className="especiais-grelha">
          {precoExtra(cardapio, MINI_BOX_ID) > 0 && (
          <Especial
            id={MINI_BOX_ID}
            titulo="Mini Box"
            texto={cardapio.miniBox.descricao || '5 mini cookies sortidos de 25 g. Os sabores são surpresa.'}
            preco={precoExtra(cardapio, MINI_BOX_ID)}
            fotos={fotos.slice(0, 4)}
            mosaico="mini"
            qty={extras[MINI_BOX_ID] ?? 0}
            livre={livreExtra(cardapio, extras, MINI_BOX_ID)}
            esgotado={(cardapio.miniBox.stock ?? 0) <= 0}
            onJuntar={onJuntarExtra}
            onTirar={onTirarExtra}
          />
          )}
        </div>
      </section>
      )}
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
  else if (pouco) etiqueta = <span className="cookie-tag">{livre === 1 ? 'Resta 1' : `Restam ${livre}`}</span>

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
          aria-label={`Remover um ${cookie.nome}`}
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
          aria-label={`Remover uma ${titulo}`}
        >−</button>
      )}
    </div>
  )
}
