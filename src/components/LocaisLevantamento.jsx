import { useState } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'
import { Icon } from './Icon'
import { Modal } from './Modal'

/**
 * Onde os clientes da loja podem levantar: casa, River Market, outro mercado…
 * Cada local liga-se e desliga-se num toque (há dias em que não se está em
 * casa, outros em que não se está no mercado). A loja só mostra os ligados;
 * com todos desligados, os clientes só podem pedir entrega. Quem confirma é
 * o servidor (supabase/loja.sql), não só a loja.
 *
 * Grava logo a cada mudança — não depende do "Salvar configurações".
 */
const VAZIO = { nome: '', morada: '', notas: '' }

const novoId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36)

export function LocaisLevantamento() {
  const { config, update } = useConfiguracoes()
  const locais = config.locaisLevantamento ?? []
  const disponivel = config.locaisDisponivel !== false
  const [modal, setModal] = useState(null) // null | 'novo' | id
  const [form, setForm] = useState(VAZIO)

  const gravar = (lista) => update({ locaisLevantamento: lista })
  const ligados = locais.filter((l) => l.ativo).length

  function abrir(local) {
    setForm(local ? { nome: local.nome ?? '', morada: local.morada ?? '', notas: local.notas ?? '' } : VAZIO)
    setModal(local ? local.id : 'novo')
  }

  function guardar(e) {
    e.preventDefault()
    const dados = { nome: form.nome.trim(), morada: form.morada.trim(), notas: form.notas.trim() }
    if (!dados.nome) return
    if (modal === 'novo') gravar([...locais, { id: novoId(), ...dados, ativo: true }])
    else gravar(locais.map((l) => (l.id === modal ? { ...l, ...dados } : l)))
    setModal(null)
  }

  return (
    <div className="bfy-card p-6 mb-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-base font-bold bfy-card-title">Locais de levantamento</h2>
        <button type="button" className="btn-accent text-xs px-4 py-2" disabled={!disponivel} onClick={() => abrir(null)}>
          <Icon name="mais" size={15} /> Novo local
        </button>
      </div>
      <p className="text-xs ink-3 mb-4">
        A loja só mostra os locais <strong>ligados</strong>. Desliga os dias em que não vais estar lá.
      </p>

      {!disponivel ? (
        <p className="bfy-sunk p-3 text-sm ink-2">
          Para gerir os locais, corre o <code>supabase/loja.sql</code> atualizado no Supabase.
        </p>
      ) : locais.length === 0 ? (
        <p className="bfy-sunk p-3 text-sm ink-2">
          Ainda sem locais: no levantamento, a loja diz que combinam o sítio por mensagem
          (o texto de “Instruções de levantamento”, acima).
        </p>
      ) : (
        <div className="space-y-2">
          {locais.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)', opacity: l.ativo ? 1 : 0.7 }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate ink-1">{l.nome}</p>
                {(l.morada || l.notas) && (
                  <p className="text-xs ink-3 truncate">{[l.morada, l.notas].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!l.ativo}
                aria-label={`${l.nome}: ${l.ativo ? 'ligado' : 'desligado'}`}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
                style={{
                  background: l.ativo ? 'rgba(90,158,133,0.15)' : 'var(--color-surface)',
                  color: l.ativo ? 'var(--color-success)' : 'rgba(29,16,8,0.45)',
                  border: '1px solid var(--line-1)',
                }}
                onClick={() => gravar(locais.map((x) => (x.id === l.id ? { ...x, ativo: !x.ativo } : x)))}
              >
                {l.ativo ? 'Ligado' : 'Desligado'}
              </button>
              <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => abrir(l)}>Editar</button>
              <button
                type="button"
                className="btn-icon btn-icon-danger shrink-0"
                aria-label={`Remover ${l.nome}`}
                title={`Remover ${l.nome}`}
                onClick={() => {
                  if (confirm(`Remover o local "${l.nome}"?`)) gravar(locais.filter((x) => x.id !== l.id))
                }}
              >
                <Icon name="lixo" size={15} />
              </button>
            </div>
          ))}
          {ligados === 0 && (
            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-accent-dark)' }}>
              <Icon name="alerta" size={14} /> Todos desligados: hoje os clientes só podem pedir entrega.
            </p>
          )}
        </div>
      )}

      {modal !== null && (
        <Modal title={modal === 'novo' ? 'Novo local' : 'Editar local'} onClose={() => setModal(null)} size="sm">
          <form onSubmit={guardar} className="space-y-3">
            <label className="block">
              <span className="bfy-label">Nome *</span>
              <input
                className="bfy-input"
                required
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: River Market"
              />
            </label>
            <label className="block">
              <span className="bfy-label">Morada</span>
              <input
                className="bfy-input"
                value={form.morada}
                onChange={(e) => setForm((f) => ({ ...f, morada: e.target.value }))}
                placeholder="Ex.: Cais do Sodré, Lisboa"
              />
            </label>
            <label className="block">
              <span className="bfy-label">Notas para o cliente</span>
              <input
                className="bfy-input"
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Ex.: na nossa banca, das 12h às 20h"
              />
            </label>
            <p className="text-[11px] ink-3">A morada e as notas aparecem na loja a quem escolher este local.</p>
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
