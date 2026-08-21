import { useData } from '../stores/DataProvider'

/** Só aparece quando há erro de conexão/gravação. Sync normal é silencioso. */
export function SyncBar() {
  const { error, clearError } = useData()

  if (!error) return null

  return (
    <div
      className="shrink-0 px-4 py-2 flex items-center justify-center gap-3 text-center text-xs font-semibold"
      style={{
        background: 'rgba(229,115,115,0.18)',
        color: '#c62828',
        borderBottom: '1px solid rgba(198,40,40,0.15)',
      }}
    >
      <span>Erro de sincronização — verifica a ligação</span>
      <button
        type="button"
        onClick={clearError}
        className="underline opacity-70 hover:opacity-100"
      >
        dispensar
      </button>
    </div>
  )
}
