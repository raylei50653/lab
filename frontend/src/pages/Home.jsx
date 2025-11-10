import DataForm from '../components/DataForm'
import DataTable from '../components/DataTable'
import HealthCheck from '../components/HealthCheck'
import { useData } from '../hooks/useData'

export default function Home() {
  const {
    items, loading, error,
    createItem, updateItem, deleteItem, refresh
  } = useData(true)

  return (
    <div>
      <HealthCheck />

      <section>
        <h2>Data CRUD</h2>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={refresh}>Refresh</button>
          {loading && <span style={{ color: '#666' }}>Loading…</span>}
          {error && <span style={{ color: 'crimson' }}>{error}</span>}
        </div>

        <DataForm onSubmit={createItem} />
        <DataTable items={items} onDelete={deleteItem} onUpdate={updateItem} />
      </section>
    </div>
  )
}
