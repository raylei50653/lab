import { useState } from 'react'

export default function DataTable({ items, onDelete, onUpdate }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')

  const startEdit = (item) => {
    setEditingId(item.id)
    setDraft(JSON.stringify(item.content, null, 2))
  }

  const submitEdit = async () => {
    try {
      const json = JSON.parse(draft)
      await onUpdate(editingId, json)
      setEditingId(null)
      setDraft('')
    } catch {
      alert('請輸入合法 JSON')
    }
  }

  return (
    <table border="1" cellPadding="8" style={{ width: '100%', marginTop: 12 }}>
      <thead>
        <tr>
          <th>ID</th>
          <th>content</th>
          <th>action</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.id}>
            <td>{it.id}</td>
            <td>
              {editingId === it.id ? (
                <textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: '100%' }} />
              ) : (
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(it.content, null, 2)}</pre>
              )}
            </td>
            <td style={{ display: 'grid', gap: 4 }}>
              {editingId === it.id ? (
                <>
                  <button onClick={submitEdit}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
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
  )
}