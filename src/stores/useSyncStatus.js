import { useEffect, useState } from 'react'
import { onSyncStatus } from '../lib/syncService'

export function useSyncStatus() {
  const [state, setState] = useState({ status: 'idle', online: navigator.onLine })

  useEffect(() => onSyncStatus(setState), [])

  return state
}
