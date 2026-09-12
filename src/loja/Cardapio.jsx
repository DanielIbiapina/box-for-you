import { Stepper, Secao } from './ui'
import { fmtEuro, disponivel } from './util'

/** Grelha de sabores — o coração da loja: escolher é a primeira coisa que se faz. */
export function Cardapio({ cardapio, cart, caixas, boxDraft, onMais, onMenos }) {
  const cookies = cardapio.cookies ?? []

  if (cookies.length === 0) {
    return (
      <Secao id="cardapio" titulo="Estamos a preparar o forno">
        <p className="text-sm ink-2">
          Neste momento não há sabores disponíveis. Volta daqui a pouco!
        </p>
      </Secao>
    )
  }

  return (
    <Secao
      id="cardapio"
      titulo="Os cookies"
      descricao="Todos feitos à mão, em pequenos lotes. Toca no cartão para juntar ao pedido."
    >
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
              <div className="cookie-face mb-2.5">
                {c.image
                  ? <img src={c.image} alt="" loading="lazy" />
                  : <span aria-hidden="true">{c.emoji || '🍪'}</span>}
                {qty > 0 && (
                  <span className="cookie-qty" aria-label={`${qty} no pedido`}>{qty}</span>
                )}
              </div>

              <h3 className="bfy-card-title text-sm leading-tight">{c.nome}</h3>

              <p className="text-xs ink-3 mt-0.5 mb-3 bfy-num">
                {fmtEuro(c.price)} / unidade
              </p>

              <div className="mt-auto">
                {esgotado ? (
                  <span className="badge-critico">Esgotado</span>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <Stepper
                      qty={qty}
                      label={c.nome}
                      onMenos={() => onMenos(c.id)}
                      onMais={() => onMais(c.id)}
                      podeMais={livre > 0}
                    />
                    {livre <= 3 && (
                      <span className="text-[11px] font-bold ink-3 whitespace-nowrap">
                        {livre === 0 ? 'é tudo o que há' : `só ${livre}`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </Secao>
  )
}
