import { useState } from 'react'
import { api } from '../services/api'

export default function HealthCheck() {
  const [status, setStatus] = useState('UNKNOWN')

  const ping = async () => {
    try {
      const res = await api.health()
      setStatus(res?.ok ? 'OK' : 'BAD')
      alert(JSON.stringify(res))
    } catch {
      setStatus('BAD')
      alert('healthz failed')
    }
  }

  return (
    <section>
      <h2>Health Check</h2>
      <button onClick={ping}>ping /healthz</button>
      <span style={{ marginLeft: 8, color: status === 'OK' ? 'green' : '#666' }}>
        {status}
      </span>
    </section>
  )
}
