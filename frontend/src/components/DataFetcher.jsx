import { useState } from 'react'
import { api } from '../services/api'

const modes = [
  { value: 'all', label: '全部資料 (GET /data/)' },
  { value: 'single', label: '指定 ID (GET /data/<id>/)' },
]

export default function DataFetcher() {
  const [mode, setMode] = useState('all')
  const [recordId, setRecordId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const canSubmit = mode === 'all' || recordId.trim() !== ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const payload = mode === 'all'
        ? await api.listData()
        : await api.getData(recordId.trim())
      setResult(payload)
    } catch (err) {
      setError(err?.message || 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h3>資料查詢</h3>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          請求類型
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {modes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          資料 ID（僅在「指定 ID」時需要）
          <input
            type="number"
            min={1}
            placeholder="例如：1"
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
            disabled={mode !== 'single'}
          />
        </label>

        <button type="submit" disabled={!canSubmit || loading}>
          {loading ? '查詢中...' : '送出請求'}
        </button>
      </form>

      <div style={{ marginTop: 12 }}>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        {result !== null && (
          <pre style={{ background: '#f7f7f7', padding: 12, border: '1px solid #eee', overflowX: 'auto' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </section>
  )
}
