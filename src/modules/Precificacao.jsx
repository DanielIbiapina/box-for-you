import { useState, useMemo, useEffect } from 'react'
import { useReceitas } from '../stores/useReceitas'
import { useEstoque } from '../stores/useEstoque'

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
}

/** Painel reutilizável — página completa ou modal em Receitas */
export function PrecificacaoPanel({ embed = false, initialReceitaId = '', onClose }) {
  const { receitas } = useReceitas()
  const { ingredientes } = useEstoque()
  const [receitaId, setReceitaId] = useState(initialReceitaId)
  const [embalagem, setEmbalagem] = useState(0.5)
  const [taxaFeira, setTaxaFeira] = useState(0)
  const [outros, setOutros] = useState(0)
  const [margemDesejada, setMargemDesejada] = useState(40)
  const [precoManual, setPrecoManual] = useState('')

  useEffect(() => {
    if (initialReceitaId) setReceitaId(initialReceitaId)
  }, [initialReceitaId])

  const receita = receitas.find((r) => r.id === receitaId)

  const custoPorCookieIngredientes = useMemo(() => {
    if (!receita || !receita.rendimento) return 0
    let total = 0
    for (const ing of receita.ingredientes ?? []) {
      const ingEstoque = ing.ingredienteId
        ? ingredientes.find((i) => i.id === ing.ingredienteId)
        : null
      if (ingEstoque && ingEstoque.custoPorUnidade) {
        total += ingEstoque.custoPorUnidade * (ing.quantidade ?? 0)
      }
    }
    return total / receita.rendimento
  }, [receita, ingredientes])

  const rendimento = receita?.rendimento || 1
  const custosExtras =
    parseFloat(embalagem) +
    parseFloat(taxaFeira) / rendimento +
    parseFloat(outros)
  const custoTotal = custoPorCookieIngredientes + custosExtras
  const precoSugerido =
    margemDesejada > 0 && margemDesejada < 100
      ? custoTotal / (1 - margemDesejada / 100)
      : custoTotal
  const precoFinal = precoManual !== '' ? parseFloat(precoManual) || 0 : precoSugerido
  const margemReal = precoFinal > 0 ? ((precoFinal - custoTotal) / precoFinal) * 100 : 0
  const lucroUnitario = precoFinal - custoTotal
  const lucroReceita = lucroUnitario * (receita?.rendimento ?? 0)

  const rows = [
    {
      label: 'Custo dos ingredientes (por cookie)',
      value: custoPorCookieIngredientes,
      note: custoPorCookieIngredientes === 0 ? 'liga ingredientes ao estoque na receita' : '',
    },
    { label: 'Embalagem (por cookie)', value: parseFloat(embalagem) || 0 },
    {
      label: 'Taxa de feira (por cookie)',
      value: (parseFloat(taxaFeira) || 0) / rendimento,
      note: 'taxa total da feira ÷ rendimento',
    },
    { label: 'Outros custos (por cookie)', value: parseFloat(outros) || 0 },
    { label: 'Custo total por cookie', value: custoTotal, bold: true },
    { label: 'Preço de venda sugerido', value: precoFinal, bold: true, accent: true },
    { label: 'Lucro por cookie', value: lucroUnitario, bold: true, green: lucroUnitario > 0 },
    {
      label: `Lucro por fornada (${receita?.rendimento ?? '—'} cookies)`,
      value: lucroReceita,
      bold: true,
    },
  ]

  return (
    <div className={embed ? 'space-y-4' : 'p-4 md:p-6 max-w-3xl mx-auto pb-10'}>
      {!embed && (
        <>
          <h1
            className="text-3xl font-black mb-2"
            style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}
          >
            Análise financeira
          </h1>
          <p className="text-sm mb-6 opacity-55" style={{ color: 'var(--color-text)' }}>
            Calcula custo real por cookie a partir da receita, embalagem e taxas de feira.
          </p>
        </>
      )}

      {embed && (
        <p className="text-sm opacity-60 -mt-1 mb-2" style={{ color: 'var(--color-text)' }}>
          Simula quanto custa produzir e vender cada cookie desta receita.
        </p>
      )}

      {receitas.length === 0 ? (
        <div className="bfy-card p-10 text-center">
          <span className="text-5xl block mb-3">📚</span>
          <p className="text-base font-semibold" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
            Cadastre receitas e ingredientes com custo no estoque.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bfy-card p-5">
            <label className="block">
              <span className="bfy-label">Receita a analisar</span>
              <select
                className="bfy-input"
                value={receitaId}
                onChange={(e) => setReceitaId(e.target.value)}
              >
                <option value="">— Escolher receita —</option>
                {receitas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.emoji ?? '🍪'} {r.nome} (rende {r.rendimento})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {receitaId && (
            <>
              <div className="bfy-card p-5 space-y-3">
                <h2
                  className="text-sm font-bold"
                  style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}
                >
                  Custos extra (além dos ingredientes)
                </h2>
                <p className="text-xs opacity-50 -mt-1" style={{ color: 'var(--color-text)' }}>
                  Valores por cookie, exceto a taxa de feira que se divide pelo rendimento da receita.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Embalagem por cookie (€)', val: embalagem, set: setEmbalagem },
                    { label: 'Taxa total da feira (€)', val: taxaFeira, set: setTaxaFeira },
                    { label: 'Outros custos (€)', val: outros, set: setOutros },
                  ].map(({ label, val, set }) => (
                    <label key={label} className="block">
                      <span className="bfy-label">{label}</span>
                      <input
                        className="bfy-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={val}
                        onChange={(e) => set(parseFloat(e.target.value) || 0)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="bfy-card p-5">
                <h2
                  className="text-sm font-bold mb-4"
                  style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}
                >
                  Margem de lucro desejada
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="bfy-label">Margem alvo (%)</span>
                    <div className="flex items-center gap-3">
                      <input
                        className="bfy-input flex-1"
                        type="range"
                        min="0"
                        max="90"
                        value={margemDesejada}
                        onChange={(e) => {
                          setMargemDesejada(parseInt(e.target.value))
                          setPrecoManual('')
                        }}
                        style={{ padding: '0.5rem 0' }}
                      />
                      <span
                        className="font-black text-lg w-14 text-center"
                        style={{ color: 'var(--color-accent-dark)' }}
                      >
                        {margemDesejada}%
                      </span>
                    </div>
                  </label>
                  <label className="block">
                    <span className="bfy-label">Preço manual (opcional)</span>
                    <input
                      className="bfy-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={precoManual}
                      onChange={(e) => setPrecoManual(e.target.value)}
                      placeholder={precoSugerido.toFixed(2)}
                    />
                  </label>
                </div>
              </div>

              <div className="bfy-card p-5 overflow-x-auto">
                <h2
                  className="text-sm font-bold mb-4"
                  style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}
                >
                  Resumo
                </h2>
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom:
                            i < rows.length - 1 ? '1px solid rgba(61,43,31,0.08)' : 'none',
                          background: row.accent ? 'rgba(242,181,160,0.15)' : 'transparent',
                        }}
                      >
                        <td
                          className={`py-2.5 px-3 ${row.bold ? 'font-bold' : ''}`}
                          style={{ color: 'var(--color-text)', opacity: row.bold ? 1 : 0.7 }}
                        >
                          {row.label}
                          {row.note && (
                            <span className="ml-2 text-xs opacity-50">({row.note})</span>
                          )}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right tabular-nums ${row.bold ? 'font-black text-base' : 'font-semibold'}`}
                          style={{
                            color: row.accent
                              ? 'var(--color-accent-dark)'
                              : row.green
                                ? 'var(--color-success)'
                                : 'var(--color-text)',
                          }}
                        >
                          {fmtBRL(row.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div
                  className="mt-4 rounded-2xl p-4 flex items-center gap-4"
                  style={{
                    background:
                      margemReal >= 30 ? 'rgba(139,184,168,0.2)' : 'rgba(232,201,154,0.3)',
                  }}
                >
                  <span className="text-3xl">{margemReal >= 30 ? '🎉' : '⚠️'}</span>
                  <div>
                    <p className="font-black text-lg" style={{ color: 'var(--color-text)' }}>
                      Margem real: {margemReal.toFixed(1)}%
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
                      {margemReal >= 30
                        ? 'Ótima margem para vender!'
                        : margemReal > 0
                          ? 'Margem abaixo de 30% — considera subir o preço.'
                          : 'Prejuízo — revê custos ou preço de venda.'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {embed && onClose && (
            <div className="flex justify-end pt-2">
              <button type="button" className="btn-ghost px-5 py-2.5" onClick={onClose}>
                Fechar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Rota legada — mantida por compatibilidade */
export function Precificacao() {
  return <PrecificacaoPanel />
}
