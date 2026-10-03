import { useState } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'
import { localizarTexto } from '../loja/geo'
import { Icon } from './Icon'

/**
 * Taxa de entrega por distância (em linha reta) a partir da morada de partida.
 * Ex.: até 3 km grátis, até 7 km 3 €, mais longe não se entrega.
 * A loja mostra a taxa ao cliente e o servidor recalcula (supabase/loja.sql).
 */
const PADRAO = { ativo: false, origem: null, faixas: [{ ateKm: 3, preco: 0 }, { ateKm: 7, preco: 3 }] }

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function EntregaTaxa() {
  const { config, update } = useConfiguracoes()
  const disponivel = config.entregaDisponivel !== false
  const inicial = { ...PADRAO, ...(config.entregaConfig ?? {}) }

  const [ativo, setAtivo] = useState(!!inicial.ativo)
  const [morada, setMorada] = useState(inicial.origem?.morada ?? '')
  const [origem, setOrigem] = useState(inicial.origem?.lat != null ? inicial.origem : null)
  const [faixas, setFaixas] = useState(
    (inicial.faixas?.length ? inicial.faixas : PADRAO.faixas).map((f) => ({ ateKm: String(f.ateKm), preco: String(f.preco) })),
  )
  const [aProcurar, setAProcurar] = useState(false)
  const [msg, setMsg] = useState(null) // { tipo, texto }

  async function procurarMorada() {
    if (!morada.trim()) return
    setAProcurar(true)
    setMsg(null)
    const pos = await localizarTexto(morada)
    setAProcurar(false)
    if (pos) setOrigem({ morada: morada.trim(), ...pos })
    else setMsg({ tipo: 'erro', texto: 'Não encontrei esta morada no mapa. Experimenta com o código postal (ex.: 1700-001 Lisboa).' })
  }

  function guardar() {
    const limpas = faixas
      .map((f) => ({ ateKm: num(f.ateKm), preco: num(f.preco) ?? 0 }))
      .filter((f) => f.ateKm != null && f.ateKm > 0)
      .sort((a, b) => a.ateKm - b.ateKm)
    if (ativo && !origem) return setMsg({ tipo: 'erro', texto: 'Falta localizar a morada de partida.' })
    if (ativo && limpas.length === 0) return setMsg({ tipo: 'erro', texto: 'Põe pelo menos uma faixa de distância.' })
    if (limpas.some((f) => f.preco < 0)) return setMsg({ tipo: 'erro', texto: 'O preço não pode ser negativo.' })
    update({ entregaConfig: { ativo, origem: origem ? { ...origem, morada: origem.morada || morada.trim() } : null, faixas: limpas } })
    setFaixas(limpas.map((f) => ({ ateKm: String(f.ateKm), preco: String(f.preco) })))
    setMsg({ tipo: 'ok', texto: ativo ? 'Guardado. A loja já mostra a taxa de entrega.' : 'Guardado. A taxa está desligada.' })
  }

  const mudarFaixa = (i, campo, v) => setFaixas((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: v } : f)))
  const ultima = [...faixas].map((f) => num(f.ateKm)).filter((n) => n != null).sort((a, b) => a - b).pop()

  return (
    <div className="bfy-card p-6 mb-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold bfy-card-title">Taxa de entrega</h2>
        <button
          type="button"
          role="switch"
          aria-checked={ativo}
          disabled={!disponivel}
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
          style={{
            background: ativo ? 'rgba(90,158,133,0.15)' : 'var(--color-surface-sunk)',
            color: ativo ? 'var(--color-success)' : 'rgba(29,16,8,0.45)',
            border: '1px solid var(--line-1)',
          }}
          onClick={() => setAtivo((a) => !a)}
        >
          {ativo ? 'Ligada' : 'Desligada'}
        </button>
      </div>
      <p className="text-xs ink-3 -mt-2">
        Cobra a entrega conforme a distância (em linha reta) entre a vossa morada e a do cliente.
        Desligada, a entrega não tem taxa, como até agora.
      </p>

      {!disponivel ? (
        <p className="bfy-sunk p-3 text-sm ink-2">
          Para usar a taxa de entrega, corre o <code>supabase/loja.sql</code> atualizado no Supabase.
        </p>
      ) : (
        <>
          <div>
            <span className="bfy-label">Morada de partida</span>
            <div className="flex gap-2">
              <input
                className="bfy-input flex-1"
                value={morada}
                onChange={(e) => { setMorada(e.target.value); setOrigem(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); procurarMorada() } }}
                placeholder="Ex.: Rua X 10, 1700-001 Lisboa"
              />
              <button type="button" className="btn-ghost btn-sm shrink-0" disabled={aProcurar || !morada.trim()} onClick={procurarMorada}>
                {aProcurar ? 'A procurar…' : 'Localizar'}
              </button>
            </div>
            {origem ? (
              <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-success)' }}>
                <Icon name="check" size={13} /> Localizada.{' '}
                <a
                  className="underline"
                  href={`https://www.openstreetmap.org/?mlat=${origem.lat}&mlon=${origem.lng}#map=16/${origem.lat}/${origem.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver no mapa
                </a>
              </p>
            ) : (
              <p className="bfy-hint">Não aparece na loja — serve só para medir a distância.</p>
            )}
          </div>

          <div className="space-y-2">
            <span className="bfy-label">Faixas</span>
            {faixas.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm ink-2">
                <span className="shrink-0 w-8">Até</span>
                <input
                  className="bfy-input bfy-num text-center" style={{ width: '4.5rem' }}
                  inputMode="decimal" value={f.ateKm} aria-label={`Faixa ${i + 1}: até quantos km`}
                  onChange={(e) => mudarFaixa(i, 'ateKm', e.target.value)}
                />
                <span className="shrink-0">km →</span>
                <input
                  className="bfy-input bfy-num text-center" style={{ width: '4.5rem' }}
                  inputMode="decimal" value={f.preco} aria-label={`Faixa ${i + 1}: preço em euros`}
                  onChange={(e) => mudarFaixa(i, 'preco', e.target.value)}
                />
                <span className="shrink-0">€{(num(f.preco) ?? 0) === 0 ? ' (grátis)' : ''}</span>
                <button
                  type="button" className="btn-icon-sm ml-auto" aria-label={`Remover faixa ${i + 1}`}
                  onClick={() => setFaixas((fs) => fs.filter((_, j) => j !== i))}
                >
                  <Icon name="fechar" size={13} />
                </button>
              </div>
            ))}
            <button type="button" className="btn-ghost btn-sm" onClick={() => setFaixas((fs) => [...fs, { ateKm: '', preco: '' }])}>
              <Icon name="mais" size={13} /> Faixa
            </button>
            {ultima != null && (
              <p className="text-xs font-semibold" style={{ color: 'var(--color-accent-dark)' }}>
                Mais longe que {String(ultima).replace('.', ',')} km: não entregamos (o cliente pode escolher levantar).
              </p>
            )}
          </div>

          {msg && (
            <p className="text-sm font-semibold" style={{ color: msg.tipo === 'ok' ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {msg.texto}
            </p>
          )}
          <button type="button" className="btn-primary w-full py-2.5" onClick={guardar}>
            Guardar taxa de entrega
          </button>
        </>
      )}
    </div>
  )
}
