import { useState } from 'react'
import DataForm from '../components/DataForm'
import DataTable from '../components/DataTable'
import { useData } from '../hooks/useData'
import { Button } from '@/components/ui/button'

export default function DataCrud() {
  const {
    items, loading, error,
    createItem, updateItem, deleteItem, refresh
  } = useData(true)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const handleSearch = async (event) => {
    event.preventDefault()
    const keyword = searchInput.trim()
    await refresh(keyword)
    setAppliedSearch(keyword)
  }

  const handleResetSearch = async () => {
    setSearchInput('')
    setAppliedSearch('')
    await refresh('')
  }

  return (
    <section>
      <h2>Data CRUD</h2>

      <form className="flex flex-wrap items-center gap-3" onSubmit={handleSearch}>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="輸入關鍵字後按 Search"
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={loading}>
          Search
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleResetSearch}
          disabled={loading || (appliedSearch === '' && searchInput === '')}
        >
          Clear
        </Button>
        <Button variant="outline" type="button" onClick={() => refresh()} disabled={loading}>
          Refresh data
        </Button>
        {appliedSearch && (
          <span className="text-sm text-muted-foreground">
            目前搜尋：{appliedSearch}
          </span>
        )}
        {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </form>

      <DataForm onSubmit={createItem} />
      <DataTable items={items} onDelete={deleteItem} onUpdate={updateItem} />
    </section>
  )
}
