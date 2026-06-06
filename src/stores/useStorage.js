import { useState, useEffect } from 'react'
import { STORAGE_SYNC_EVENT } from '../lib/syncKeys'
import { scheduleSync, isApplyingRemoteSync } from '../lib/syncService'

function readKey(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    return JSON.parse(raw)
  } catch {
    return defaultValue
  }
}

export function useStorage(key, defaultValue) {
  const [value, setValue] = useState(() => readKey(key, defaultValue))

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      if (!isApplyingRemoteSync()) scheduleSync(key)
    } catch {
      // storage full or disabled
    }
  }, [key, value])

  useEffect(() => {
    function onRemoteSync(e) {
      if (e.detail?.key !== key) return
      setValue(readKey(key, defaultValue))
    }
    window.addEventListener(STORAGE_SYNC_EVENT, onRemoteSync)
    return () => window.removeEventListener(STORAGE_SYNC_EVENT, onRemoteSync)
  }, [key, defaultValue])

  return [value, setValue]
}
