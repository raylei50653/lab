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

const PER_PAGE_OPTIONS = [5, 10, 20, 50]

export default function DataTable({ items, onDelete, onUpdate }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [sortOption, setSortOption] = useState('updated_desc')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

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
    try {
      await onUpdate(editingId, trimmed)
      cancelEdit()
    } catch (err) {
      console.error('Update failed', err)
    }
  }

  const handleDelete = async (id) => {
    try {
      await onDelete(id)
    } catch (err) {
      console.error('Delete failed', err)
    }
  }

  const sortedItems = useMemo(() => {
    const next = [...(items ?? [])]
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
  const totalPages = sortedItems.length
    ? Math.max(1, Math.ceil(sortedItems.length / perPage))
    : 1
  const currentPage = Math.min(page, totalPages)
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * perPage
    return sortedItems.slice(start, start + perPage)
  }, [sortedItems, currentPage, perPage])

  const handlePerPageChange = (value) => {
    const parsed = Number(value) || 1
    setPerPage(parsed)
    setPage(1)
  }

  const shiftPage = (delta) => {
    setPage((prev) => {
      const next = prev + delta
      if (next < 1) return 1
      if (next > totalPages) return totalPages
      return next
    })
  }

  return (
    <>
      <div
        style={{
          marginTop: 12,
          marginBottom: 8,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
        }}
      >
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
        <label htmlFor="per-page-select">每頁上限</label>
        <select
          id="per-page-select"
          value={perPage}
          onChange={(e) => handlePerPageChange(e.target.value)}
          style={{ padding: 6 }}
        >
          {PER_PAGE_OPTIONS.map((limit) => (
            <option key={limit} value={limit}>
              {limit} 筆
            </option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: '#666' }}>
          第 {currentPage} / {totalPages} 頁
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => shiftPage(-1)} disabled={currentPage === 1}>
            上一頁
          </button>
          <button
            onClick={() => shiftPage(1)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            下一頁
          </button>
        </div>
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
        {paginatedItems.map((it) => (
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
                  <button onClick={() => handleDelete(it.id)}>Delete</button>
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
