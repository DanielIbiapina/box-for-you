import { useEffect, useState } from 'react'
import { Aviso } from './ui'
import { fmtEuro, fmtData } from './util'
import { verPedido } from './api'

function entregaTexto(e) {
  if (!e?.tipo) return ''
  const dia = e.data ? fmtData(e.data) : ''
  if (e.tipo === 'levantar') return ['Levantamento', dia].filter(Boolean).join(' · ')
  const morada = [e.morada, e.localidade, e.cp].filter(Boolean).join(', ')
  return ['Entrega', dia, morada].filter(Boolean).join(' · ')
}

/** Página do pedido: sucesso e acompanhamento via /?p=XXXXXX. */
export function Pedido({ referencia, telefoneInicial, recemCriado, onNovo }) {
  const [tel, setTel] = useState(telefoneInicial || '')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [aCarregar, setACarregar] = useState(Boolean(telefoneInicial))
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!telefoneInicial) return undefined
    let vivo = true
    verPedido(referencia, telefoneInicial)
      .then((r) => {
        if (!vivo) return
        if (r?.ok) {
          setDados(r)
          setErro('')
        } else {
          setDados(null)
          setErro(r?.motivo ?? 'Não encontrámos este pedido.')
        }
      })
      .catch((e) => {
        console.error(e)
        if (!vivo) return
        setDados(null)
        setErro('Falhou a ligação. Tenta outra vez.')
      })
      .finally(() => { if (vivo) setACarregar(false) })
    return () => { vivo = false }
  }, [referencia, telefoneInicial])

  async function consultar(telefone) {
    setErro('')
    setACarregar(true)
    try {
      const r = await verPedido(referencia, telefone)
      if (r?.ok) setDados(r)
      else {
        setDados(null)
        setErro(r?.motivo ?? 'Não encontrámos este pedido.')
      }
    } catch (e) {
      console.error(e)
      setDados(null)
      setErro('Falhou a ligação. Tenta outra vez.')
    } finally {
      setACarregar(false)
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(referencia)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch { /* */ }
  }

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="O teu pedido">
        <div className="p-7 space-y-5">
          <div className="text-center space-y-3">
            <img
              className={recemCriado ? 'loja-mascote loja-mascote-in' : 'loja-mascote'}
              src="/mascote-cramb.png"
              alt=""
            />
            <h2 className="loja-section-title">
              {dados ? dados.estado : recemCriado ? 'Já está connosco.' : 'O teu pedido'}
            </h2>
            <p className="text-sm ink-2">
              Guarda o código. É com ele que acompanhamos o pedido.
            </p>
          </div>

          <div className="bfy-card p-4 text-center space-y-2">
            <p className="text-xs ink-3">Referência</p>
            <p className="bfy-num font-black text-3xl tracking-wider" style={{ color: 'var(--color-accent-dark)' }}>
              #{referencia}
            </p>
            <button type="button" className="btn-ghost btn-sm" onClick={copiar}>
              {copiado ? 'Copiado' : 'Copiar código'}
            </button>
          </div>

          {!dados && !aCarregar && (
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); consultar(tel) }}
            >
              <label className="block">
                <span className="bfy-label">Telemóvel do pedido *</span>
                <input
                  className="bfy-input"
                  type="tel"
                  inputMode="tel"
                  required
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  placeholder="+351 912 345 678"
                  autoFocus={!telefoneInicial}
                />
              </label>
              {erro && <Aviso>{erro}</Aviso>}
              <button type="submit" className="btn-primary btn-block py-3" disabled={aCarregar}>
                {aCarregar ? 'A procurar…' : 'Ver o pedido'}
              </button>
            </form>
          )}

          {aCarregar && !dados && (
            <p className="text-sm text-center ink-2">A procurar o pedido…</p>
          )}

          {dados && (
            <div className="space-y-4">
              <div className="bfy-card p-4 text-left space-y-2.5">
                {(dados.linhas ?? []).map((l, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold ink-1">
                        {l.qty > 1 && <span className="bfy-num">{l.qty}× </span>}
                        {l.nome}
                      </p>
                      {l.detalhe ? <p className="text-xs ink-3">{l.detalhe}</p> : null}
                    </div>
                    <span className="bfy-num text-sm font-bold shrink-0">{fmtEuro(l.subtotal)}</span>
                  </div>
                ))}
                <div
                  className="flex items-center justify-between border-t pt-2.5"
                  style={{ borderColor: 'var(--line-1)' }}
                >
                  <span className="font-bold ink-2">Total</span>
                  <span className="bfy-num font-black text-xl" style={{ color: 'var(--color-accent-dark)' }}>
                    {fmtEuro(dados.total)}
                  </span>
                </div>
                <Linha rotulo="Pagamento" valor={dados.pagamento} />
                {entregaTexto(dados.entrega) && (
                  <Linha rotulo="Receber" valor={entregaTexto(dados.entrega)} />
                )}
              </div>

              <p className="text-sm ink-2 text-center">{dados.seguinte}</p>
            </div>
          )}

          <button type="button" className="btn-primary btn-block py-3" onClick={onNovo}>
            Fazer outro pedido
          </button>
        </div>
      </div>
    </div>
  )
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm ink-3 shrink-0">{rotulo}</span>
      <span className="text-sm font-bold ink-1 text-right">{valor}</span>
    </div>
  )
}
