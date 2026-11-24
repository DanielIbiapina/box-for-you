import { useState } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'

const fmtEuro = (v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0)

/** "2026-11-27T19:00" → "sex, 27/11 às 19h" */
function fmtQuando(iso) {
  if (!iso) return '—'
  const d = new Date(`${String(iso).slice(0, 16)}:00`)
  if (Number.isNaN(d.getTime())) return iso
  const dia = d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
  return `${dia} às ${d.getHours()}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, '0') : ''}`
}
const fmtDia = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) : '—')

/**
 * Black Crumb em Definições: ligar/desligar a aba da loja e ver as regras.
 * As regras (datas, combos, preços) estão em configuracao.loja_black — ver
 * supabase/loja.sql. O servidor é que as aplica; isto só as mostra.
 */
export function BlackCrumbAdmin() {
  const { config, update } = useConfiguracoes()
  const [agora] = useState(() => Date.now())
  const b = config.black ?? {}
  if (config.blackDisponivel === false) {
    return (
      <div className="bfy-card p-6 mb-5">
        <h2 className="text-base font-bold bfy-card-title">Black Crumb</h2>
        <p className="bfy-sunk p-3 mt-3 text-sm ink-2">
          Para ligar a Black Crumb, corre o <code>supabase/loja.sql</code> atualizado no Supabase.
        </p>
      </div>
    )
  }
  if (!b.combos) return null

  const ativo = b.ativo === true
  const fim = b.fim ? new Date(`${String(b.fim).slice(0, 16)}:00`) : null
  const acabou = fim && fim.getTime() < agora

  return (
    <div className="bfy-card p-6 mb-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold bfy-card-title">🖤 Black Crumb</h2>
          <p className="text-xs ink-3 mt-1">
            Aba própria na loja com os combos. Pagamento só por MB WAY, na hora. Os sabores estão sempre
            disponíveis: o stock desconta e pode ficar negativo — é o que falta fazer.
          </p>
        </div>
        <button
          type="button"
          className={ativo ? 'btn-primary px-3 py-1.5 text-sm shrink-0' : 'btn-ghost px-3 py-1.5 text-sm shrink-0'}
          onClick={() => update({ black: { ...b, ativo: !ativo } })}
          aria-pressed={ativo}
        >
          {ativo ? 'Ligada' : 'Desligada'}
        </button>
      </div>

      {acabou && <p className="bfy-sunk p-3 text-sm ink-2">A campanha já acabou ({fmtQuando(b.fim)}). A aba já não aparece na loja.</p>}

      <ul className="text-sm ink-2 space-y-1.5">
        <li>
          <b>Encomenda antecipada</b> até {fmtQuando(b.antecipadoAte)}: entregas de{' '}
          {fmtDia(b.diasAntecipado?.[0])} a {fmtDia(b.diasAntecipado?.[1])}, selos a dobrar
          {b.antecipadoFreteGratisAteKm != null && `, entrega grátis até ${b.antecipadoFreteGratisAteKm} km`}
          {b.antecipadoDescontoFrete ? ` e −${fmtEuro(b.antecipadoDescontoFrete)} mais longe` : ''}.
        </li>
        {b.reabre && (
          <li><b>Fechado</b> de {fmtQuando(b.antecipadoAte)} até {fmtQuando(b.reabre)}: ninguém consegue encomendar.</li>
        )}
        <li>
          <b>Depois</b>: só para {(b.diasNoDia ?? []).map(fmtDia).join(' e ') || '—'}, com a taxa de entrega normal.
        </li>
        {b.freteGratisAPartirDe ? <li>Entrega grátis a partir de {fmtEuro(b.freteGratisAPartirDe)}. Levantar é sempre grátis.</li> : null}
        <li>
          {b.fechaLojaNormal ? 'A loja normal fica fechada até ' : 'A aba fecha '}{fmtQuando(b.fim)}
          {b.fechaLojaNormal ? ': até lá só há a Black Crumb. Depois tudo volta ao normal.' : '.'}
        </li>
      </ul>

      <div className="grid grid-cols-3 gap-2">
        {(b.combos ?? []).map((c) => (
          <div key={c.id} className="bfy-sunk p-3 text-center">
            <p className="text-xs font-bold ink-1">{c.nome}</p>
            <p className="text-xs ink-3">{c.cookies} cookies{b.brindePorCombo ? ` + ${b.brindePorCombo} mini` : ''}</p>
            <p className="text-sm font-black" style={{ color: 'var(--color-accent-dark)' }}>{fmtEuro(c.preco)}</p>
          </div>
        ))}
      </div>
      <p className="text-xs ink-3">
        Em Vendas, os pedidos aparecem com 🖤 Black (e “selos ×2” quando são antecipados). O mini cookie de oferta é de
        sabor surpresa e não sai do stock.
      </p>
    </div>
  )
}
