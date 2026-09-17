import { useEffect, useRef, useState } from 'react'
import { Aviso, Stepper } from './ui'
import { fmtEuro, linhasCarrinho, totalCarrinho, MINI_BOX_ID, TASTING_BOX_ID } from './util'
import { gravarContacto, lerContacto } from './storage'

const PAGAMENTOS = [
  { id: 'MB WAY', nota: 'Enviamos o pedido de pagamento.' },
  { id: 'Dinheiro', nota: 'Pagas no levantamento ou na entrega.' },
]

const hoje = () => {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const FALLBACK_LEVANTAR = 'Combinamos o sítio e a hora contigo por mensagem.'
const FALLBACK_ENTREGA = 'Entregamos na morada que indicares. Combinamos o horário contigo.'

/**
 * Uma folha: o pedido, como recebe, e como te chamamos.
 * Sem pagamento online. MB WAY ou dinheiro; combinam depois.
 */
export function Checkout({
  cardapio, cart, caixas, onFechar, onAjustarLinha, onPodeMais, onEnviar,
}) {
  const contacto = lerContacto()
  const [form, setForm] = useState({
    nome: contacto.nome,
    telefone: contacto.telefone,
    tipo: contacto.tipo,
    data: '',
    morada: '',
    localidade: '',
    cp: '',
    pagamento: '',
    notas: '',
  })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const topo = useRef(null)

  const linhas = linhasCarrinho(cardapio, cart, caixas)
  const total = totalCarrinho(linhas)
  const size = cardapio.box.size
  const nAvulsos = Object.entries(cart)
    .filter(([id, q]) => q > 0 && id !== MINI_BOX_ID && id !== TASTING_BOX_ID)
    .reduce((s, [, q]) => s + q, 0)

  useEffect(() => {
    gravarContacto({ nome: form.nome, telefone: form.telefone, tipo: form.tipo })
  }, [form.nome, form.telefone, form.tipo])

  useEffect(() => {
    if (erro) topo.current?.querySelector('[role=alert]')?.scrollIntoView({ block: 'center' })
  }, [erro])

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  function validar() {
    if (linhas.length === 0) return 'O pedido está vazio.'
    if (form.tipo !== 'levantar' && form.tipo !== 'entrega') {
      return 'Diz-nos se preferes levantar ou receber em casa.'
    }
    if (!form.data) return 'Escolhe o dia em que queres os cookies.'
    if (form.tipo === 'entrega') {
      if (form.morada.trim().length < 4) return 'Indica a morada de entrega.'
      if (form.localidade.trim().length < 2) return 'Indica a localidade.'
    }
    if (form.nome.trim().length < 2) return 'Diz-nos o teu nome.'
    if (form.telefone.replace(/\D/g, '').length < 6) return 'Precisamos de um telemóvel para confirmar o pedido.'
    if (!form.pagamento) return 'Escolhe uma forma de pagamento.'
    return ''
  }

  async function submeter(e) {
    e.preventDefault()
    const motivo = validar()
    if (motivo) {
      setErro(motivo)
      return
    }
    setErro('')
    setEnviando(true)
    try {
      const resposta = await onEnviar(form)
      if (!resposta?.ok) setErro(resposta?.motivo ?? 'Não conseguimos registar o pedido.')
    } catch (err) {
      console.error(err)
      setErro('Falhou a ligação. Verifica a internet e tenta outra vez.')
    } finally {
      setEnviando(false)
    }
  }

  const txtLevantar = cardapio?.negocio?.instrucoesLevantamento || FALLBACK_LEVANTAR
  const txtEntrega = cardapio?.negocio?.instrucoesEntrega || FALLBACK_ENTREGA

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <form
        className="sheet"
        ref={topo}
        role="dialog"
        aria-modal="true"
        aria-label="O teu pedido"
        onSubmit={submeter}
      >
        <div className="sheet-head">
          <h2 className="bfy-title text-xl">O teu pedido</h2>
          <button type="button" className="btn-icon" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        <div className="p-5 space-y-6">
          {linhas.length === 0 ? (
            <p className="text-sm ink-2">O pedido está vazio.</p>
          ) : (
            <ul className="space-y-2">
              {linhas.map((l) => (
                <li key={l.key} className="bfy-card p-3.5 flex items-center gap-3">
                  <LinhaFoto linha={l} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold ink-1">{l.nome}</p>
                    <p className="text-xs ink-3 truncate">{l.detalhe}</p>
                  </div>
                  <Stepper
                    qty={l.qty}
                    label={l.nome}
                    onMenos={() => onAjustarLinha(l, -1)}
                    onMais={() => onAjustarLinha(l, 1)}
                    podeMais={onPodeMais(l)}
                  />
                  <span className="bfy-num text-sm font-black shrink-0" style={{ color: 'var(--color-accent-dark)' }}>
                    {fmtEuro(l.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {nAvulsos >= size && caixas.length === 0 && (
            <p className="loja-nota">Numa Box de {size} fica mais em conta.</p>
          )}

          <div className="flex items-center justify-between">
            <span className="font-bold ink-2">Total</span>
            <span className="bfy-num font-black text-2xl" style={{ color: 'var(--color-accent-dark)' }}>
              {fmtEuro(total)}
            </span>
          </div>

          <fieldset>
            <legend className="bfy-label">Como preferes receber? *</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'levantar', titulo: 'Levantar', nota: 'Combinamos o sítio' },
                { id: 'entrega', titulo: 'Entrega', nota: 'À tua morada' },
              ].map((op) => (
                <label
                  key={op.id}
                  className="bfy-card p-3.5 cursor-pointer text-center"
                  style={form.tipo === op.id
                    ? { borderColor: 'var(--color-accent-dark)', boxShadow: '0 0 0 3px rgba(154,59,28,0.13)' }
                    : undefined}
                >
                  <input
                    type="radio" name="tipo" value={op.id} className="sr-only"
                    checked={form.tipo === op.id}
                    onChange={set('tipo')}
                  />
                  <span className="block text-sm font-bold ink-1">{op.titulo}</span>
                  <span className="block text-xs ink-3 mt-0.5">{op.nota}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {form.tipo === 'levantar' && <p className="text-sm ink-2">{txtLevantar}</p>}
          {form.tipo === 'entrega' && <p className="text-sm ink-2">{txtEntrega}</p>}

          <label className="block">
            <span className="bfy-label">Para que dia? *</span>
            <input
              className="bfy-input" type="date" min={hoje()}
              value={form.data} onChange={set('data')}
            />
          </label>

          {form.tipo === 'entrega' && (
            <>
              <label className="block">
                <span className="bfy-label">Morada *</span>
                <input
                  className="bfy-input" maxLength={160}
                  value={form.morada} onChange={set('morada')}
                  placeholder="Rua, número, andar"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block col-span-2 sm:col-span-1">
                  <span className="bfy-label">Localidade *</span>
                  <input
                    className="bfy-input" maxLength={80}
                    value={form.localidade} onChange={set('localidade')}
                    placeholder="Lisboa"
                  />
                </label>
                <label className="block col-span-2 sm:col-span-1">
                  <span className="bfy-label">Código postal</span>
                  <input
                    className="bfy-input" maxLength={12}
                    value={form.cp} onChange={set('cp')}
                    placeholder="1000-000"
                  />
                </label>
              </div>
            </>
          )}

          <label className="block">
            <span className="bfy-label">Nome *</span>
            <input
              className="bfy-input" maxLength={80}
              value={form.nome} onChange={set('nome')} placeholder="Como te chamas?"
            />
          </label>

          <label className="block">
            <span className="bfy-label">Telemóvel *</span>
            <input
              className="bfy-input" type="tel" inputMode="tel" maxLength={40}
              value={form.telefone} onChange={set('telefone')} placeholder="+351 912 345 678"
            />
            <span className="bfy-hint">É por aqui que confirmamos o pedido contigo.</span>
          </label>

          <fieldset>
            <legend className="bfy-label">Como preferes pagar? *</legend>
            <p className="text-xs ink-3 mb-2">Não pagas agora. Combinamos contigo.</p>
            <div className="space-y-2">
              {PAGAMENTOS.map((p) => (
                <label
                  key={p.id}
                  className="bfy-card p-3.5 flex items-center gap-3 cursor-pointer"
                  style={form.pagamento === p.id
                    ? { borderColor: 'var(--color-accent-dark)', boxShadow: '0 0 0 3px rgba(154,59,28,0.13)' }
                    : undefined}
                >
                  <input
                    type="radio" name="pagamento" value={p.id}
                    checked={form.pagamento === p.id}
                    onChange={set('pagamento')}
                    className="accent-[var(--color-accent-dark)] w-4 h-4"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold ink-1">{p.id}</span>
                    <span className="block text-xs ink-3">{p.nota}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="bfy-label">Alguma nota?</span>
            <textarea
              className="bfy-input" rows={2} maxLength={400}
              value={form.notas} onChange={set('notas')}
              placeholder="Alergias, ocasião, pormenor da entrega…"
            />
          </label>

          {erro && <Aviso>{erro}</Aviso>}

          <button type="submit" className="btn-primary btn-block py-3" disabled={enviando || linhas.length === 0}>
            {enviando ? 'A enviar…' : 'Fazer pedido'}
          </button>
          <button type="button" className="btn-ghost btn-block" onClick={onFechar}>
            Escolher mais
          </button>
        </div>
      </form>
    </div>
  )
}

function LinhaFoto({ linha }) {
  if (linha.image) {
    return <img className="linha-foto" src={linha.image} alt="" />
  }
  return <span className="linha-foto linha-foto-vazia" aria-hidden="true" />
}
