import { useEffect, useState } from 'react'
import { Aviso, Migalhas } from './ui'
import { fmtEuro, fmtData } from './util'
import { verPedido } from './api'

/**
 * Um bilhete escrito à mão no fim de cada pedido — a toalhinha quente.
 * Escolhido pela referência, para ser sempre o mesmo naquele pedido.
 */
const BILHETES = [
  'Guarda um para mais logo. (Ou não. Não julgamos.)',
  'Feitos à mão, um a um, a pensar em ti.',
  'Hoje mereces uma coisa boa. Ainda bem que escolheste esta.',
  'Partilhar é bonito. Mas o primeiro é teu.',
  'Aviso: o primeiro cookie desaparece em segundos.',
  'A melhor parte do teu dia está a caminho.',
  'Obrigada por apoiares um negócio pequeno. Significa muito para nós.',
  'Dica da casa: 10 segundos no micro-ondas e ficam como acabados de sair do forno.',
]

function bilheteDe(ref) {
  let h = 0
  for (const ch of String(ref)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return BILHETES[h % BILHETES.length]
}

function entregaTexto(e) {
  if (!e?.tipo) return ''
  const dia = e.data ? fmtData(e.data) : ''
  if (e.tipo === 'levantar') return ['Levantamento', dia].filter(Boolean).join(' · ')
  const morada = [e.morada, e.localidade, e.cp].filter(Boolean).join(', ')
  return ['Entrega', dia, morada].filter(Boolean).join(' · ')
}

/** Página do pedido: a festa logo a seguir a pedir, e o acompanhamento via /?p=XXXXXX. */
export function Pedido({ referencia, telefoneInicial, recemCriado, nome, onNovo }) {
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

  const primeiro = (nome || '').trim().split(/\s+/)[0]

  return (
    <div className="sheet-backdrop">
      <div className="sheet pedido-sheet" role="dialog" aria-modal="true" aria-label="O teu pedido">
        <div className="p-6 sm:p-7 space-y-5">
          {recemCriado ? (
            <div className="festa">
              <div className="festa-check">
                <span className="festa-anel" aria-hidden="true" />
                <svg viewBox="0 0 52 52" aria-hidden="true">
                  <circle className="festa-circ" cx="26" cy="26" r="25" />
                  <path className="festa-v" d="M15 27.5l7.2 7.2L37.5 19" />
                </svg>
                <Migalhas atraso=".32s" escala={2} />
              </div>
              <h2 className="festa-titulo">{primeiro ? `Obrigada, ${primeiro}!` : 'Pedido feito!'}</h2>
              <p className="festa-sub">
                Já está connosco. Vamos falar contigo por mensagem para confirmar tudo.
              </p>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <img className="loja-mascote" src="/mascote-cramb.png" alt="" />
              <h2 className="loja-section-title">{dados ? dados.estado : 'O teu pedido'}</h2>
            </div>
          )}

          {recemCriado && (
            <figure className="bilhete">
              <figcaption className="bilhete-titulo">Um bilhetinho para ti</figcaption>
              <blockquote className="bilhete-texto">{bilheteDe(referencia)}</blockquote>
              <p className="bilhete-assina">Crumb Lab</p>
            </figure>
          )}

          <div className="talao">
            <p className="talao-rotulo">Código do pedido</p>
            <p className="talao-ref bfy-num">#{referencia}</p>
            <button type="button" className="btn-ghost btn-sm" onClick={copiar}>
              {copiado ? 'Copiado ✓' : 'Copiar código'}
            </button>
          </div>

          {!dados && !aCarregar && (
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); consultar(tel) }}
            >
              <label className="block">
                <span className="bfy-label">Telemóvel do pedido</span>
                <input
                  className="bfy-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  placeholder="912 345 678"
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
            <div className="space-y-4 pedido-detalhes">
              {recemCriado && <p className="pedido-estado">{dados.estado}</p>}
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
            {recemCriado ? 'Voltar aos cookies' : 'Fazer outro pedido'}
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
