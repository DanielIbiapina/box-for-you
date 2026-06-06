import { useSyncStatus } from '../stores/useSyncStatus'
import { isSupabaseConfigured } from '../lib/supabase'

const LABELS = {
  idle: null,
  pulling: 'A carregar dados da nuvem…',
  pulled: null,
  syncing: 'A guardar na nuvem…',
  synced: null,
  merged: null,
  offline: 'Sem internet — as alterações serão enviadas quando voltar a ligar',
  error: 'Erro ao sincronizar — verifica a ligação',
}

export function SyncBar() {
  const { status, online, message } = useSyncStatus()

  if (!isSupabaseConfigured) return null

  const label = !online
    ? LABELS.offline
    : status === 'error'
      ? (message ? `${LABELS.error}: ${message}` : LABELS.error)
      : LABELS[status]

  if (!label) return null

  const isError = status === 'error' || !online

  return (
    <div
      className="shrink-0 px-4 py-2 text-center text-xs font-semibold"
      style={{
        background: isError ? 'rgba(229,115,115,0.18)' : 'rgba(90,158,133,0.15)',
        color: isError ? '#c62828' : 'var(--color-success)',
        borderBottom: `1px solid ${isError ? 'rgba(198,40,40,0.15)' : 'rgba(90,158,133,0.2)'}`,
      }}
    >
      {label}
    </div>
  )
}
