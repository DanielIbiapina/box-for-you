import { useData } from '../stores/DataProvider'

/**
 * Só fala quando é preciso: alterações à espera de rede, ou um erro.
 * Sincronização normal é silenciosa.
 */
export function SyncBar() {
  const { error, porGuardar, clearError } = useData()

  if (porGuardar > 0) {
    return (
      <div
        className="shrink-0 px-4 py-2 flex items-center justify-center gap-2 text-center text-xs font-semibold"
        style={{
          background: 'var(--color-warning-soft)',
          color: '#7A5214',
          borderBottom: '1px solid rgba(181,122,33,0.25)',
        }}
      >
        <span className="bfy-num">{porGuardar}</span>
        <span>
          {porGuardar === 1 ? 'alteração por guardar' : 'alterações por guardar'} — nada se perde,
          guardamos assim que houver rede
        </span>
      </div>
    )
  }

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
      <span>{error}</span>
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
