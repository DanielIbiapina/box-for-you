import { useState } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'
import { useEventos, STATUS_EVENTO } from '../stores/useEventos'
import { useSyncStatus } from '../stores/useSyncStatus'
import { isSupabaseConfigured } from '../lib/supabase'
import { pushToCloud, pullFromCloud } from '../lib/syncService'
import { isAppLockEnabled, lock } from '../lib/appLock'
import { Modal } from '../components/Modal'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="bfy-label">{label}</span>
      {children}
    </label>
  )
}

const EMPTY_EVENTO = { nome: '', local: '', data: '', status: 'planejada' }

const SYNC_LABELS = {
  idle: 'Aguardando alterações',
  pulling: 'Baixando da nuvem…',
  pulled: 'Dados da nuvem carregados',
  syncing: 'Enviando para a nuvem…',
  synced: 'Sincronizado',
  error: 'Erro na sincronização',
}

export function Configuracoes() {
  const { config, update } = useConfiguracoes()
  const { eventos, adicionar, atualizar, remover } = useEventos()
  const syncStatus = useSyncStatus()
  const [saved, setSaved] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
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
    setEventoForm(ev ?? EMPTY_EVENTO)
    setEventoModal(ev?.id ?? 'new')
  }

  function saveEvento(e) {
    e.preventDefault()
    if (!eventoForm.nome.trim() || !eventoForm.data) return
    if (eventoModal === 'new') {
      adicionar(eventoForm)
    } else {
      atualizar(eventoModal, eventoForm)
    }
    setEventoModal(null)
  }

  async function handlePushToCloud() {
    setSyncBusy(true)
    await pushToCloud()
    setSyncBusy(false)
  }

  async function handlePullFromCloud() {
    setSyncBusy(true)
    await pullFromCloud()
    setSyncBusy(false)
  }

  function handleLockApp() {
    lock()
    window.location.reload()
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-10">
      <h1
        className="text-3xl font-black mb-6"
        style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text-light)' }}
      >
        ⚙️ Configurações
      </h1>

      {/* Backup na nuvem */}
      <div className="bfy-card p-6 mb-5 space-y-4">
        <h2
          className="text-base font-bold mb-1"
          style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}
        >
          Backup na Nuvem
        </h2>
        <p className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>
          Sincroniza automaticamente com o Supabase. O app continua funcionando offline na feira.
        </p>

        {!isSupabaseConfigured ? (
          <p
            className="text-sm rounded-xl px-4 py-3"
            style={{ background: 'rgba(232,192,128,0.25)', color: 'var(--color-text)' }}
          >
            Supabase não configurado. Copie <code className="text-xs">.env.example</code> para{' '}
            <code className="text-xs">.env</code> e preencha as credenciais.
          </p>
        ) : (
          <div className="space-y-3">
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(90,158,133,0.12)' }}
            >
              <span className="text-xl">☁️</span>
              <p className="text-xs opacity-60" style={{ color: 'var(--color-text)' }}>
                {SYNC_LABELS[syncStatus] ?? syncStatus}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost text-xs px-4 py-2"
                disabled={syncBusy}
                onClick={handlePushToCloud}
              >
                {syncBusy ? '…' : '↑ Enviar agora'}
              </button>
              <button
                type="button"
                className="btn-ghost text-xs px-4 py-2"
                disabled={syncBusy}
                onClick={handlePullFromCloud}
              >
                {syncBusy ? '…' : '↓ Baixar da nuvem'}
              </button>
            </div>
          </div>
        )}

        {isAppLockEnabled && (
          <button type="button" className="btn-ghost w-full py-2 text-sm" onClick={handleLockApp}>
            🔒 Bloquear app (pedir senha de novo)
          </button>
        )}
      </div>

      {/* Dados do negócio */}
      <form onSubmit={handleSave} className="bfy-card p-6 mb-5 space-y-4">
        <h2
          className="text-base font-bold mb-1"
          style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}
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
              + Add
            </button>
          </div>
        </div>

        <button type="submit" className="btn-primary w-full py-3">
          {saved ? '✓ Salvo!' : 'Salvar Configurações'}
        </button>
      </form>

      {/* Eventos / Feiras */}
      <div className="bfy-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-bold"
            style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}
          >
            Eventos & Feiras
          </h2>
          <button className="btn-accent text-xs px-4 py-2" onClick={() => openEvento(null)}>
            + Novo evento
          </button>
        </div>

        {eventos.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-5xl block mb-2">🗓️</span>
            <p className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.5 }}>
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
                  style={{ background: 'rgba(61,43,31,0.05)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                      {ev.nome}
                    </p>
                    <p className="text-xs opacity-60" style={{ color: 'var(--color-text)' }}>
                      {ev.data
                        ? new Date(ev.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}{' '}
                      {ev.local ? `· ${ev.local}` : ''}
                    </p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0"
                    style={{ background: 'rgba(61,43,31,0.1)', color: 'var(--color-text)' }}
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
                    className="text-xs font-semibold opacity-40 hover:opacity-80 shrink-0"
                    style={{ color: '#e57373' }}
                    onClick={() => confirm('Excluir este evento?') && remover(ev.id)}
                  >
                    ✕
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
