import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'

export function useData(autoLoad = true) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastQueryRef = useRef('')

  const runMutation = useCallback(async (fn, fallbackMessage = 'Operation failed') => {
    try {
      setError('')
      await fn()
    } catch (err) {
      setError(err?.message || fallbackMessage)
      throw err
    }
  }, [])

  const refresh = useCallback(async (searchTerm) => {
    const normalized = typeof searchTerm === 'string' ? searchTerm.trim() : undefined
    const effectiveQuery = normalized !== undefined ? normalized : lastQueryRef.current
    if (normalized !== undefined) {
      lastQueryRef.current = effectiveQuery
    }
    try {
      setLoading(true)
      setError('')
      const data = await api.listData(effectiveQuery)
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e?.message || 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const createItem = useCallback(async (text) => {
    await runMutation(async () => {
      await api.createData(text)
      await refresh()
    }, 'Create failed')
  }, [refresh, runMutation])

  const updateItem = useCallback(async (id, text) => {
    await runMutation(async () => {
      await api.updateData(id, text)
      await refresh()
    }, 'Update failed')
  }, [refresh, runMutation])

  const deleteItem = useCallback(async (id) => {
    await runMutation(async () => {
      await api.deleteData(id)
      await refresh()
    }, 'Delete failed')
  }, [refresh, runMutation])

  useEffect(() => {
    if (autoLoad) refresh()
  }, [autoLoad, refresh])

  return { items, loading, error, refresh, createItem, updateItem, deleteItem }
}
