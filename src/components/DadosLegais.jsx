import { useState } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'

/** NIF português: 9 dígitos e o último é o dígito de controlo. */
function nifValido(nif) {
  const d = String(nif).replace(/\s/g, '')
  if (!/^\d{9}$/.test(d)) return false
  const soma = [...d.slice(0, 8)].reduce((s, c, i) => s + Number(c) * (9 - i), 0)
  const controlo = 11 - (soma % 11)
  return (controlo >= 10 ? 0 : controlo) === Number(d[8])
}

const CAMPOS = [
  { id: 'nome', rotulo: 'Nome completo ou firma', dica: 'Quem vende: o teu nome completo (ou o da empresa).', max: 120 },
  { id: 'nif', rotulo: 'NIF', dica: '9 dígitos.', max: 11, numerico: true },
  { id: 'morada', rotulo: 'Morada', dica: 'A morada fiscal ou da cozinha, com código postal e localidade.', max: 200 },
  { id: 'telefone', rotulo: 'Telefone / WhatsApp', max: 30 },
  { id: 'email', rotulo: 'Email', dica: 'Opcional, mas ajuda: é o contacto que as pessoas esperam encontrar.', max: 120 },
]

/**
 * Dados legais do vendedor, que a loja mostra no rodapé e na página
 * Informação legal (crumblabcookies.com/legal/). São exigidos pela lei do
 * comércio eletrónico e pela Ifthenpay. Vão para configuracao.loja_legal.
 */
export function DadosLegais() {
  const { config, update } = useConfiguracoes()
  const [form, setForm] = useState(() => ({ nome: '', nif: '', morada: '', telefone: '', email: '', ...(config.legal ?? {}) }))
  const [msg, setMsg] = useState(null)

  if (config.legalDisponivel === false) {
    return (
      <div className="bfy-card p-6 mb-5">
        <h2 className="text-base font-bold bfy-card-title">Dados legais</h2>
        <p className="bfy-sunk p-3 mt-3 text-sm ink-2">
          Para preencher, corre o <code>supabase/loja.sql</code> atualizado no Supabase.
        </p>
      </div>
    )
  }

  const set = (id) => (e) => { setMsg(null); setForm((f) => ({ ...f, [id]: e.target.value })) }

  function guardar() {
    const limpo = Object.fromEntries(CAMPOS.map(({ id }) => [id, String(form[id] ?? '').trim()]))
    limpo.nif = limpo.nif.replace(/\s/g, '')
    if (limpo.nif && !nifValido(limpo.nif)) return setMsg({ tipo: 'erro', texto: 'Esse NIF não é válido. Confirma os 9 dígitos.' })
    if (limpo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo.email)) return setMsg({ tipo: 'erro', texto: 'Esse email não parece certo.' })
    update({ legal: limpo })
    const falta = ['nome', 'nif', 'morada', 'telefone'].filter((id) => !limpo[id])
    setMsg(falta.length
      ? { tipo: 'aviso', texto: `Guardado. Ainda falta: ${falta.map((id) => CAMPOS.find((c) => c.id === id).rotulo).join(', ')}.` }
      : { tipo: 'ok', texto: 'Guardado. A loja já mostra estes dados.' })
  }

  const cor = { ok: 'var(--color-success)', erro: 'var(--color-danger)', aviso: 'var(--color-warning)' }

  return (
    <div className="bfy-card p-6 mb-5 space-y-4">
      <div>
        <h2 className="text-base font-bold bfy-card-title">Dados legais</h2>
        <p className="text-xs ink-3 mt-1">
          Aparecem no rodapé da loja e na página <a className="underline" href="/legal/" target="_blank" rel="noreferrer">Informação legal</a>,
          com os termos, as entregas e devoluções e a privacidade. A lei e a Ifthenpay pedem nome, NIF, morada e contactos.
        </p>
      </div>
      {CAMPOS.map((c) => (
        <label key={c.id} className="block">
          <span className="bfy-label">{c.rotulo}</span>
          <input
            className="bfy-input"
            value={form[c.id] ?? ''}
            maxLength={c.max}
            inputMode={c.numerico ? 'numeric' : undefined}
            onChange={set(c.id)}
          />
          {c.dica && <span className="bfy-hint">{c.dica}</span>}
        </label>
      ))}
      {msg && <p className="text-sm font-semibold" style={{ color: cor[msg.tipo] }}>{msg.texto}</p>}
      <button type="button" className="btn-primary w-full py-2.5" onClick={guardar}>Guardar dados legais</button>
    </div>
  )
}
