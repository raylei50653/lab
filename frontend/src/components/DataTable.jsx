import { useMemo, useState } from 'react'
const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const sortOptions = [
  { value: 'updated_desc', label: '最新更新' },
  { value: 'updated_asc', label: '最早更新' },
  { value: 'id_desc', label: 'ID 大 → 小' },
  { value: 'id_asc', label: 'ID 小 → 大' },
]

export default function DataTable({ items, onDelete, onUpdate }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [sortOption, setSortOption] = useState('updated_desc')

  const startEdit = (item) => {
    setEditingId(item.id)
    setDraft(item.text ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft('')
  }

  const submitEdit = async () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      alert('請輸入內容')
      return
    }
    await onUpdate(editingId, trimmed)
    cancelEdit()
  }

  const sortedItems = useMemo(() => {
    const next = [...items]
    switch (sortOption) {
      case 'updated_asc':
        next.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at))
        break
      case 'id_desc':
        next.sort((a, b) => b.id - a.id)
        break
      case 'id_asc':
        next.sort((a, b) => a.id - b.id)
        break
      case 'updated_desc':
      default:
        next.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        break
    }
    return next
  }, [items, sortOption])

  return (
    <>
      <div style={{ marginTop: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor="data-sort">排序</label>
        <select
          id="data-sort"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          style={{ padding: 6 }}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <table border="1" cellPadding="8" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>text</th>
            <th>created_at</th>
            <th>updated_at</th>
            <th>action</th>
          </tr>
        </thead>
        <tbody>
        {sortedItems.map((it) => (
          <tr key={it.id}>
            <td>{it.id}</td>
            <td>
              {editingId === it.id ? (
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="請輸入內容"
                  style={{ width: '100%', padding: 6 }}
                />
              ) : (
                it.text || <span style={{ color: '#888' }}>無內容</span>
              )}
            </td>
            <td>{formatDateTime(it.created_at)}</td>
            <td>{formatDateTime(it.updated_at)}</td>
            <td style={{ display: 'grid', gap: 4 }}>
              {editingId === it.id ? (
                <>
                  <button onClick={submitEdit}>Save</button>
                  <button onClick={cancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(it)}>Edit</button>
                  <button onClick={() => onDelete(it.id)}>Delete</button>
                </>
              )}
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    </>
  )
}
