import { useState } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'
import { todayKey } from '../lib/salesAnalytics'
import { Icon } from './Icon'
import { Modal } from './Modal'

/**
 * Cupões da loja: código, % de desconto (sobre os cookies, não sobre a
 * entrega) e até quando vale. O cliente escreve o código no fim do pedido;
 * o servidor confirma e calcula o desconto (supabase/loja.sql).
 * Grava logo a cada mudança.
 */
const VAZIO = { codigo: '', percent: '15', validoAte: '' }

const fmtDia = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

export function Cupoes() {
  const { config, update } = useConfiguracoes()
  const cupons = config.cupons ?? []
  const disponivel = config.cuponsDisponivel !== false
  const [modal, setModal] = useState(null) // null | 'novo' | índice
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState('')
  const hoje = todayKey()

  const gravar = (lista) => update({ cupons: lista })

  function abrir(i) {
    const c = i === 'novo' ? null : cupons[i]
    setForm(c ? { codigo: c.codigo ?? '', percent: String(c.percent ?? ''), validoAte: c.validoAte ?? '' } : VAZIO)
    setErro('')
    setModal(i)
  }

  function guardar(e) {
    e.preventDefault()
    const codigo = form.codigo.trim().toUpperCase().replace(/\s+/g, '')
    const percent = parseFloat(String(form.percent).replace(',', '.'))
    if (!codigo) return setErro('Escreve o código.')
    if (!(percent > 0 && percent <= 100)) return setErro('A percentagem tem de ser entre 1 e 100.')
    const repetido = cupons.some((c, i) => i !== modal && String(c.codigo).toUpperCase() === codigo)
    if (repetido) return setErro('Já existe um cupão com esse código.')
    const dados = { codigo, percent, validoAte: form.validoAte || '' }
    if (modal === 'novo') gravar([...cupons, { ...dados, ativo: true }])
    else gravar(cupons.map((c, i) => (i === modal ? { ...c, ...dados } : c)))
    setModal(null)
  }

  return (
    <div className="bfy-card p-6 mb-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-base font-bold bfy-card-title">Cupões de desconto</h2>
        <button type="button" className="btn-accent text-xs px-4 py-2" disabled={!disponivel} onClick={() => abrir('novo')}>
          <Icon name="mais" size={15} /> Novo cupão
        </button>
      </div>
      <p className="text-xs ink-3 mb-4">
        O cliente escreve o código no fim do pedido. O desconto é sobre os cookies (não sobre a entrega).
      </p>

      {!disponivel ? (
        <p className="bfy-sunk p-3 text-sm ink-2">
          Para usar cupões, corre o <code>supabase/loja.sql</code> atualizado no Supabase.
        </p>
      ) : cupons.length === 0 ? (
        <p className="bfy-sunk p-3 text-sm ink-2">Ainda não há cupões.</p>
      ) : (
        <div className="space-y-2">
          {cupons.map((c, i) => {
            const expirado = c.validoAte && c.validoAte < hoje
            const vale = c.ativo && !expirado
            return (
              <div
                key={`${c.codigo}-${i}`}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)', opacity: vale ? 1 : 0.7 }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black tracking-wide ink-1">{c.codigo}</p>
                  <p className="text-xs ink-3">
                    −{c.percent}%{c.validoAte ? ` · até ${fmtDia(c.validoAte)}` : ' · sem fim'}
                    {expirado && <span className="font-bold" style={{ color: 'var(--color-danger)' }}> · expirado</span>}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!c.ativo}
                  aria-label={`${c.codigo}: ${c.ativo ? 'ativo' : 'desligado'}`}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
                  style={{
                    background: c.ativo ? 'rgba(90,158,133,0.15)' : 'var(--color-surface)',
                    color: c.ativo ? 'var(--color-success)' : 'rgba(29,16,8,0.45)',
                    border: '1px solid var(--line-1)',
                  }}
                  onClick={() => gravar(cupons.map((x, j) => (j === i ? { ...x, ativo: !x.ativo } : x)))}
                >
                  {c.ativo ? 'Ativo' : 'Desligado'}
                </button>
                <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => abrir(i)}>Editar</button>
                <button
                  type="button"
                  className="btn-icon btn-icon-danger shrink-0"
                  aria-label={`Remover ${c.codigo}`}
                  title={`Remover ${c.codigo}`}
                  onClick={() => { if (confirm(`Remover o cupão ${c.codigo}?`)) gravar(cupons.filter((_, j) => j !== i)) }}
                >
                  <Icon name="lixo" size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <Modal title={modal === 'novo' ? 'Novo cupão' : 'Editar cupão'} onClose={() => setModal(null)} size="sm">
          <form onSubmit={guardar} className="space-y-3">
            <label className="block">
              <span className="bfy-label">Código *</span>
              <input
                className="bfy-input uppercase tracking-wide"
                required
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                placeholder="Ex.: MEDICINA15"
                maxLength={30}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="bfy-label">Desconto (%) *</span>
                <input
                  className="bfy-input bfy-num"
                  inputMode="decimal"
                  required
                  value={form.percent}
                  onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="bfy-label">Válido até</span>
                <input
                  className="bfy-input"
                  type="date"
                  value={form.validoAte}
                  onChange={(e) => setForm((f) => ({ ...f, validoAte: e.target.value }))}
                />
              </label>
            </div>
            <p className="text-[11px] ink-3">Vale até ao fim desse dia. Sem data, vale até o desligares.</p>
            {erro && <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>{erro}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn-ghost flex-1" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

