import { useEffect, useRef, useState } from 'react'
import { Aviso } from './ui'
import { fmtEuro, linhasCarrinho, totalCarrinho } from './util'

const PAGAMENTOS = [
  { id: 'MB WAY',     emoji: '📱', nota: 'Enviamos o pedido de pagamento' },
  { id: 'Multibanco', emoji: '🏧', nota: 'Enviamos referência ou IBAN' },
  { id: 'Dinheiro',   emoji: '💶', nota: 'Pagas na entrega ou levantamento' },
]

const hoje = () => new Date().toISOString().slice(0, 10)

/**
 * Painel do pedido em dois passos: rever o que se escolheu e deixar contacto.
 * Sem pagamento online — a irmã confirma pelo telemóvel e combina a entrega.
 */
export function Checkout({ cardapio, cart, caixas, onFechar, onRemoverLinha, onEnviar }) {
  const [passo, setPasso] = useState('resumo')
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '',
    entrega: '', pagamento: '', notas: '',
  })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const topo = useRef(null)

  const linhas = linhasCarrinho(cardapio, cart, caixas)
  const total = totalCarrinho(linhas)

  useEffect(() => { topo.current?.scrollTo({ top: 0 }) }, [passo])

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  async function submeter(e) {
    e.preventDefault()
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

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div className="sheet" ref={topo} role="dialog" aria-modal="true" aria-label="O teu pedido">
        <div className="sheet-head">
          <div>
            <p className="bfy-eyebrow">{passo === 'resumo' ? 'Passo 3' : 'Último passo'}</p>
            <h2 className="bfy-title text-xl">
              {passo === 'resumo' ? 'O teu pedido' : 'Onde te encontramos'}
            </h2>
          </div>
          <button type="button" className="btn-icon" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        {passo === 'resumo' ? (
          <div className="p-5 space-y-4">
            <ul className="space-y-2">
              {linhas.map((l) => (
                <li key={l.key} className="bfy-card p-3.5 flex items-center gap-3">
                  <span className="text-xl" aria-hidden="true">{l.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold ink-1">
                      {l.qty > 1 && <span className="bfy-num">{l.qty}× </span>}{l.nome}
                    </p>
                    <p className="text-xs ink-3 truncate">{l.detalhe}</p>
                  </div>
                  <span className="bfy-num text-sm font-black" style={{ color: 'var(--color-accent-dark)' }}>
                    {fmtEuro(l.subtotal)}
                  </span>
                  <button
                    type="button"
                    className="btn-icon btn-icon-danger"
                    onClick={() => onRemoverLinha(l)}
                    aria-label={`Tirar ${l.nome}`}
                  >✕</button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: 'var(--line-1)' }}>
              <span className="font-bold ink-2">Total</span>
              <span className="bfy-num font-black text-2xl" style={{ color: 'var(--color-accent-dark)' }}>
                {fmtEuro(total)}
              </span>
            </div>

            <button type="button" className="btn-primary btn-block py-3" onClick={() => setPasso('dados')}>
              Continuar
            </button>
            <button type="button" className="btn-ghost btn-block" onClick={onFechar}>
              Escolher mais cookies
            </button>
          </div>
        ) : (
          <form className="p-5 space-y-4" onSubmit={submeter}>
            <label className="block">
              <span className="bfy-label">Nome *</span>
              <input
                className="bfy-input" required autoFocus maxLength={80}
                value={form.nome} onChange={set('nome')} placeholder="Como te chamas?"
              />
            </label>

            <label className="block">
              <span className="bfy-label">Telemóvel *</span>
              <input
                className="bfy-input" required type="tel" inputMode="tel" maxLength={40}
                value={form.telefone} onChange={set('telefone')} placeholder="+351 912 345 678"
              />
              <span className="bfy-hint">É por aqui que confirmamos o pedido contigo.</span>
            </label>

            <label className="block">
              <span className="bfy-label">Quando queres?</span>
              <input
                className="bfy-input" type="date" min={hoje()}
                value={form.entrega} onChange={set('entrega')}
              />
            </label>

            <fieldset>
              <legend className="bfy-label">Como preferes pagar? *</legend>
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
                      type="radio" name="pagamento" value={p.id} required
                      checked={form.pagamento === p.id}
                      onChange={set('pagamento')}
                      className="accent-[var(--color-accent-dark)] w-4 h-4"
                    />
                    <span className="text-xl" aria-hidden="true">{p.emoji}</span>
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
                placeholder="Alergias, morada de entrega, ocasião…"
              />
            </label>

            {erro && <Aviso>{erro}</Aviso>}

            <div className="bfy-sunk p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-bold ink-2">Total</span>
                <span className="bfy-num font-black text-xl" style={{ color: 'var(--color-accent-dark)' }}>
                  {fmtEuro(total)}
                </span>
              </div>
              <p className="text-xs ink-3 mt-1">
                Não pagas nada agora — combinamos tudo contigo antes.
              </p>
            </div>

            <button type="submit" className="btn-primary btn-block py-3" disabled={enviando}>
              {enviando ? 'A enviar…' : 'Fazer pedido'}
            </button>
            <button type="button" className="btn-ghost btn-block" onClick={() => setPasso('resumo')}>
              Voltar ao resumo
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
