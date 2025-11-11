import DataForm from '../components/DataForm'
import DataTable from '../components/DataTable'
import { useData } from '../hooks/useData'
import { Button } from '@/components/ui/button'

export default function DataCrud() {
  const {
    items, loading, error,
    createItem, updateItem, deleteItem, refresh
  } = useData(true)

  return (
    <section>
      <h2>Data CRUD</h2>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={refresh} disabled={loading}>
          Refresh data
        </Button>
        {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <DataForm onSubmit={createItem} />
      <DataTable items={items} onDelete={deleteItem} onUpdate={updateItem} />
    </section>
  )
}
