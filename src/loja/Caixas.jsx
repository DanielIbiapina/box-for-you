import { Stepper, Secao } from './ui'
import {
  fmtEuro, disponivel, disponivelMini, disponivelTasting,
  contarCaixa, resumoCaixa, MINI_BOX_ID, TASTING_BOX_ID,
} from './util'

/**
 * Caixas: a Box montada pelo cliente (escolhe N sabores) e as duas caixas
 * prontas. A Box é o produto com mais margem — por isso vem primeiro e é a
 * única com um construtor visual.
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
    setDraft((d) => ({ ...d, [id]: (d[id] ?? 0) + 1 }))
  }

  function tirar(id) {
    setDraft((d) => ({ ...d, [id]: Math.max(0, (d[id] ?? 0) - 1) }))
  }

  function confirmar() {
    const counts = Object.fromEntries(Object.entries(draft).filter(([, q]) => q > 0))
    onAddCaixa(counts)
    setDraft(null)
  }

  const livreMini = disponivelMini(cardapio, cart)
  const livreTasting = disponivelTasting(cardapio, cart)

  return (
    <Secao
      id="caixas"
      eyebrow="Passo 2"
      titulo="Ou leva uma caixa"
      descricao="Sai mais em conta do que unidade a unidade — e dá um presente muito melhor."
    >
      {/* ── Box montada pelo cliente ───────────────────────────────────── */}
      <div className="bfy-card p-4 md:p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="bfy-title text-lg">📦 Box de {size}</h3>
            <p className="text-sm ink-2 mt-1">
              Escolhes os {size} sabores. Podes repetir o mesmo sabor.
            </p>
          </div>
          <p className="bfy-num font-black text-xl" style={{ color: 'var(--color-accent-dark)' }}>
            {fmtEuro(cardapio.box.price)}
          </p>
        </div>

        {/* caixas já montadas */}
        {caixas.length > 0 && (
          <ul className="mt-4 space-y-2">
            {caixas.map((counts, i) => (
              <li key={i} className="bfy-sunk px-3.5 py-2.5 flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">📦</span>
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

        {/* construtor */}
        {!draft ? (
          <button type="button" className="btn-accent mt-4" onClick={comecar} disabled={cookies.length === 0}>
            {caixas.length > 0 ? 'Montar outra caixa' : 'Montar a minha caixa'}
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
                    <span key={i} className="box-slot" data-cheio={Boolean(id)}>
                      {c ? (c.emoji || '🍪') : '·'}
                    </span>
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
                    <span aria-hidden="true">{c.emoji || '🍪'}</span>
                    {c.short || c.nome}
                    {n > 0 && <strong className="bfy-num">×{n}</strong>}
                  </button>
                )
              })}
            </div>

            {preenchidos > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(draft).filter(([, q]) => q > 0).map(([id, q]) => {
                  const c = cookies.find((x) => x.id === id)
                  return (
                    <button
                      key={id}
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => tirar(id)}
                    >
                      − {c?.short ?? id} ({q})
                    </button>
                  )
                })}
              </div>
            )}

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

      {/* ── Caixas prontas ─────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
        <CaixaPronta
          emoji="🎁"
          nome="Mini Box"
          descricao="Cookies mini sortidos, para provar sem compromisso."
          preco={cardapio.miniBox.price}
          qty={cart[MINI_BOX_ID] ?? 0}
          livre={livreMini}
          esgotado={(cardapio.miniBox.stock ?? 0) <= 0}
          onMais={() => onMais(MINI_BOX_ID)}
          onMenos={() => onMenos(MINI_BOX_ID)}
        />
        <CaixaPronta
          emoji="🥄"
          nome="Tasting Box"
          descricao={`Um mini cookie de 50g de cada um dos ${cardapio.tastingBox.sabores} sabores do momento.`}
          preco={cardapio.tastingBox.price}
          qty={cart[TASTING_BOX_ID] ?? 0}
          livre={livreTasting}
          esgotado={(cardapio.tastingBox.stock ?? 0) <= 0}
          onMais={() => onMais(TASTING_BOX_ID)}
          onMenos={() => onMenos(TASTING_BOX_ID)}
        />
      </div>
    </Secao>
  )
}

function CaixaPronta({ emoji, nome, descricao, preco, qty, livre, esgotado, onMais, onMenos }) {
  return (
    <article className="cookie-card !p-5" data-escolhido={qty > 0} data-esgotado={esgotado}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="bfy-title text-lg">
          <span aria-hidden="true">{emoji}</span> {nome}
        </h3>
        <p className="bfy-num font-black text-lg" style={{ color: 'var(--color-accent-dark)' }}>
          {fmtEuro(preco)}
        </p>
      </div>
      <p className="text-sm ink-2 mt-1.5 mb-4">{descricao}</p>
      <div className="mt-auto">
        {esgotado
          ? <span className="badge-critico">Esgotado</span>
          : <Stepper qty={qty} label={nome} onMenos={onMenos} onMais={onMais} podeMais={livre > 0} />}
      </div>
    </article>
  )
}
