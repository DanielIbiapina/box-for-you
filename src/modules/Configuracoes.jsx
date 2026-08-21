import { useState } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'
import { useEventos, STATUS_EVENTO } from '../stores/useEventos'
import { useFinanceiro } from '../stores/useFinanceiro'
import { supabase } from '../lib/supabase'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { CardapioAdmin } from '../components/CardapioAdmin'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="bfy-label">{label}</span>
      {children}
    </label>
  )
}

const EMPTY_EVENTO = { nome: '', local: '', data: '', status: 'planejada', taxaInscricao: '' }

export function Configuracoes() {
  const { config, update } = useConfiguracoes()
  const { eventos, adicionar, atualizar, remover } = useEventos()
  const { syncInscricaoEvento, removerDespesasPorEvento } = useFinanceiro()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ ...config })
  const [pagamento, setPagamento] = useState('')
  const [eventoModal, setEventoModal] = useState(null)
  const [eventoForm, setEventoForm] = useState(EMPTY_EVENTO)

  function handleSave(e) {
    e.preventDefault()
    update(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addPagamento() {
    const trimmed = pagamento.trim()
    if (!trimmed) return
    const list = [...(form.formasPagamento ?? []), trimmed]
    setForm((f) => ({ ...f, formasPagamento: list }))
    setPagamento('')
  }

  function removePagamento(i) {
    setForm((f) => ({
      ...f,
      formasPagamento: f.formasPagamento.filter((_, idx) => idx !== i),
    }))
  }

  function openEvento(ev) {
    setEventoForm(
      ev
        ? {
            nome: ev.nome ?? '',
            local: ev.local ?? '',
            data: ev.data ?? '',
            status: ev.status ?? 'planejada',
            taxaInscricao: ev.taxaInscricao != null && ev.taxaInscricao !== ''
              ? String(ev.taxaInscricao)
              : '',
          }
        : EMPTY_EVENTO,
    )
    setEventoModal(ev?.id ?? 'new')
  }

  function saveEvento(e) {
    e.preventDefault()
    if (!eventoForm.nome.trim() || !eventoForm.data) return
    const taxa = parseFloat(eventoForm.taxaInscricao) || 0
    const payload = {
      nome: eventoForm.nome,
      local: eventoForm.local,
      data: eventoForm.data,
      status: eventoForm.status,
      taxaInscricao: taxa,
    }
    let savedEv
    if (eventoModal === 'new') {
      savedEv = adicionar(payload)
    } else {
      atualizar(eventoModal, payload)
      savedEv = { id: eventoModal, ...payload }
    }
    syncInscricaoEvento(savedEv)
    setEventoModal(null)
  }

  async function handleLogout() {
    if (!confirm('Sair da conta neste dispositivo?')) return
    await supabase.auth.signOut()
  }

  return (
    <div className="bfy-page bfy-page-form">
      <h1 className="bfy-page-title mb-6">
        Definições
      </h1>

      {/* Conta & sincronização */}
      <div className="bfy-card p-6 mb-5 space-y-4">
        <h2
          className="text-base font-bold mb-1 bfy-card-title"
        >
          Conta & Sincronização
        </h2>
        <p className="text-sm ink-3">
          Os dados ficam no Supabase e sincronizam <strong>em tempo real</strong> entre todos os dispositivos —
          quando alguém altera algo, aparece automaticamente para os outros. Não é preciso enviar nem baixar nada.
        </p>
        <button type="button" className="btn-ghost w-full py-2 text-sm" onClick={handleLogout}>
          Sair da conta
        </button>
      </div>

      {/* Dados do negócio */}
      <form onSubmit={handleSave} className="bfy-card p-6 mb-5 space-y-4">
        <h2
          className="text-base font-bold mb-1 bfy-card-title"
        >
          Dados do Negócio
        </h2>

        <Field label="Nome do negócio">
          <input
            className="bfy-input"
            value={form.nomeNegocio}
            onChange={(e) => setForm((f) => ({ ...f, nomeNegocio: e.target.value }))}
          />
        </Field>

        <Field label="Nome da proprietária (saudação na home)">
          <input
            className="bfy-input"
            value={form.nomeProprietaria}
            onChange={(e) => setForm((f) => ({ ...f, nomeProprietaria: e.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Moeda">
            <input
              className="bfy-input"
              value={form.moeda}
              onChange={(e) => setForm((f) => ({ ...f, moeda: e.target.value }))}
              placeholder="€"
            />
          </Field>
          <Field label="Meta de lucro mensal">
            <input
              className="bfy-input"
              type="number"
              min="0"
              value={form.metaLucroMensal}
              onChange={(e) =>
                setForm((f) => ({ ...f, metaLucroMensal: parseFloat(e.target.value) || 0 }))
              }
            />
          </Field>
        </div>

        {/* Formas de pagamento */}
        <div>
          <span className="bfy-label">Formas de Pagamento aceitas</span>
          <div className="flex flex-wrap gap-2 mb-2">
            {(form.formasPagamento ?? []).map((p, i) => (
              <span
                key={i}
                className="flex items-center gap-1 px-3 py-1 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--color-accent)', color: 'var(--color-text)' }}
              >
                {p}
                <button
                  type="button"
                  onClick={() => removePagamento(i)}
                  className="ml-1 text-base leading-none opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="bfy-input flex-1"
              placeholder="Ex: Pix, Cartão..."
              value={pagamento}
              onChange={(e) => setPagamento(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPagamento())}
            />
            <button type="button" className="btn-ghost px-4" onClick={addPagamento}>
              <Icon name="mais" size={15} /> Add
            </button>
          </div>
        </div>

        <button type="submit" className="btn-primary w-full py-3">
          {saved ? 'Guardado' : 'Salvar configurações'}
        </button>
      </form>

      {/* Cardápio global */}
      <div className="bfy-card p-6 mb-5">
        <h2
          className="text-base font-bold mb-4 bfy-card-title"
        >
          Cardápio & Sabores
        </h2>
        <CardapioAdmin />
      </div>

      {/* Eventos / Feiras */}
      <div className="bfy-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-bold bfy-card-title"
          >
            Eventos & Feiras
          </h2>
          <button className="btn-accent text-xs px-4 py-2" onClick={() => openEvento(null)}>
            <Icon name="mais" size={15} /> Novo evento
          </button>
        </div>

        {eventos.length === 0 ? (
          <div className="text-center py-8">
            <span className="ink-4 inline-block mb-2"><Icon name="calendario" size={30} /></span>
            <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
              Nenhum evento cadastrado
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {eventos.map((ev) => {
              const statusObj = STATUS_EVENTO.find((s) => s.id === ev.status)
              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background: 'var(--color-surface-sunk)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                      {ev.nome}
                    </p>
                    <p className="text-xs ink-3">
                      {ev.data
                        ? new Date(ev.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}{' '}
                      {ev.local ? `· ${ev.local}` : ''}
                      {(Number(ev.taxaInscricao) || 0) > 0
                        ? ` · inscrição ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(ev.taxaInscricao)}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0"
                    style={{ background: 'var(--line-2)', color: 'var(--color-text)' }}
                  >
                    {statusObj?.label ?? ev.status}
                  </span>
                  <button
                    className="btn-ghost text-xs px-3 py-1 shrink-0"
                    onClick={() => openEvento(ev)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn-icon btn-icon-danger shrink-0"
                    aria-label={`Excluir evento ${ev.nome}`}
                    title="Excluir evento"
                    onClick={() => {
                      if (!confirm(`Excluir o evento "${ev.nome}"? As vendas desse dia mantêm-se.`)) return
                      removerDespesasPorEvento(ev.id)
                      remover(ev.id)
                    }}
                  >
                    <Icon name="lixo" size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {eventoModal !== null && (
        <Modal
          title={eventoModal === 'new' ? 'Novo Evento' : 'Editar Evento'}
          onClose={() => setEventoModal(null)}
          size="sm"
        >
          <form onSubmit={saveEvento} className="space-y-4">
            <Field label="Nome da feira / evento *">
              <input
                className="bfy-input"
                required
                value={eventoForm.nome}
                onChange={(e) => setEventoForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </Field>
            <Field label="Local">
              <input
                className="bfy-input"
                value={eventoForm.local}
                onChange={(e) => setEventoForm((f) => ({ ...f, local: e.target.value }))}
              />
            </Field>
            <Field label="Data *">
              <input
                className="bfy-input"
                type="date"
                required
                value={eventoForm.data}
                onChange={(e) => setEventoForm((f) => ({ ...f, data: e.target.value }))}
              />
            </Field>
            <Field label="Status">
              <select
                className="bfy-input"
                value={eventoForm.status}
                onChange={(e) => setEventoForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUS_EVENTO.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Taxa de inscrição (€)">
              <input
                className="bfy-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={eventoForm.taxaInscricao}
                onChange={(e) => setEventoForm((f) => ({ ...f, taxaInscricao: e.target.value }))}
              />
              <span className="text-[11px] mt-1 block ink-3">
                Entra automaticamente em Entradas e Saídas
              </span>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setEventoModal(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary flex-1">
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
