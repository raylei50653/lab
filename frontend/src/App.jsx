import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Health from './pages/Health'
import DataCrud from './pages/DataCrud'
import Camera from './pages/Camera'

export default function App() {
  const loc = useLocation()
  const Tab = ({ to, children }) => (
    <Link to={to} style={{
      padding: '8px 12px',
      borderBottom: loc.pathname === to ? '2px solid black' : '2px solid transparent',
      textDecoration: 'none', color: 'inherit'
    }}>{children}</Link>
  )

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <h1>React × Django Demo</h1>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Tab to="/health">Health Check</Tab>
        <Tab to="/data">Data CRUD</Tab>
        <Tab to="/camera">Camera</Tab>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/health" replace />} />
        <Route path="/health" element={<Health />} />
        <Route path="/data" element={<DataCrud />} />
        <Route path="/camera" element={<Camera/>} />
      </Routes>
    </div>
  )
}
