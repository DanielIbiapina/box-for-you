import { useSyncStatus } from '../stores/useSyncStatus'
import { isSupabaseConfigured } from '../lib/supabase'

/** Só avisos importantes — sync normal é silencioso (sem mexer o layout). */
const LABELS = {
  offline: 'Sem internet — liga-te à rede para guardar alterações',
  error: 'Erro ao sincronizar — verifica a ligação',
}

export function SyncBar() {
  const { status, online, message } = useSyncStatus()

  if (!isSupabaseConfigured) return null

  const label = !online
    ? LABELS.offline
    : status === 'error'
      ? (message ? `${LABELS.error}: ${message}` : LABELS.error)
      : null

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
