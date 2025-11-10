import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export function useData(autoLoad = true) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.listData()
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e?.message || 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const createItem = useCallback(async (content) => {
    await api.createData(content)
    await refresh()
  }, [refresh])

  const updateItem = useCallback(async (id, content) => {
    await api.updateData(id, content)
    await refresh()
  }, [refresh])

  const deleteItem = useCallback(async (id) => {
    await api.deleteData(id)
    await refresh()
  }, [refresh])

  useEffect(() => {
    if (autoLoad) refresh()
  }, [autoLoad, refresh])

  return { items, loading, error, refresh, createItem, updateItem, deleteItem }
}
