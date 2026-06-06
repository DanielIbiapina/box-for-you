import { useEffect, useState } from 'react'
import { onSyncStatus } from '../lib/syncService'

export function useSyncStatus() {
  const [status, setStatus] = useState('idle')

  useEffect(() => onSyncStatus(({ status: s }) => setStatus(s)), [])

  return status
}
