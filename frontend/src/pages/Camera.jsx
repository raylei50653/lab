import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }
function buildQuery(params) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    q.set(k, String(v))
  })
  return q.toString()
}

const PRESETS = [
  { label: '（使用後端預設 CAMERA_URL）', value: '' },
  { label: 'MJPEG 測試源', value: 'http://demo.ivsbroker.com/mjpeg' }, // 換成你可用的
  { label: 'RTSP 範例（需後端轉 MJPEG）', value: 'rtsp://192.168.1.10:554/stream1' },
]

export default function Camera() {
  const [gray, setGray] = useState(false)
  const [width, setWidth] = useState(640)
  const [url, setUrl] = useState('')
  const [inputUrl, setInputUrl] = useState('')
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState('IDLE') // IDLE | CONNECTING | LIVE | ERROR
  const [hint, setHint] = useState('')

  // 代理 or 直連
  const apiBase = import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
    : '/api'
  const controlUrl = `${apiBase}/stream/control/`
  const clientIdRef = useRef(
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
  )
  const clientId = clientIdRef.current

  // 用 key 讓 <img> 在參數變動時確實重建
  const [reloadKey, setReloadKey] = useState(0)
  const bump = () => setReloadKey(k => k + 1)
  const isActive = status === 'LIVE' || status === 'CONNECTING'

  const src = useMemo(() => {
    if (paused) return ''
    const w = clamp(Number(width) || 0, 160, 1920)
    const q = buildQuery({
      gray: gray ? 1 : undefined,
      width: w,
      url: url || undefined,
      client: clientId,
      t: reloadKey, // 破壞快取，確保重連
    })
    return `${apiBase}/stream/${q ? `?${q}` : ''}`
  }, [apiBase, gray, width, url, paused, reloadKey, clientId])

  const sendControl = useCallback((action, opts = {}) => {
    if (!clientId) return
    const payload = JSON.stringify({ action, client: clientId })
    if (opts.beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon(controlUrl, blob)
        return
      } catch (err) {
        // fall through to fetch
      }
    }
    fetch(controlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }, [clientId, controlUrl])

  // 輸入提示：URL 不是 http/rtsp
  useEffect(() => {
    if (!inputUrl) { setHint(''); return }
    if (/^(https?:|rtsp:)/i.test(inputUrl)) setHint('')
    else setHint('看起來不像有效的來源（需 http(s) MJPEG 或 rtsp）')
  }, [inputUrl])

  useEffect(() => {
    setInputUrl(url)
  }, [url])

  const imgRef = useRef(null)
  useEffect(() => {
    if (!src) return
    setStatus('CONNECTING')
    const timer = setTimeout(() => {
      // 太久沒 onload/onerror，提示可能卡連線
      if (status === 'CONNECTING') setStatus('ERROR')
    }, 8000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  useEffect(() => {
    if (!isActive) return
    const send = () => sendControl('ack')
    send()
    const timer = setInterval(send, 5000)
    return () => clearInterval(timer)
  }, [isActive, sendControl])

  const prevActiveRef = useRef(false)
  useEffect(() => {
    if (prevActiveRef.current && !isActive) {
      sendControl('stop')
    }
    prevActiveRef.current = isActive
  }, [isActive, sendControl])

  useEffect(() => {
    const handleUnload = () => sendControl('stop', { beacon: true })
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      sendControl('stop')
    }
  }, [sendControl])

  const handleApplySource = () => {
    const next = inputUrl.trim()
    if (isActive) {
      const ok = window.confirm('更新前請確認舊的 IP camera 已關閉，確定要切換嗎？')
      if (!ok) return
    }
    setPaused(true)
    setStatus('IDLE')
    setUrl(next)
    setTimeout(() => {
      setPaused(false)
      bump()
    }, 500)
  }

  return (
    <section>
      <h2>Camera Stream</h2>

      <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          來源預設
          <select
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
          >
            {PRESETS.map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          自訂來源 URL（選填，空白則用後端環境變數 CAMERA_URL）
          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="rtsp://... 或 http://...（MJPEG）"
          />
          {hint && <small style={{ color: '#c00' }}>{hint}</small>}
        </label>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleApplySource}>
            套用來源
          </button>
          <small style={{ color: '#555' }}>更新前請先確認舊的 IP camera 已關閉</small>
        </div>

        <label>
          寬度（px）
          <input
            type="number" min={160} max={1920} step={10}
            value={width}
            onChange={(e) => setWidth(clamp(Number(e.target.value) || 0, 160, 1920))}
          />
        </label>

        <label>
          <input type="checkbox" checked={gray} onChange={(e) => setGray(e.target.checked)} />
          轉灰階（gray=1）
        </label>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setPaused(p => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={() => {
              // 先卸載 <img> 關閉舊連線
              setPaused(true)
              setStatus('IDLE')
              // 等 500ms 再重建，避免瀏覽器重用舊 TCP
              setTimeout(() => {
                setPaused(false)
                setReloadKey(k => k + 1) // 觸發新 src 與新 <img> 節點
              }, 500)
            }}
          >
            Reload
          </button>

          <span style={{
            color:
              status === 'LIVE' ? 'green' :
              status === 'CONNECTING' ? '#666' :
              status === 'ERROR' ? 'crimson' : '#666'
          }}>
            {status}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {src ? (
          <img
            ref={imgRef}
            key={src}          // 參數變化 → 重新掛載
            src={src}
            alt="stream"
            style={{ maxWidth: '100%', border: '1px solid #ddd' }}
            onLoad={() => {
              setStatus('LIVE')
              sendControl('ack')
            }}
            onError={(e) => {
              setStatus('ERROR')
              sendControl('stop')
              e.currentTarget.alt = '串流連線失敗（檢查 CAMERA_URL / url 參數 / 後端日誌）'
            }}
          />
        ) : (
          <p style={{ color: '#666' }}>串流已暫停</p>
        )}
      </div>

      <details style={{ marginTop: 8 }}>
        <summary>目前請求 URL</summary>
        <code style={{ wordBreak: 'break-all' }}>{src || '(paused)'}</code>
      </details>
    </section>
  )
}
