import { Stepper } from './ui'
import { fmtEuro, disponivel } from './util'

/** Grelha de sabores. A foto é o produto; o resto é pequeno. */
export function Cardapio({ cardapio, cart, caixas, boxDraft, onMais, onMenos }) {
  const cookies = cardapio.cookies ?? []

  if (cookies.length === 0) {
    return (
      <section id="cardapio" className="loja-wrap loja-secao">
        <p className="text-sm ink-2">Neste momento não há sabores. Volta daqui a pouco.</p>
      </section>
    )
  }

  return (
    <section id="cardapio" className="loja-wrap loja-secao">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {cookies.map((c) => {
          const qty = cart[c.id] ?? 0
          const livre = disponivel(c, cart, caixas, boxDraft)
          const esgotado = (c.stock ?? 0) <= 0

          return (
            <article
              key={c.id}
              className="cookie-card"
              data-escolhido={qty > 0}
              data-esgotado={esgotado}
              onClick={() => { if (!esgotado && livre > 0) onMais(c.id) }}
            >
              <div className="cookie-face">
                {c.image
                  ? <img src={c.image} alt="" loading="lazy" />
                  : <span className="cookie-prato" aria-hidden="true" />}
                {qty > 0 && (
                  <span className="cookie-qty" aria-label={`${qty} no pedido`}>{qty}</span>
                )}
                {esgotado && <span className="cookie-esgotado">Esgotado</span>}
              </div>

              <div className="cookie-meta">
                <h3 className="cookie-nome">{c.nome}</h3>
                <p className="cookie-preco bfy-num">{fmtEuro(c.price)}</p>

                {!esgotado && qty > 0 && (
                  <div className="cookie-acoes">
                    <Stepper
                      qty={qty}
                      label={c.nome}
                      onMenos={() => onMenos(c.id)}
                      onMais={() => onMais(c.id)}
                      podeMais={livre > 0}
                    />
                    {livre <= 3 && (
                      <span className="text-[11px] font-bold ink-3 whitespace-nowrap">
                        {livre === 0 ? 'é tudo' : `só ${livre}`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
