import { useState } from 'react'
import { BotaoMais, Foto, Stepper } from './ui'
import {
  fmtEuro, disponivel, disponivelMini, disponivelTasting,
  contarCaixa, resumoCaixa, MINI_BOX_ID, TASTING_BOX_ID,
} from './util'
import { toqueJuntar } from './sensacao'

const TABS = [
  { id: 'box', label: 'Box' },
  { id: 'prontas', label: 'Prontas' },
  { id: 'sabores', label: 'Sabores' },
]

function vazio(cookies) {
  return Object.fromEntries(cookies.map((c) => [c.id, 0]))
}

/**
 * Um menu, três sítios. A Box é o pedido; Mini/Tasting vêm prontas;
 * sabores avulsos são o desvio, não o caminho principal.
 */
export function Menu({
  cardapio, cart, caixas, draft, setDraft,
  onAddCaixa, onRemoveCaixa, onMais, onMenos, temSaco,
}) {
  const [tab, setTab] = useState('box')
  const cookies = cardapio.cookies ?? []
  const size = cardapio.box.size
  const preenchidos = draft ? contarCaixa(draft) : 0
  const completa = preenchidos === size

  function juntarSabor(id) {
    const c = cookies.find((x) => x.id === id)
    if (!c || preenchidos >= size) return
    if (disponivel(c, cart, caixas, draft) <= 0) return
    toqueJuntar()
    setDraft((d) => {
      const base = d ?? vazio(cookies)
      return { ...base, [id]: (base[id] ?? 0) + 1 }
    })
  }

  function tirarSabor(id) {
    setDraft((d) => {
      if (!d) return d
      const next = { ...d, [id]: Math.max(0, (d[id] ?? 0) - 1) }
      return contarCaixa(next) === 0 ? null : next
    })
  }

  function confirmarBox() {
    if (!draft || !completa) return
    onAddCaixa(Object.fromEntries(Object.entries(draft).filter(([, q]) => q > 0)))
    setDraft(null)
  }

  return (
    <>
      <nav className="loja-tabs" aria-label="O que queres levar">
        <div className="loja-wrap loja-tabs-row">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="loja-tab"
              data-ativo={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="loja-wrap loja-secao">
        {tab === 'box' && (
          <Box
            cardapio={cardapio}
            cookies={cookies}
            cart={cart}
            caixas={caixas}
            draft={draft}
            size={size}
            preenchidos={preenchidos}
            completa={completa}
            temSaco={temSaco}
            onJuntarSabor={juntarSabor}
            onTirarSabor={tirarSabor}
            onConfirmar={confirmarBox}
            onRemoveCaixa={onRemoveCaixa}
          />
        )}

        {tab === 'prontas' && (
          <div className="menu-lista">
            <LinhaProduto
              nome="Mini Box"
              detalhe="Cookies mini sortidos."
              image=""
              preco={cardapio.miniBox.price}
              qty={cart[MINI_BOX_ID] ?? 0}
              livre={disponivelMini(cardapio, cart)}
              esgotado={(cardapio.miniBox.stock ?? 0) <= 0}
              onMais={() => onMais(MINI_BOX_ID)}
              onMenos={() => onMenos(MINI_BOX_ID)}
            />
            <LinhaProduto
              nome="Tasting Box"
              detalhe={`Um mini de 50g de cada um dos ${cardapio.tastingBox.sabores} sabores.`}
              image=""
              preco={cardapio.tastingBox.price}
              qty={cart[TASTING_BOX_ID] ?? 0}
              livre={disponivelTasting(cardapio, cart)}
              esgotado={(cardapio.tastingBox.stock ?? 0) <= 0}
              onMais={() => onMais(TASTING_BOX_ID)}
              onMenos={() => onMenos(TASTING_BOX_ID)}
            />
          </div>
        )}

        {tab === 'sabores' && (
          cookies.length === 0
            ? <p className="text-sm ink-2">Neste momento não há sabores. Volta daqui a pouco.</p>
            : (
              <div className="menu-lista">
                {cookies.map((c) => {
                  const qty = cart[c.id] ?? 0
                  const livre = disponivel(c, cart, caixas, draft)
                  return (
                    <LinhaProduto
                      key={c.id}
                      nome={c.nome}
                      image={c.image}
                      preco={c.price}
                      qty={qty}
                      livre={livre}
                      esgotado={(c.stock ?? 0) <= 0}
                      onMais={() => onMais(c.id)}
                      onMenos={() => onMenos(c.id)}
                    />
                  )
                })}
              </div>
            )
        )}
      </div>
    </>
  )
}

function Box({
  cardapio, cookies, cart, caixas, draft, size, preenchidos, completa,
  temSaco, onJuntarSabor, onTirarSabor, onConfirmar, onRemoveCaixa,
}) {
  if (cookies.length === 0) {
    return <p className="text-sm ink-2">Neste momento não há sabores. Volta daqui a pouco.</p>
  }

  return (
    <div className="box-montar">
      <header className="box-cabeca">
        <div>
          <h1 className="loja-section-title">Box de {size}</h1>
          <p className="text-sm ink-2 mt-1">Escolhe {size}. Podes repetir.</p>
        </div>
        <p className="bfy-num font-black text-xl" style={{ color: 'var(--color-accent-dark)' }}>
          {fmtEuro(cardapio.box.price)}
        </p>
      </header>

      {caixas.length > 0 && (
        <ul className="menu-lista box-feitas">
          {caixas.map((counts, i) => (
            <li key={i} className="menu-linha menu-linha-feita">
              <MiniFotos counts={counts} cookies={cookies} />
              <div className="menu-linha-txt">
                <p className="menu-nome">Box de {size}</p>
                <p className="menu-detalhe">{resumoCaixa(counts, cardapio)}</p>
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => onRemoveCaixa(i)}>
                Tirar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="menu-lista">
        {cookies.map((c) => {
          const qty = draft?.[c.id] ?? 0
          const livre = disponivel(c, cart, caixas, draft)
          const esgotado = (c.stock ?? 0) <= 0
          return (
            <article key={c.id} className="menu-linha" data-esgotado={esgotado}>
              <Foto src={c.image} />
              <div className="menu-linha-txt">
                <h2 className="menu-nome">{c.nome}</h2>
                {esgotado && <p className="menu-detalhe">Esgotado</p>}
                {!esgotado && livre <= 3 && livre > 0 && qty === 0 && (
                  <p className="menu-detalhe">só {livre}</p>
                )}
              </div>
              {esgotado ? (
                <span className="menu-esgotado">Esgotado</span>
              ) : (
                <Stepper
                  qty={qty}
                  label={c.nome}
                  onMenos={() => onTirarSabor(c.id)}
                  onMais={() => onJuntarSabor(c.id)}
                  podeMais={!completa && livre > 0}
                />
              )}
            </article>
          )
        })}
      </div>

      <div
        className="box-cta"
        style={{ bottom: temSaco ? '5.25rem' : '0.5rem' }}
      >
        <p className="bfy-num font-bold ink-2">{preenchidos}/{size}</p>
        <button
          type="button"
          className="btn-primary flex-1 py-3"
          disabled={!completa}
          onClick={onConfirmar}
        >
          {completa
            ? `Juntar Box · ${fmtEuro(cardapio.box.price)}`
            : `Faltam ${size - preenchidos}`}
        </button>
      </div>
    </div>
  )
}

function LinhaProduto({ image, nome, detalhe, preco, qty, livre, esgotado, onMais, onMenos }) {
  return (
    <article className="menu-linha" data-esgotado={esgotado}>
      <Foto src={image} />
      <div className="menu-linha-txt">
        <h2 className="menu-nome">{nome}</h2>
        {detalhe && <p className="menu-detalhe">{detalhe}</p>}
        <p className="menu-preco bfy-num">{fmtEuro(preco)}</p>
      </div>
      {esgotado ? (
        <span className="menu-esgotado">Esgotado</span>
      ) : qty > 0 ? (
        <Stepper
          qty={qty}
          label={nome}
          onMenos={onMenos}
          onMais={onMais}
          podeMais={livre > 0}
        />
      ) : (
        <BotaoMais
          onClick={onMais}
          disabled={livre <= 0}
          label={`Juntar ${nome}`}
        />
      )}
    </article>
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
          <Foto src={c.image} className="mini-foto-img" />
        </span>
      ))}
    </span>
  )
}
