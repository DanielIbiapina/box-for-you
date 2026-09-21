import { findCookie, fmtEuro } from './util'
import { IconeBox, Migalhas } from './ui'

/**
 * A Box que se vai enchendo, sempre à vista. Cada cookie tocado voa para o
 * espaço seguinte (voar.js aponta para [data-slot]). Ao 4.º, os espaços
 * fecham-se no contador de Boxes — a sequência é toda CSS, com `key` a
 * reiniciá-la, por isso nada aqui usa temporizadores.
 */
export function Bandeja({ cardapio, resumo, poupancaBox, fechou, onAbrir }) {
  const { size, caixas, resto, total, nItens, poupanca } = resumo
  const nCaixas = caixas.length
  const aFechar = Boolean(fechou && resto.length === 0 && nCaixas > 0)
  const foto = (id) => findCookie(cardapio, id)?.image

  let dica
  if (aFechar) dica = `Box fechada! Poupaste ${fmtEuro(poupanca)}`
  else if (resto.length > 0) {
    const faltam = size - resto.length
    dica = faltam === 1
      ? `Só mais 1 e fechas a Box${poupancaBox > 0 ? ` · poupas ${fmtEuro(poupancaBox)}` : ''}`
      : `Mais ${faltam} e fechas uma Box${poupancaBox > 0 ? ` · poupas ${fmtEuro(poupancaBox)}` : ''}`
  } else if (nCaixas > 0) {
    dica = `${nCaixas} ${nCaixas === 1 ? 'Box' : 'Boxes'} · poupas ${fmtEuro(poupanca)}`
  } else if (nItens > 0) {
    dica = `Junta cookies: a cada ${size}, uma Box`
  } else {
    dica = `Toca nos cookies · a cada ${size}, uma Box`
  }

  return (
    <div className="bandeja">
      <p key={dica} className="bandeja-dica" data-festa={aFechar} aria-live="polite">{dica}</p>
      <div className="bandeja-barra">
        <div className="bandeja-esq">
          <div className="bandeja-slots">
            <div
              key={aFechar ? `novas-${fechou.n}` : 'slots'}
              className={aFechar ? 'slots slots-voltam' : 'slots'}
            >
              {Array.from({ length: size }, (_, i) => {
                const id = resto[i]
                const src = id ? foto(id) : null
                return (
                  <span
                    key={id ? `${i}-${id}` : `v${i}`}
                    className="slot"
                    data-cheio={Boolean(id)}
                    data-slot={i}
                  >
                    {src && <img src={src} alt="" draggable="false" />}
                  </span>
                )
              })}
            </div>

            {aFechar && (
              <div key={fechou.n} className="slots slots-fecho" aria-hidden="true">
                {fechou.ids.map((id, i) => (
                  <span key={i} className="slot" data-cheio="true" data-ultimo={i === size - 1}>
                    {foto(id) && <img src={foto(id)} alt="" />}
                  </span>
                ))}
              </div>
            )}
            {aFechar && (
              <span key={`m-${fechou.n}`} className="bandeja-migalhas">
                <Migalhas atraso=".74s" />
              </span>
            )}
          </div>

          {nCaixas > 0 && (
            <span
              key={nCaixas}
              className="bandeja-caixas"
              data-atraso={aFechar}
              data-alvo="caixas"
              aria-label={`${nCaixas} ${nCaixas === 1 ? 'Box' : 'Boxes'}`}
            >
              <IconeBox size={15} />
              <b className="bfy-num">{nCaixas}</b>
            </span>
          )}
        </div>

        <button type="button" className="bandeja-cta" disabled={nItens === 0} onClick={onAbrir}>
          <span className="bandeja-cta-rotulo">Ver pedido</span>
          <span className="bandeja-cta-total bfy-num" data-alvo="total">{fmtEuro(total)}</span>
        </button>
      </div>
    </div>
  )
}
