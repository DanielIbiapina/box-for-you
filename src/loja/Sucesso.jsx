import { useEffect, useState } from 'react'
import { Aviso, IconeWhatsApp, Migalhas } from './ui'
import { fmtEuro, fmtData } from './util'
import { verPedido } from './api'
import { MBWAY, MBWAY_COPIA, linkWhatsApp } from './negocio'
import { etapaAtual, etapasDo, rotuloEtapa, textoParaCliente } from '../lib/etapas'

/** De quanto em quanto tempo a página do pedido volta a perguntar como está. */
const ATUALIZAR_MS = 30000

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
  if (e.tipo === 'levantar') return ['Levantamento', e.local?.nome, dia, e.local?.morada].filter(Boolean).join(' · ')
  const morada = [e.morada, e.localidade, e.cp].filter(Boolean).join(', ')
  return ['Entrega', dia, morada].filter(Boolean).join(' · ')
}

/** Página do pedido: a festa logo a seguir a pedir, e o acompanhamento via /?p=XXXXXX. */
export function Pedido({ referencia, telefoneInicial, recemCriado, nome, pagamento, total, onNovo }) {
  const [tel, setTel] = useState(telefoneInicial || '')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [aCarregar, setACarregar] = useState(Boolean(telefoneInicial))
  const [copiado, setCopiado] = useState(false)
  /** O telemóvel com que o pedido foi encontrado — para voltar a perguntar sozinho. */
  const [telAtivo, setTelAtivo] = useState('')

  useEffect(() => {
    if (!telefoneInicial) return undefined
    let vivo = true
    verPedido(referencia, telefoneInicial)
      .then((r) => {
        if (!vivo) return
        if (r?.ok) {
          setDados(r)
          setTelAtivo(telefoneInicial)
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
      if (r?.ok) {
        setDados(r)
        setTelAtivo(telefone)
      } else {
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

  // O andamento muda do lado de lá (a dona marca "pronto", "a caminho"…):
  // enquanto a página estiver à vista, pergunta de novo de 30 em 30 segundos
  // e logo que se volta a ela. Pára quando o pedido acaba.
  const etapa = dados ? etapaAtual(dados) : null
  const terminou = etapa === 'entregue' || etapa === 'cancelado'
  useEffect(() => {
    if (!telAtivo || terminou) return undefined
    let vivo = true
    const atualizar = () => {
      if (document.visibilityState !== 'visible') return
      verPedido(referencia, telAtivo)
        .then((r) => { if (vivo && r?.ok) setDados(r) })
        .catch(() => { /* tenta outra vez na próxima volta */ })
    }
    const timer = setInterval(atualizar, ATUALIZAR_MS)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      vivo = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [referencia, telAtivo, terminou])

  const tipo = dados?.entrega?.tipo
  const texto = etapa
    ? textoParaCliente(etapa, { tipo, pagamento: dados?.pagamento, local: dados?.entrega?.local?.nome })
    : null

  const primeiro = (nome || '').trim().split(/\s+/)[0]
  // O servidor manda a verdade; antes de ele responder, vale o que ficou guardado no pedido.
  const formaPagamento = dados?.pagamento || pagamento || ''
  const aPagar = dados?.total ?? total ?? 0

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
              <h2 className="loja-section-title">{texto ? texto.titulo : 'O teu pedido'}</h2>
            </div>
          )}

          {recemCriado && (
            <figure className="bilhete">
              <figcaption className="bilhete-titulo">Um bilhetinho para ti</figcaption>
              <blockquote className="bilhete-texto">{bilheteDe(referencia)}</blockquote>
              <p className="bilhete-assina">Crumb Lab</p>
            </figure>
          )}

          {/* adiantar o MB WAY só faz sentido enquanto não está pago */}
          {formaPagamento === 'MB WAY' && !['pago', 'entregue', 'cancelado'].includes(dados?.status) && (
            <Mbway aPagar={aPagar} />
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
              {etapa === 'cancelado' ? (
                <p className="pedido-estado pedido-estado-cancelado">{texto.titulo}</p>
              ) : (
                <LinhaDoTempo
                  etapas={etapasDo(dados)}
                  atual={etapa}
                  tipo={tipo}
                  quando={dados.etapaEm}
                  detalhe={texto?.detalhe}
                />
              )}
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
            </div>
          )}

          <a
            className="zap-cartao"
            href={linkWhatsApp(`Olá! É sobre o meu pedido #${referencia}.`)}
            target="_blank"
            rel="noreferrer"
          >
            <IconeWhatsApp size={22} />
            <span>
              <span className="zap-cartao-titulo">Dúvidas? Fala connosco</span>
              <span className="zap-cartao-nota">Respondemos no WhatsApp</span>
            </span>
          </a>

          <button type="button" className="btn-primary btn-block py-3" onClick={onNovo}>
            {recemCriado ? 'Voltar aos cookies' : 'Fazer outro pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Só para quem escolheu MB WAY: adiantar o pagamento em vez de esperar pelo
 * pedido de pagamento. Continua a ser opcional — ninguém paga antes de falarmos.
 */
function Mbway({ aPagar }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(MBWAY_COPIA)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch { /* */ }
  }

  return (
    <div className="mbway">
      <p className="mbway-rotulo">Se quiseres adiantar</p>
      <p className="mbway-numero bfy-num">{MBWAY}</p>
      <button type="button" className="btn-ghost btn-sm" onClick={copiar}>
        {copiado ? 'Copiado ✓' : 'Copiar número'}
      </button>
      <p className="mbway-nota">
        MB WAY{aPagar > 0 ? `, ${fmtEuro(aPagar)}` : ''}. Se preferires, enviamos-te o pedido de pagamento.
      </p>
    </div>
  )
}

function fmtQuando(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hora = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date().toDateString() === d.toDateString()
  return hoje ? `hoje às ${hora}` : `${d.getDate()}/${d.getMonth() + 1} às ${hora}`
}

/** O caminho do pedido: o que já aconteceu, onde está agora e o que falta. */
function LinhaDoTempo({ etapas, atual, tipo, quando, detalhe }) {
  const idx = etapas.indexOf(atual)
  return (
    <div className="etapas-caixa">
      <ol className="etapas">
        {etapas.map((e, i) => {
          const estado = i < idx ? 'feita' : i === idx ? 'agora' : 'depois'
          return (
            <li key={e} className="etapa" data-estado={estado} aria-current={estado === 'agora' ? 'step' : undefined}>
              <span className="etapa-ponto" aria-hidden="true">{estado === 'feita' ? '✓' : ''}</span>
              <span className="etapa-nome">{rotuloEtapa(e, tipo)}</span>
            </li>
          )
        })}
      </ol>
      {detalhe && <p className="etapas-detalhe">{detalhe}</p>}
      {quando && <p className="etapas-quando">Atualizado {fmtQuando(quando)}</p>}
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
