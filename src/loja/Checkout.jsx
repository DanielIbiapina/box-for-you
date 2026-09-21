import { useEffect, useRef, useState } from 'react'
import { Aviso, IconeBox, Stepper } from './ui'
import { fmtEuro, fmtData, proximosDias, hojeIso, findCookie } from './util'
import { gravarContacto, lerContacto } from './storage'
import { toquePasso } from './sensacao'

const RECEBER = [
  { id: 'levantar', icone: '🛍️', titulo: 'Levantar', nota: 'Vens tu buscar' },
  { id: 'entrega', icone: '🛵', titulo: 'Entrega', nota: 'Levamos até ti' },
]

const PAGAMENTOS = [
  { id: 'MB WAY', icone: '📱', nota: 'Enviamos o pedido de pagamento para o teu telemóvel.' },
  { id: 'Dinheiro', icone: '💶', nota: 'Pagas quando receberes os cookies.' },
]

/** Para onde levar a pessoa quando o servidor recusa um campo. */
const PASSO_DO_CAMPO = {
  entrega: 'receber', data: 'quando', morada: 'morada', localidade: 'morada',
  nome: 'contacto', telefone: 'contacto', pagamento: 'pagar',
}

const FALLBACK_LEVANTAR = 'Combinamos o sítio e a hora contigo por mensagem.'
const FALLBACK_ENTREGA = 'Entregamos na morada que indicares. Combinamos o horário contigo.'

const passosPara = (tipo) => [
  'pedido', 'receber', 'quando', ...(tipo === 'entrega' ? ['morada'] : []), 'contacto', 'pagar', 'confirmar',
]

/**
 * Um passo por ecrã, uma decisão por passo. As escolhas de um toque avançam
 * sozinhas; só pedimos "Continuar" quando há que escrever. Entrega abre o
 * passo da morada, levantar salta-o. Quem já pediu antes encontra tudo
 * preenchido — o segundo pedido é quase só confirmar.
 */
export function Checkout({
  cardapio, resumo, poupancaBox, onFechar,
  onTirarCaixa, onRepetirCaixa, onPodeRepetirCaixa, onAjustar, onPodeMais, onEnviar,
}) {
  const [inicial] = useState(lerContacto)
  const [form, setForm] = useState(() => ({ ...inicial, data: '', pagamento: '', notas: '' }))
  const [passo, setPasso] = useState('pedido')
  const [dir, setDir] = useState(1)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [outroDia, setOutroDia] = useState(false)
  const [comNota, setComNota] = useState(false)
  const [dias] = useState(() => proximosDias(8))
  const [hoje] = useState(hojeIso)
  const titulo = useRef(null)
  const corpo = useRef(null)
  const timer = useRef(null)

  const passos = passosPara(form.tipo)
  const idx = Math.max(0, passos.indexOf(passo))
  const { nome, telefone, tipo, morada, localidade, cp } = form

  useEffect(() => {
    gravarContacto({ nome, telefone, tipo, morada, localidade, cp })
  }, [nome, telefone, tipo, morada, localidade, cp])

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
    corpo.current?.scrollTo({ top: 0 })
  }, [passo])

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onFechar])

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  const txtLevantar = cardapio?.negocio?.instrucoesLevantamento || FALLBACK_LEVANTAR
  const txtEntrega = cardapio?.negocio?.instrucoesEntrega || FALLBACK_ENTREGA

  function irPara(alvo, { tipoAgora = form.tipo, som = true } = {}) {
    clearTimeout(timer.current)
    const lista = passosPara(tipoAgora)
    setDir(lista.indexOf(alvo) >= idx ? 1 : -1)
    setPasso(alvo)
    setErro('')
    if (som) toquePasso()
  }

  /** Deixa ver a escolha acender antes de deslizar para o passo seguinte. */
  function depois(alvo, tipoAgora) {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => irPara(alvo, { tipoAgora, som: false }), 300)
  }

  function voltar() {
    if (idx === 0) onFechar()
    else irPara(passos[idx - 1])
  }

  // ── validação por passo ─────────────────────────────────────────────────
  const semPedido = () => (resumo.linhas.length === 0 ? 'O pedido está vazio.' : '')
  const semMorada = () => {
    if (form.morada.trim().length < 4) return 'Indica a morada de entrega.'
    if (form.localidade.trim().length < 2) return 'Indica a localidade.'
    return ''
  }
  const semContacto = () => {
    if (form.nome.trim().length < 2) return 'Diz-nos o teu nome.'
    if (form.telefone.replace(/\D/g, '').length < 6) return 'Precisamos de um telemóvel para confirmar o pedido.'
    return ''
  }

  function primeiroProblema() {
    const p = semPedido()
    if (p) return ['pedido', p]
    if (!form.tipo) return ['receber', 'Diz-nos se preferes levantar ou receber em casa.']
    if (!form.data || form.data < hoje) return ['quando', 'Escolhe o dia em que queres os cookies.']
    if (form.tipo === 'entrega' && semMorada()) return ['morada', semMorada()]
    if (semContacto()) return ['contacto', semContacto()]
    if (!form.pagamento) return ['pagar', 'Escolhe como preferes pagar.']
    return null
  }

  // ── escolhas de um toque ────────────────────────────────────────────────
  function escolherTipo(t) {
    toquePasso()
    setForm((f) => ({ ...f, tipo: t }))
    depois('quando', t)
  }
  function escolherDia(iso) {
    toquePasso()
    setOutroDia(false)
    setForm((f) => ({ ...f, data: iso }))
    depois(form.tipo === 'entrega' ? 'morada' : 'contacto')
  }
  function escolherPagamento(p) {
    toquePasso()
    setForm((f) => ({ ...f, pagamento: p }))
    depois('confirmar')
  }

  function continuar() {
    if (passo === 'pedido') {
      const p = semPedido()
      return p ? setErro(p) : irPara('receber')
    }
    if (passo === 'receber') return irPara('quando')
    if (passo === 'quando') {
      if (!form.data || form.data < hoje) return setErro('Escolhe o dia em que queres os cookies.')
      return irPara(form.tipo === 'entrega' ? 'morada' : 'contacto')
    }
    if (passo === 'morada') {
      const p = semMorada()
      return p ? setErro(p) : irPara('contacto')
    }
    if (passo === 'contacto') {
      const p = semContacto()
      return p ? setErro(p) : irPara('pagar')
    }
    if (passo === 'pagar') return irPara('confirmar')
    return submeter()
  }

  async function submeter() {
    const problema = primeiroProblema()
    if (problema) {
      const [alvo, motivo] = problema
      if (alvo !== passo) irPara(alvo)
      setErro(motivo)
      return
    }
    setErro('')
    setEnviando(true)
    try {
      const resposta = await onEnviar(form)
      if (!resposta?.ok) {
        const alvo = resposta?.esgotado ? 'pedido' : PASSO_DO_CAMPO[resposta?.campo]
        if (alvo && alvo !== passo) irPara(alvo, { som: false })
        setErro(resposta?.motivo ?? 'Não conseguimos registar o pedido.')
      }
    } catch (err) {
      console.error(err)
      setErro('Falhou a ligação. Verifica a internet e tenta outra vez.')
    } finally {
      setEnviando(false)
    }
  }

  // ── botão do fundo ──────────────────────────────────────────────────────
  let cta = null
  if (passo === 'pedido') cta = { rotulo: `Continuar · ${fmtEuro(resumo.total)}`, off: resumo.linhas.length === 0 }
  else if (passo === 'receber' && form.tipo) cta = { rotulo: 'Continuar' }
  else if (passo === 'quando' && form.data) cta = { rotulo: 'Continuar' }
  else if (passo === 'morada' || passo === 'contacto') cta = { rotulo: 'Continuar' }
  else if (passo === 'pagar' && form.pagamento) cta = { rotulo: 'Continuar' }
  else if (passo === 'confirmar') {
    cta = { rotulo: enviando ? 'A enviar…' : `Fazer pedido · ${fmtEuro(resumo.total)}`, off: enviando, final: true }
  }

  const primeiroNome = inicial.nome.trim().split(/\s+/)[0]

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div className="sheet checkout" role="dialog" aria-modal="true" aria-label="O teu pedido">
        <header className="checkout-topo">
          <button type="button" className="btn-icon" onClick={voltar} aria-label={idx === 0 ? 'Fechar' : 'Voltar'}>
            {idx === 0 ? '✕' : '←'}
          </button>
          <div
            className="checkout-progresso"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={passos.length}
            aria-valuenow={idx + 1}
            aria-label={`Passo ${idx + 1} de ${passos.length}`}
          >
            <span style={{ width: `${((idx + 1) / passos.length) * 100}%` }} />
          </div>
          {idx > 0
            ? <button type="button" className="btn-icon" onClick={onFechar} aria-label="Fechar">✕</button>
            : <span className="w-9" aria-hidden="true" />}
        </header>

        <div className="checkout-corpo" ref={corpo}>
          <div key={passo} className="passo" data-dir={dir}>
            {passo === 'pedido' && (
              <>
                <h2 ref={titulo} tabIndex={-1} className="passo-titulo">O teu pedido</h2>
                {resumo.linhas.length === 0 ? (
                  <p className="passo-sub">Está vazio. Volta atrás e escolhe uns cookies.</p>
                ) : (
                  <ul className="linhas">
                    {resumo.linhas.map((l) => (
                      <Linha
                        key={l.key}
                        l={l}
                        cardapio={cardapio}
                        onTirarCaixa={onTirarCaixa}
                        onRepetirCaixa={onRepetirCaixa}
                        podeRepetir={l.tipo === 'caixa' && onPodeRepetirCaixa(l.inicio)}
                        onAjustar={onAjustar}
                        podeMais={l.tipo !== 'caixa' && onPodeMais(l)}
                      />
                    ))}
                  </ul>
                )}
                {resumo.poupanca > 0 && (
                  <p className="poupanca">
                    <span aria-hidden="true">🎉</span> Com a Box poupas {fmtEuro(resumo.poupanca)}
                  </p>
                )}
                {resumo.resto.length > 0 && poupancaBox > 0 && (
                  <div className="empurrao">
                    <p>
                      Mais <b>{resumo.size - resumo.resto.length}</b> e fechas uma Box: poupas {fmtEuro(poupancaBox)}.
                    </p>
                    <button type="button" className="btn-ghost btn-sm" onClick={onFechar}>Escolher</button>
                  </div>
                )}
                <div className="checkout-total">
                  <span>Total</span>
                  <span className="bfy-num">{fmtEuro(resumo.total)}</span>
                </div>
              </>
            )}

            {passo === 'receber' && (
              <>
                <h2 ref={titulo} tabIndex={-1} className="passo-titulo">Como queres receber?</h2>
                <div className="opcoes opcoes-2">
                  {RECEBER.map((op) => (
                    <Opcao
                      key={op.id}
                      ativo={form.tipo === op.id}
                      icone={op.icone}
                      titulo={op.titulo}
                      nota={op.nota}
                      onClick={() => escolherTipo(op.id)}
                    />
                  ))}
                </div>
                {form.tipo && (
                  <p className="passo-info">{form.tipo === 'levantar' ? txtLevantar : txtEntrega}</p>
                )}
              </>
            )}

            {passo === 'quando' && (
              <>
                <h2 ref={titulo} tabIndex={-1} className="passo-titulo">Para quando?</h2>
                <p className="passo-sub">
                  {form.tipo === 'entrega' ? 'O dia em que te levamos os cookies.' : 'O dia em que vens buscar.'}
                </p>
                <div className="dias">
                  {dias.map((d) => (
                    <button
                      key={d.iso}
                      type="button"
                      className="dia"
                      aria-pressed={form.data === d.iso}
                      onClick={() => escolherDia(d.iso)}
                    >
                      <span className="dia-rotulo">{d.rotulo}</span>
                      <span className="dia-data">{d.dia}</span>
                    </button>
                  ))}
                </div>
                {outroDia || (form.data && !dias.some((d) => d.iso === form.data)) ? (
                  <label className="block mt-4">
                    <span className="bfy-label">Outro dia</span>
                    <input
                      className="bfy-input" type="date" min={hoje}
                      value={form.data} onChange={set('data')}
                    />
                  </label>
                ) : (
                  <button type="button" className="passo-link" onClick={() => setOutroDia(true)}>
                    Outro dia…
                  </button>
                )}
              </>
            )}

            {passo === 'morada' && (
              <>
                <h2 ref={titulo} tabIndex={-1} className="passo-titulo">Onde entregamos?</h2>
                <p className="passo-sub">{txtEntrega}</p>
                <div className="campos">
                  <label className="block">
                    <span className="bfy-label">Morada</span>
                    <input
                      className="bfy-input" maxLength={160} autoComplete="street-address"
                      value={form.morada} onChange={set('morada')} placeholder="Rua, número, andar"
                    />
                  </label>
                  <div className="grid grid-cols-5 gap-3">
                    <label className="block col-span-3">
                      <span className="bfy-label">Localidade</span>
                      <input
                        className="bfy-input" maxLength={80} autoComplete="address-level2"
                        value={form.localidade} onChange={set('localidade')} placeholder="Lisboa"
                      />
                    </label>
                    <label className="block col-span-2">
                      <span className="bfy-label">Código postal</span>
                      <input
                        className="bfy-input" maxLength={12} autoComplete="postal-code" inputMode="numeric"
                        value={form.cp} onChange={set('cp')} placeholder="1000-000"
                      />
                    </label>
                  </div>
                </div>
              </>
            )}

            {passo === 'contacto' && (
              <>
                <h2 ref={titulo} tabIndex={-1} className="passo-titulo">
                  {primeiroNome ? `Olá outra vez, ${primeiroNome}!` : 'Como te chamas?'}
                </h2>
                <p className="passo-sub">
                  {primeiroNome ? 'Só confirma o teu contacto.' : 'Para sabermos de quem são estes cookies.'}
                </p>
                <div className="campos">
                  <label className="block">
                    <span className="bfy-label">Nome</span>
                    <input
                      className="bfy-input" maxLength={80} autoComplete="name"
                      value={form.nome} onChange={set('nome')} placeholder="O teu nome"
                    />
                  </label>
                  <label className="block">
                    <span className="bfy-label">Telemóvel</span>
                    <input
                      className="bfy-input" type="tel" inputMode="tel" maxLength={40} autoComplete="tel"
                      value={form.telefone} onChange={set('telefone')} placeholder="912 345 678"
                    />
                    <span className="bfy-hint">É por aqui que confirmamos o pedido contigo.</span>
                  </label>
                </div>
              </>
            )}

            {passo === 'pagar' && (
              <>
                <h2 ref={titulo} tabIndex={-1} className="passo-titulo">Como preferes pagar?</h2>
                <p className="passo-sub">Não pagas nada agora. Combinamos contigo.</p>
                <div className="opcoes">
                  {PAGAMENTOS.map((p) => (
                    <Opcao
                      key={p.id}
                      linha
                      ativo={form.pagamento === p.id}
                      icone={p.icone}
                      titulo={p.id}
                      nota={p.nota}
                      onClick={() => escolherPagamento(p.id)}
                    />
                  ))}
                </div>
              </>
            )}

            {passo === 'confirmar' && (
              <Confirmar
                titulo={titulo}
                cardapio={cardapio}
                resumo={resumo}
                form={form}
                txtLevantar={txtLevantar}
                comNota={comNota}
                onComNota={() => setComNota(true)}
                onNotas={set('notas')}
                irPara={irPara}
              />
            )}
          </div>
        </div>

        {(cta || erro) && (
          <footer className="checkout-pe">
            {erro && <Aviso>{erro}</Aviso>}
            {cta && (
              <button
                type="button"
                className={cta.final ? 'btn-primary btn-block checkout-cta checkout-cta-final' : 'btn-primary btn-block checkout-cta'}
                disabled={cta.off}
                onClick={continuar}
              >
                {cta.rotulo}
              </button>
            )}
            {passo === 'confirmar' && (
              <p className="checkout-letra">Não pagas nada agora. Falamos contigo para confirmar.</p>
            )}
          </footer>
        )}
      </div>
    </div>
  )
}

function Opcao({ ativo, icone, titulo, nota, onClick, linha }) {
  return (
    <button
      type="button"
      className={linha ? 'opcao opcao-linha' : 'opcao'}
      aria-pressed={ativo}
      onClick={onClick}
    >
      <span className="opcao-icone" aria-hidden="true">{icone}</span>
      <span className="opcao-txt">
        <span className="opcao-titulo">{titulo}</span>
        <span className="opcao-nota">{nota}</span>
      </span>
      {ativo && <span className="opcao-check" aria-hidden="true">✓</span>}
    </button>
  )
}

function Linha({ l, cardapio, onTirarCaixa, onRepetirCaixa, podeRepetir, onAjustar, podeMais }) {
  if (l.tipo === 'caixa') {
    return (
      <li className="linha">
        <span className="linha-box-fotos" aria-hidden="true">
          {l.ids.map((id, i) => {
            const src = findCookie(cardapio, id)?.image
            return src ? <img key={i} src={src} alt="" /> : <span key={i} />
          })}
        </span>
        <div className="linha-txt">
          <p className="linha-nome"><IconeBox size={14} /> {l.nome}</p>
          <p className="linha-detalhe">{l.detalhe}</p>
          <div className="linha-acoes">
            <button type="button" className="linha-acao" onClick={() => onTirarCaixa(l.inicio)}>Tirar</button>
            <button
              type="button"
              className="linha-acao"
              disabled={!podeRepetir}
              onClick={() => onRepetirCaixa(l.inicio)}
            >
              + Outra igual
            </button>
          </div>
        </div>
        <span className="linha-preco bfy-num">{fmtEuro(l.subtotal)}</span>
      </li>
    )
  }

  return (
    <li className="linha">
      {l.image
        ? <img className="linha-foto" src={l.image} alt="" />
        : <span className="linha-foto linha-foto-vazia" aria-hidden="true"><IconeBox size={18} /></span>}
      <div className="linha-txt">
        <p className="linha-nome">{l.nome}</p>
        <p className="linha-detalhe">{l.detalhe}</p>
      </div>
      <Stepper
        qty={l.qty}
        label={l.nome}
        onMenos={() => onAjustar(l, -1)}
        onMais={() => onAjustar(l, 1)}
        podeMais={podeMais}
      />
      <span className="linha-preco bfy-num">{fmtEuro(l.subtotal)}</span>
    </li>
  )
}

function Confirmar({ titulo, cardapio, resumo, form, txtLevantar, comNota, onComNota, onNotas, irPara }) {
  const pag = PAGAMENTOS.find((p) => p.id === form.pagamento)
  const nCaixas = resumo.caixas.length
  const nSoltos = resumo.linhas.filter((l) => l.tipo === 'avulso').reduce((s, l) => s + l.qty, 0)
  const partes = []
  if (nCaixas) partes.push(`${nCaixas} ${nCaixas === 1 ? 'Box' : 'Boxes'} de ${resumo.size}`)
  if (nSoltos) partes.push(`${nSoltos} ${nSoltos === 1 ? 'cookie' : 'cookies'}`)
  for (const l of resumo.linhas.filter((x) => x.tipo === 'extra')) partes.push(`${l.qty > 1 ? `${l.qty}× ` : ''}${l.nome}`)
  const fotos = resumo.linhas
    .flatMap((l) => (l.tipo === 'caixa' ? l.ids.map((id) => findCookie(cardapio, id)?.image) : [l.image]))
    .filter(Boolean)
    .slice(0, 8)

  const onde = form.tipo === 'entrega'
    ? [form.morada, form.localidade, form.cp].filter(Boolean).join(', ')
    : txtLevantar

  return (
    <>
      <h2 ref={titulo} tabIndex={-1} className="passo-titulo">Está tudo certo?</h2>
      <ul className="resumo">
        <ResumoLinha icone="🍪" titulo={partes.join(' + ')} onMudar={() => irPara('pedido')}>
          {fotos.length > 0 && (
            <span className="resumo-fotos" aria-hidden="true">
              {fotos.map((src, i) => <img key={i} src={src} alt="" />)}
            </span>
          )}
        </ResumoLinha>
        <ResumoLinha
          icone={form.tipo === 'entrega' ? '🛵' : '🛍️'}
          titulo={`${form.tipo === 'entrega' ? 'Entrega' : 'Levantar'} · ${fmtData(form.data)}`}
          detalhe={onde}
          onMudar={() => irPara('receber')}
        />
        <ResumoLinha icone="🙋" titulo={form.nome} detalhe={form.telefone} onMudar={() => irPara('contacto')} />
        <ResumoLinha icone={pag?.icone ?? '💶'} titulo={form.pagamento} detalhe={pag?.nota} onMudar={() => irPara('pagar')} />
      </ul>

      {comNota ? (
        <label className="block mt-4">
          <span className="bfy-label">Nota</span>
          <textarea
            className="bfy-input" rows={2} maxLength={400} autoFocus
            value={form.notas} onChange={onNotas}
            placeholder="Alergias, ocasião, pormenor da entrega…"
          />
        </label>
      ) : (
        <button type="button" className="passo-link" onClick={onComNota}>
          + Juntar uma nota (alergias, ocasião…)
        </button>
      )}

      <div className="checkout-total">
        <span>Total</span>
        <span className="bfy-num">{fmtEuro(resumo.total)}</span>
      </div>
    </>
  )
}

function ResumoLinha({ icone, titulo, detalhe, onMudar, children }) {
  return (
    <li className="resumo-linha">
      <span className="resumo-icone" aria-hidden="true">{icone}</span>
      <div className="resumo-txt">
        <p className="resumo-titulo">{titulo}</p>
        {detalhe && <p className="resumo-detalhe">{detalhe}</p>}
        {children}
      </div>
      <button type="button" className="resumo-mudar" onClick={onMudar}>Mudar</button>
    </li>
  )
}
