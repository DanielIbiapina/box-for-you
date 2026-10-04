import { useEffect, useRef, useState } from 'react'
import { Aviso, IconeBox, Stepper } from './ui'
import { fmtEuro, fmtData, proximosDias, hojeIso, findCookie } from './util'
import { gravarContacto, lerContacto } from './storage'
import { toquePasso } from './sensacao'
import { localizar, distanciaKm, taxaPara } from './geo'
import { faixasDoDia, desvioRelogio, rotuloHora } from './horarios'
import { validarCupom } from './api'

const RECEBER = [
  { id: 'levantar', icone: '🛍️', imagem: '/landing-icons/levantar.webp', titulo: 'Levantar', nota: 'Vens tu buscar' },
  { id: 'entrega', icone: '🛵', imagem: '/landing-icons/entrega.webp', titulo: 'Entrega', nota: 'Levamos até ti' },
]

const PAGAMENTOS = [
  { id: 'MB WAY', icone: '📱', nota: 'Enviamos o pedido de pagamento para o teu telemóvel.' },
  { id: 'Dinheiro', icone: '💶', nota: 'Pagas quando receberes os cookies.' },
]

/** Para onde levar a pessoa quando o servidor recusa um campo. */
const PASSO_DO_CAMPO = {
  entrega: 'receber', local: 'local', data: 'quando', hora: 'quando', morada: 'morada', localidade: 'morada',
  nome: 'contacto', telefone: 'contacto', pagamento: 'pagar', cupom: 'confirmar',
}

const fmtKm = (km) => `${km.toFixed(1).replace('.', ',')} km`

const FALLBACK_LEVANTAR = 'Combinamos o sítio e a hora contigo por mensagem.'
const FALLBACK_ENTREGA = 'Entregamos na morada que indicares. Combinamos o horário contigo.'

/** Com mais de um local de levantamento ligado, há um passo para escolher. */
const passosPara = (tipo, escolheLocal = false) => [
  'pedido', 'receber',
  ...(tipo === 'levantar' && escolheLocal ? ['local'] : []),
  'quando', ...(tipo === 'entrega' ? ['morada'] : []), 'contacto', 'pagar', 'confirmar',
]

/**
 * Locais de levantamento ligados pela dona (Definições → Locais de levantamento).
 * null = loja sem locais configurados (combina-se o sítio por mensagem);
 * []   = há locais mas todos desligados (hoje só há entrega).
 */
const locaisDe = (cardapio) => (cardapio?.temLocais ? (cardapio.locais ?? []) : null)
const descLocal = (l) => [l.nome, l.morada, l.notas].filter(Boolean).join(' · ')

/**
 * Um passo por ecrã, uma decisão por passo. As escolhas de um toque avançam
 * sozinhas; só pedimos "Continuar" quando há que escrever. Entrega abre o
 * passo da morada, levantar salta-o. Quem já pediu antes encontra tudo
 * preenchido — o segundo pedido é quase só confirmar.
 */
export function Checkout({
  cardapio, resumo, poupancaBox, caixaInicial = null, onFechar,
  onTirarDaCaixa, onTirarCaixa, onRepetirCaixa, onPodeRepetirCaixa, onAjustar, onPodeMais, onEnviar,
}) {
  const [inicial] = useState(lerContacto)
  /** Box aberta para mexer cookie a cookie (pelo índice onde começa na escolha). */
  const [caixaAberta, setCaixaAberta] = useState(caixaInicial)
  const [form, setForm] = useState(() => {
    // O que ficou do último pedido só vale se o local ainda estiver ligado.
    const ls = locaisDe(cardapio)
    const semLev = Array.isArray(ls) && ls.length === 0
    return {
      ...inicial,
      tipo: inicial.tipo === 'levantar' && semLev ? '' : inicial.tipo,
      local: ls?.some((l) => l.id === inicial.local) ? inicial.local : '',
      data: '', hora: '', pagamento: '', notas: '',
    }
  })
  const [passo, setPasso] = useState('pedido')
  const [dir, setDir] = useState(1)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [outroDia, setOutroDia] = useState(false)
  const [comNota, setComNota] = useState(false)
  const [dias] = useState(() => proximosDias(8))
  const [hoje] = useState(hojeIso)
  /** Distância/taxa da morada de entrega: { chave, estado: 'a-ver'|'ok'|'sem-mapa', km, taxa, lat, lng } */
  const [geo, setGeo] = useState(null)
  /** Cupão aplicado: { codigo, percent } */
  const [cupom, setCupom] = useState(null)
  // Faixas de horário: só os dias que ainda têm alguma faixa possível
  const horarios = cardapio?.horarios
  const [desvio] = useState(() => desvioRelogio(cardapio?.horarios))
  const faixas = faixasDoDia(form.data, horarios, desvio)
  const diasComHora = dias.filter((d) => faixasDoDia(d.iso, horarios, desvio).length > 0)
  const horaValida = Boolean(form.hora) && faixas.some((f) => f.hora === form.hora)
  const titulo = useRef(null)
  const corpo = useRef(null)
  const timer = useRef(null)

  const locais = locaisDe(cardapio)
  const semLevantamento = Array.isArray(locais) && locais.length === 0
  const escolheLocal = Array.isArray(locais) && locais.length > 1
  const localEscolhido = Array.isArray(locais)
    ? locais.find((l) => l.id === form.local) ?? (locais.length === 1 ? locais[0] : null)
    : null
  const opcoesReceber = semLevantamento ? RECEBER.filter((op) => op.id !== 'levantar') : RECEBER

  // ── taxa de entrega e cupão ─────────────────────────────────────────────
  const regrasEntrega = cardapio?.entrega?.ativo ? cardapio.entrega : null
  const chaveMorada = `${form.morada.trim()}|${form.localidade.trim()}|${form.cp.trim()}`.toLowerCase()
  // A distância só vale para a morada com que foi calculada.
  const geoAtual = geo && geo.chave === chaveMorada ? geo : null
  const taxaEntrega = form.tipo === 'entrega' && regrasEntrega && geoAtual?.estado === 'ok' ? geoAtual.taxa : 0
  const desconto = cupom ? Math.round(resumo.total * cupom.percent) / 100 : 0
  const totalFinal = Math.max(0, resumo.total - desconto + taxaEntrega)

  /** Calcula distância e taxa da morada. Devolve o resultado (ou null sem regras de entrega). */
  async function calcularEntrega() {
    if (!regrasEntrega) return null
    if (geoAtual && geoAtual.estado !== 'a-ver') return geoAtual
    setGeo({ chave: chaveMorada, estado: 'a-ver' })
    const pos = await localizar({ morada: form.morada, localidade: form.localidade, cp: form.cp })
    let r
    if (!pos) r = { chave: chaveMorada, estado: 'sem-mapa' }
    else {
      const km = distanciaKm(regrasEntrega.origem, pos)
      const taxa = taxaPara(km, regrasEntrega.faixas)
      r = { chave: chaveMorada, estado: taxa === null ? 'fora' : 'ok', km, taxa, lat: pos.lat, lng: pos.lng }
    }
    setGeo(r)
    return r
  }

  const passos = passosPara(form.tipo, escolheLocal)
  const idx = Math.max(0, passos.indexOf(passo))
  const { nome, telefone, tipo, morada, localidade, cp, local } = form

  useEffect(() => {
    gravarContacto({ nome, telefone, tipo, morada, localidade, cp, local })
  }, [nome, telefone, tipo, morada, localidade, cp, local])

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
    corpo.current?.scrollTo({ top: 0 })
  }, [passo])

  useEffect(() => () => clearTimeout(timer.current), [])

  // As ilustrações de levantar/entrega já vêm a carregar enquanto se revê o pedido.
  useEffect(() => {
    for (const op of RECEBER) if (op.imagem) new Image().src = op.imagem
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onFechar])

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  const txtLevantar = localEscolhido
    ? descLocal(localEscolhido)
    : cardapio?.negocio?.instrucoesLevantamento || FALLBACK_LEVANTAR
  const txtEntrega = cardapio?.negocio?.instrucoesEntrega || FALLBACK_ENTREGA

  function irPara(alvo, { tipoAgora = form.tipo, som = true } = {}) {
    clearTimeout(timer.current)
    const lista = passosPara(tipoAgora, escolheLocal)
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
    if (form.tipo === 'levantar' && semLevantamento) {
      return ['receber', 'De momento não temos levantamento. Escolhe a entrega.']
    }
    if (form.tipo === 'levantar' && Array.isArray(locais) && !localEscolhido) {
      return [escolheLocal ? 'local' : 'receber', 'Escolhe onde vens buscar.']
    }
    if (!form.data || form.data < hoje) return ['quando', 'Escolhe o dia em que queres os cookies.']
    if (!horaValida) return ['quando', 'Escolhe a hora (essa já não dá tempo de preparar).']
    if (form.tipo === 'entrega' && semMorada()) return ['morada', semMorada()]
    if (semContacto()) return ['contacto', semContacto()]
    if (!form.pagamento) return ['pagar', 'Escolhe como preferes pagar.']
    return null
  }

  // ── escolhas de um toque ────────────────────────────────────────────────
  function escolherTipo(t) {
    toquePasso()
    setForm((f) => ({ ...f, tipo: t }))
    depois(t === 'levantar' && escolheLocal ? 'local' : 'quando', t)
  }
  function escolherLocal(id) {
    toquePasso()
    setForm((f) => ({ ...f, local: id }))
    depois('quando')
  }
  /** O dia não avança sozinho: a seguir escolhe-se a faixa de horário. */
  function escolherDia(iso) {
    toquePasso()
    setOutroDia(false)
    setForm((f) => ({ ...f, data: iso, hora: '' }))
  }
  function escolherHora(hora) {
    toquePasso()
    setForm((f) => ({ ...f, hora }))
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
    if (passo === 'receber') {
      if (form.tipo === 'levantar' && semLevantamento) return setErro('De momento não temos levantamento. Escolhe a entrega.')
      return irPara(form.tipo === 'levantar' && escolheLocal ? 'local' : 'quando')
    }
    if (passo === 'local') {
      return localEscolhido ? irPara('quando') : setErro('Escolhe onde vens buscar.')
    }
    if (passo === 'quando') {
      if (!form.data || form.data < hoje) return setErro('Escolhe o dia em que queres os cookies.')
      if (!horaValida) return setErro('Escolhe a hora.')
      return irPara(form.tipo === 'entrega' ? 'morada' : 'contacto')
    }
    if (passo === 'morada') {
      const p = semMorada()
      if (p) return setErro(p)
      // com taxa por distância, só avança depois de saber quanto custa (ou que não chegamos lá)
      calcularEntrega().then((r) => {
        if (r?.estado === 'fora') {
          setErro(`Ainda não entregamos tão longe (cerca de ${fmtKm(r.km)}). Podes voltar e escolher levantar.`)
        } else {
          irPara('contacto')
        }
      })
      return undefined
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
      // com um só local ligado, ele é o escolhido mesmo sem toque
      const g = form.tipo === 'entrega' ? await calcularEntrega() : null
      const resposta = await onEnviar({
        ...form,
        local: localEscolhido?.id ?? '',
        lat: g?.estado === 'ok' ? g.lat : undefined,
        lng: g?.estado === 'ok' ? g.lng : undefined,
        cupom: cupom?.codigo ?? '',
      })
      if (!resposta?.ok) {
        let alvo = resposta?.esgotado ? 'pedido' : PASSO_DO_CAMPO[resposta?.campo]
        if (alvo === 'local' && !escolheLocal) alvo = 'receber'
        if (resposta?.campo === 'cupom') setCupom(null)
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
  else if (passo === 'local' && localEscolhido) cta = { rotulo: 'Continuar' }
  else if (passo === 'quando' && form.data && horaValida) cta = { rotulo: 'Continuar' }
  else if (passo === 'morada' && geoAtual?.estado === 'a-ver') cta = { rotulo: 'A calcular a distância…', off: true }
  else if (passo === 'morada' || passo === 'contacto') cta = { rotulo: 'Continuar' }
  else if (passo === 'pagar' && form.pagamento) cta = { rotulo: 'Continuar' }
  else if (passo === 'confirmar') {
    cta = { rotulo: enviando ? 'A enviar…' : `Fazer pedido · ${fmtEuro(totalFinal)}`, off: enviando, final: true }
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
                        aberta={l.tipo === 'caixa' && caixaAberta === l.inicio}
                        onAlternar={() => setCaixaAberta((a) => (a === l.inicio ? null : l.inicio))}
                        onTirarDaCaixa={onTirarDaCaixa}
                        onEscolherOutro={onFechar}
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
                {semLevantamento && (
                  <p className="passo-sub">De momento só fazemos entregas.</p>
                )}
                <div className={opcoesReceber.length > 1 ? 'opcoes opcoes-2' : 'opcoes'}>
                  {opcoesReceber.map((op) => (
                    <Opcao
                      key={op.id}
                      ativo={form.tipo === op.id}
                      icone={op.icone}
                      imagem={op.imagem}
                      titulo={op.titulo}
                      nota={op.nota}
                      onClick={() => escolherTipo(op.id)}
                    />
                  ))}
                </div>
                {form.tipo && !(form.tipo === 'levantar' && (escolheLocal || semLevantamento)) && (
                  <p className="passo-info">{form.tipo === 'levantar' ? txtLevantar : txtEntrega}</p>
                )}
              </>
            )}

            {passo === 'local' && (
              <>
                <h2 ref={titulo} tabIndex={-1} className="passo-titulo">Onde vens buscar?</h2>
                <div className="opcoes">
                  {(locais ?? []).map((l) => (
                    <Opcao
                      key={l.id}
                      linha
                      ativo={localEscolhido?.id === l.id}
                      icone="📍"
                      titulo={l.nome}
                      nota={[l.morada, l.notas].filter(Boolean).join(' · ')}
                      onClick={() => escolherLocal(l.id)}
                    />
                  ))}
                </div>
              </>
            )}

            {passo === 'quando' && (
              <>
                <h2 ref={titulo} tabIndex={-1} className="passo-titulo">Para quando?</h2>
                <p className="passo-sub">
                  {form.tipo === 'entrega'
                    ? 'O dia em que te levamos os cookies.'
                    : `O dia em que vens buscar${localEscolhido ? ` · ${localEscolhido.nome}` : ''}.`}
                </p>
                <div className="dias">
                  {diasComHora.map((d) => (
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
                {outroDia || (form.data && !diasComHora.some((d) => d.iso === form.data)) ? (
                  <label className="block mt-4">
                    <span className="bfy-label">Outro dia</span>
                    <input
                      className="bfy-input" type="date" min={hoje}
                      value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value, hora: '' }))}
                    />
                  </label>
                ) : (
                  <button type="button" className="passo-link" onClick={() => setOutroDia(true)}>
                    Outro dia…
                  </button>
                )}

                {form.data && (faixas.length > 0 ? (
                  <div className="horas-bloco">
                    <p className="bfy-label">A que horas?</p>
                    <div className="horas" role="group" aria-label="Faixa de horário">
                      {faixas.map((f) => (
                        <button
                          key={f.hora}
                          type="button"
                          className="hora"
                          aria-pressed={form.hora === f.hora}
                          onClick={() => escolherHora(f.hora)}
                        >
                          {f.rotulo}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="passo-info">Nesse dia já não há horas disponíveis. Escolhe outro dia.</p>
                ))}
              </>
            )}

            {passo === 'morada' && (
              <>
                <h2 ref={titulo} tabIndex={-1} className="passo-titulo">Onde entregamos?</h2>
                <p className="passo-sub">{txtEntrega}</p>
                {regrasEntrega && (
                  <ul className="faixas-entrega" aria-label="Taxa de entrega">
                    {regrasEntrega.faixas.map((f, i) => (
                      <li key={i}>
                        Até {f.ateKm.toString().replace('.', ',')} km ·{' '}
                        <b>{f.preco > 0 ? fmtEuro(f.preco) : 'grátis'}</b>
                      </li>
                    ))}
                  </ul>
                )}
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
                {regrasEntrega && geoAtual?.estado === 'ok' && (
                  <p className="passo-info">
                    Fica a cerca de {fmtKm(geoAtual.km)} · entrega{' '}
                    <b>{geoAtual.taxa > 0 ? fmtEuro(geoAtual.taxa) : 'grátis'}</b>
                  </p>
                )}
                {regrasEntrega && geoAtual?.estado === 'sem-mapa' && (
                  <p className="passo-info">Não encontrámos esta morada no mapa — confirmamos a taxa de entrega contigo.</p>
                )}
                {regrasEntrega && (
                  <p className="mapa-credito">Distância em linha reta · mapa © OpenStreetMap</p>
                )}
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
                entrega={form.tipo === 'entrega' && regrasEntrega ? geoAtual : null}
                taxaEntrega={taxaEntrega}
                cupom={cupom}
                desconto={desconto}
                totalFinal={totalFinal}
                onCupom={setCupom}
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

function Opcao({ ativo, icone, imagem, titulo, nota, onClick, linha }) {
  return (
    <button
      type="button"
      className={linha ? 'opcao opcao-linha' : 'opcao'}
      aria-pressed={ativo}
      onClick={onClick}
    >
      {imagem
        ? <img className="opcao-img" src={imagem} alt="" draggable="false" />
        : <span className="opcao-icone" aria-hidden="true">{icone}</span>}
      <span className="opcao-txt">
        <span className="opcao-titulo">{titulo}</span>
        <span className="opcao-nota">{nota}</span>
      </span>
      {ativo && <span className="opcao-check" aria-hidden="true">✓</span>}
    </button>
  )
}

function Linha({
  l, cardapio, aberta, onAlternar, onTirarDaCaixa, onEscolherOutro,
  onTirarCaixa, onRepetirCaixa, podeRepetir, onAjustar, podeMais,
}) {
  if (l.tipo === 'caixa') {
    const painel = `caixa-${l.inicio}-cookies`
    return (
      <li className="linha linha-caixa" data-aberta={aberta}>
        <button
          type="button"
          className="linha-box-fotos"
          onClick={onAlternar}
          aria-expanded={aberta}
          aria-controls={painel}
          aria-label={aberta ? 'Fechar os cookies da Box' : 'Ver os cookies da Box'}
        >
          {l.ids.map((id, i) => {
            const src = findCookie(cardapio, id)?.image
            return src ? <img key={i} src={src} alt="" /> : <span key={i} />
          })}
        </button>
        <div className="linha-txt">
          <div className="linha-topo">
            <p className="linha-nome"><IconeBox size={14} /> {l.nome}</p>
            <span className="linha-preco bfy-num">{fmtEuro(l.subtotal)}</span>
          </div>
          <p className="linha-detalhe">{l.detalhe}</p>
          <div className="linha-acoes">
            <button
              type="button"
              className="linha-acao linha-acao-mudar"
              onClick={onAlternar}
              aria-expanded={aberta}
              aria-controls={painel}
            >
              Mudar <span className="linha-seta" aria-hidden="true">▾</span>
            </button>
            <button type="button" className="linha-acao" onClick={() => onTirarCaixa(l.inicio)}>Remover</button>
            <button
              type="button"
              className="linha-acao"
              disabled={!podeRepetir}
              onClick={() => onRepetirCaixa(l.inicio)}
            >
              + Repetir
            </button>
          </div>
        </div>

        {aberta && (
          <div id={painel} className="caixa-painel">
            <ul className="caixa-cookies">
              {l.ids.map((id, i) => {
                const c = findCookie(cardapio, id)
                return (
                  <li key={`${i}-${id}`} className="caixa-cookie">
                    <span className="caixa-cookie-prato">
                      {c?.image
                        ? <img src={c.image} alt="" />
                        : <span aria-hidden="true">{c?.emoji || '🍪'}</span>}
                    </span>
                    <span className="caixa-cookie-nome">{c?.short ?? id}</span>
                    <button
                      type="button"
                      className="caixa-cookie-tirar"
                      onClick={() => onTirarDaCaixa(l.inicio + i)}
                      aria-label={`Remover um ${c?.nome ?? 'cookie'} da Box`}
                    >×</button>
                  </li>
                )
              })}
            </ul>
            <p className="caixa-painel-dica">
              Remove o que não querias e{' '}
              <button type="button" className="caixa-painel-link" onClick={onEscolherOutro}>
                escolhe outro
              </button>
              .
            </p>
          </div>
        )}
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

function Confirmar({
  titulo, cardapio, resumo, form, txtLevantar, comNota, onComNota, onNotas, irPara,
  entrega, taxaEntrega, cupom, desconto, totalFinal, onCupom,
}) {
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
          titulo={`${form.tipo === 'entrega' ? 'Entrega' : 'Levantar'} · ${fmtData(form.data)}${form.hora ? ` · ${rotuloHora(form.hora)}` : ''}`}
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

      <Cupao cupom={cupom} desconto={desconto} onCupom={onCupom} />

      <div className="checkout-contas">
        {(desconto > 0 || entrega) && (
          <div className="checkout-conta">
            <span>Cookies</span>
            <span className="bfy-num">{fmtEuro(resumo.total)}</span>
          </div>
        )}
        {desconto > 0 && (
          <div className="checkout-conta checkout-conta-desconto">
            <span>Cupão {cupom.codigo} (−{cupom.percent}%)</span>
            <span className="bfy-num">−{fmtEuro(desconto)}</span>
          </div>
        )}
        {entrega && (
          <div className="checkout-conta">
            <span>Entrega{entrega.estado === 'ok' ? ` (${fmtKm(entrega.km)})` : ''}</span>
            <span className="bfy-num">
              {entrega.estado === 'ok' ? (taxaEntrega > 0 ? fmtEuro(taxaEntrega) : 'grátis') : 'a confirmar'}
            </span>
          </div>
        )}
      </div>

      <div className="checkout-total">
        <span>Total</span>
        <span className="bfy-num">{fmtEuro(totalFinal)}</span>
      </div>
    </>
  )
}

/** "Tenho um cupão": confirma o código no servidor e mostra o desconto. */
function Cupao({ cupom, desconto, onCupom }) {
  const [aberto, setAberto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [aVer, setAVer] = useState(false)

  async function aplicar(e) {
    e.preventDefault()
    if (!codigo.trim()) return
    setAVer(true)
    setErro('')
    try {
      const r = await validarCupom(codigo.trim())
      if (r?.ok) {
        onCupom({ codigo: r.codigo, percent: Number(r.percent) || 0 })
        setAberto(false)
        setCodigo('')
      } else {
        setErro(r?.motivo ?? 'Este cupão não é válido.')
      }
    } catch {
      setErro('Não conseguimos confirmar o cupão. Tenta outra vez.')
    } finally {
      setAVer(false)
    }
  }

  if (cupom) {
    return (
      <p className="cupao-aplicado">
        <span>🎟️ <b>{cupom.codigo}</b> · −{cupom.percent}% ({fmtEuro(desconto)})</span>
        <button type="button" className="passo-link" onClick={() => onCupom(null)}>Remover</button>
      </p>
    )
  }
  if (!aberto) {
    return (
      <button type="button" className="passo-link" onClick={() => setAberto(true)}>
        + Tenho um cupão
      </button>
    )
  }
  return (
    <form className="cupao-form" onSubmit={aplicar}>
      <input
        className="bfy-input"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        placeholder="Código do cupão"
        autoCapitalize="characters"
        autoComplete="off"
        autoFocus
        maxLength={30}
        aria-label="Código do cupão"
      />
      <button type="submit" className="btn-ghost" disabled={aVer || !codigo.trim()}>
        {aVer ? '…' : 'Aplicar'}
      </button>
      {erro && <p className="cupao-erro" role="alert">{erro}</p>}
    </form>
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
