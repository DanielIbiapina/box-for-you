import { Stepper } from './ui'
import { toqueJuntar } from './sensacao'
import {
  fmtEuro, disponivel, disponivelMini, disponivelTasting,
  contarCaixa, resumoCaixa, MINI_BOX_ID, TASTING_BOX_ID,
} from './util'

/**
 * Caixas: a Box montada pelo cliente e as duas caixas prontas.
 */
export function Caixas({
  cardapio, cart, caixas, draft, setDraft,
  onAddCaixa, onRemoveCaixa, onMais, onMenos,
}) {
  const size = cardapio.box.size
  const cookies = cardapio.cookies ?? []
  const preenchidos = draft ? contarCaixa(draft) : 0
  const completa = preenchidos === size

  function comecar() {
    setDraft(Object.fromEntries(cookies.map((c) => [c.id, 0])))
  }

  function juntar(id) {
    toqueJuntar()
    setDraft((d) => ({ ...d, [id]: (d[id] ?? 0) + 1 }))
  }

  function tirar(id) {
    setDraft((d) => ({ ...d, [id]: Math.max(0, (d[id] ?? 0) - 1) }))
  }

  function tirarDoSlot(index) {
    const escolhidos = Object.entries(draft).flatMap(([id, q]) =>
      Array.from({ length: q }, () => id))
    const id = escolhidos[index]
    if (id) tirar(id)
  }

  function confirmar() {
    const counts = Object.fromEntries(Object.entries(draft).filter(([, q]) => q > 0))
    onAddCaixa(counts)
    setDraft(null)
  }

  const livreMini = disponivelMini(cardapio, cart)
  const livreTasting = disponivelTasting(cardapio, cart)

  return (
    <>
      <section id="box" className="loja-wrap loja-secao">
        <div className="bfy-card p-4 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="loja-section-title">Box de {size}</h2>
              <p className="text-sm ink-2 mt-1">Escolhe {size}. Podes repetir.</p>
            </div>
            <p className="bfy-num font-black text-xl" style={{ color: 'var(--color-accent-dark)' }}>
              {fmtEuro(cardapio.box.price)}
            </p>
          </div>

          {caixas.length > 0 && (
            <ul className="mt-4 space-y-2">
              {caixas.map((counts, i) => (
                <li key={i} className="bfy-sunk px-3.5 py-2.5 flex items-center gap-3">
                  <MiniFotos counts={counts} cookies={cookies} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold ink-1">Box de {size}</p>
                    <p className="text-xs ink-3 truncate">{resumoCaixa(counts, cardapio)}</p>
                  </div>
                  <span className="bfy-num text-sm font-bold ink-2">{fmtEuro(cardapio.box.price)}</span>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => onRemoveCaixa(i)}
                  >Tirar</button>
                </li>
              ))}
            </ul>
          )}

          {!draft ? (
            <button type="button" className="btn-accent mt-4" onClick={comecar} disabled={cookies.length === 0}>
              {caixas.length > 0 ? 'Montar outra' : 'Montar a minha'}
            </button>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="box-slots" aria-label={`${preenchidos} de ${size} escolhidos`}>
                  {Array.from({ length: size }).map((_, i) => {
                    const escolhidos = Object.entries(draft).flatMap(([id, q]) =>
                      Array.from({ length: q }, () => id))
                    const id = escolhidos[i]
                    const c = cookies.find((x) => x.id === id)
                    return (
                      <button
                        key={i}
                        type="button"
                        className="box-slot"
                        data-cheio={Boolean(id)}
                        onClick={() => tirarDoSlot(i)}
                        disabled={!id}
                        aria-label={c ? `Tirar ${c.nome}` : `Ranhura ${i + 1} vazia`}
                      >
                        {c?.image
                          ? <img src={c.image} alt="" />
                          : c
                            ? <span className="cookie-prato cookie-prato-mini" />
                            : null}
                      </button>
                    )
                  })}
                </div>
                <p className="text-sm font-bold ink-2 bfy-num">{preenchidos}/{size}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {cookies.map((c) => {
                  const n = draft[c.id] ?? 0
                  const livre = disponivel(c, cart, caixas, draft)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="chip-sabor"
                      data-ativo={n > 0}
                      disabled={completa || livre <= 0}
                      onClick={() => juntar(c.id)}
                      title={livre <= 0 ? 'Sem stock' : `Juntar ${c.nome}`}
                    >
                      {c.image
                        ? <img className="chip-foto" src={c.image} alt="" />
                        : <span className="cookie-prato cookie-prato-chip" />}
                      {c.short || c.nome}
                      {n > 0 && <strong className="bfy-num">×{n}</strong>}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" className="btn-primary" disabled={!completa} onClick={confirmar}>
                  {completa
                    ? `Juntar caixa · ${fmtEuro(cardapio.box.price)}`
                    : `Faltam ${size - preenchidos}`}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="loja-wrap pb-9 md:pb-12 grid sm:grid-cols-2 gap-3 md:gap-4">
        <CaixaPronta
          id="mini"
          nome="Mini Box"
          descricao="Cookies mini sortidos."
          preco={cardapio.miniBox.price}
          qty={cart[MINI_BOX_ID] ?? 0}
          livre={livreMini}
          esgotado={(cardapio.miniBox.stock ?? 0) <= 0}
          onMais={() => onMais(MINI_BOX_ID)}
          onMenos={() => onMenos(MINI_BOX_ID)}
        />
        <CaixaPronta
          id="tasting"
          nome="Tasting Box"
          descricao={`Um mini de 50g de cada um dos ${cardapio.tastingBox.sabores} sabores.`}
          preco={cardapio.tastingBox.price}
          qty={cart[TASTING_BOX_ID] ?? 0}
          livre={livreTasting}
          esgotado={(cardapio.tastingBox.stock ?? 0) <= 0}
          onMais={() => onMais(TASTING_BOX_ID)}
          onMenos={() => onMenos(TASTING_BOX_ID)}
        />
      </div>
    </>
  )
}

function MiniFotos({ counts, cookies }) {
  const fotos = Object.entries(counts)
    .filter(([, q]) => q > 0)
    .flatMap(([id, q]) => Array.from({ length: q }, () => cookies.find((c) => c.id === id)))
    .filter(Boolean)
    .slice(0, 4)
  return (
    <span className="mini-fotos" aria-hidden="true">
      {fotos.map((c, i) => (
        <span key={`${c.id}-${i}`} className="mini-foto">
          {c.image ? <img src={c.image} alt="" /> : <span className="cookie-prato cookie-prato-mini" />}
        </span>
      ))}
    </span>
  )
}

function CaixaPronta({ id, nome, descricao, preco, qty, livre, esgotado, onMais, onMenos }) {
  return (
    <article
      id={id}
      className="cookie-card cookie-card-caixa"
      data-escolhido={qty > 0}
      data-esgotado={esgotado}
      onClick={() => { if (!esgotado && livre > 0) onMais() }}
    >
      <div className="cookie-face cookie-face-caixa">
        <span className="cookie-prato" aria-hidden="true" />
        {qty > 0 && (
          <span className="cookie-qty" aria-label={`${qty} no pedido`}>{qty}</span>
        )}
        {esgotado && <span className="cookie-esgotado">Esgotado</span>}
      </div>
      <div className="cookie-meta">
        <h3 className="cookie-nome">{nome}</h3>
        <p className="text-sm ink-2 mt-0.5">{descricao}</p>
        <p className="cookie-preco bfy-num mt-2">{fmtEuro(preco)}</p>
        {!esgotado && qty > 0 && (
          <div className="cookie-acoes">
            <Stepper qty={qty} label={nome} onMenos={onMenos} onMais={onMais} podeMais={livre > 0} />
          </div>
        )}
      </div>
    </article>
  )
}
