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

function createClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

const PRESETS = [
  { label: '（使用後端預設 CAMERA_URL）', value: '' },
  { label: 'MJPEG 測試源', value: 'http://demo.ivsbroker.com/mjpeg' }, // 換成你可用的
  { label: 'RTSP 範例（需後端轉 MJPEG）', value: 'rtsp://192.168.1.10:554/stream1' },
]

const DISCONNECT_DELAY_MS = 500

export default function Camera() {
  const [gray, setGray] = useState(false)
  const [width, setWidth] = useState(640)
  const [url, setUrl] = useState('')
  const [inputUrl, setInputUrl] = useState('')
  const [userPaused, setUserPaused] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [status, setStatus] = useState('IDLE') // IDLE | CONNECTING | LIVE | ERROR
  const [hint, setHint] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [proof, setProof] = useState(null)
  const [proofError, setProofError] = useState('')
  const paused = userPaused || disconnecting
  const clientId = useMemo(() => createClientId(), [])

  // 代理 or 直連
  const apiBase = import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
    : '/api'

  // 用 key 讓 <img> 在參數變動時確實重建
  const [reloadKey, setReloadKey] = useState(0)
  const triggerReload = useCallback(() => {
    setReloadKey(k => k + 1)
  }, [])

  const forceCloseImage = useCallback(() => {
    const el = imgRef.current
    if (el) {
      el.src = ''
      el.removeAttribute('src')
    }
  }, [])

  const abortStreamOnServer = useCallback(() => {
    if (!clientId) return Promise.resolve()
    const abortUrl = `${apiBase}/stream/abort/?client=${encodeURIComponent(clientId)}`
    return fetch(abortUrl, { method: 'POST' }).catch(() => {})
  }, [apiBase, clientId])

  useEffect(() => () => {
    abortStreamOnServer()
  }, [abortStreamOnServer])

  const disconnectTimerRef = useRef(null)
  const userPausedRef = useRef(userPaused)
  useEffect(() => {
    userPausedRef.current = userPaused
  }, [userPaused])

  const clearDisconnectTimer = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current)
      disconnectTimerRef.current = null
    }
  }, [])

  useEffect(() => () => {
    clearDisconnectTimer()
  }, [clearDisconnectTimer])

  const closeStreamBeforeReconnect = useCallback((after) => {
    clearDisconnectTimer()
    forceCloseImage()
    abortStreamOnServer()
    setDisconnecting(true)
    setStatus('IDLE')
    setStatusMessage('')
    disconnectTimerRef.current = setTimeout(() => {
      disconnectTimerRef.current = null
      setDisconnecting(false)
      if (userPausedRef.current) {
        return
      }
      setStatus('CONNECTING')
      setStatusMessage('')
      after?.()
    }, DISCONNECT_DELAY_MS)
  }, [abortStreamOnServer, clearDisconnectTimer, forceCloseImage])

  const src = useMemo(() => {
    if (paused) return ''
    const w = clamp(Number(width) || 0, 160, 1920)
    const q = buildQuery({
      gray: gray ? 1 : undefined,
      width: w,
      url: url || undefined,
      client: clientId || undefined,
      t: reloadKey, // 破壞快取，確保重連
    })
    return `${apiBase}/stream/${q ? `?${q}` : ''}`
  }, [apiBase, gray, width, url, paused, reloadKey, clientId])

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
    setStatusMessage('')
  }, [src])

  useEffect(() => {
    if (status !== 'CONNECTING' || !src) return
    const rafImpl = typeof window !== 'undefined' ? window.requestAnimationFrame : null
    const cancelImpl = typeof window !== 'undefined' ? window.cancelAnimationFrame : null
    if (!rafImpl || !cancelImpl) return
    let raf = 0
    const detectFirstFrame = () => {
      const el = imgRef.current
      if (el && el.naturalWidth > 0 && el.naturalHeight > 0) {
        setStatus('LIVE')
        setStatusMessage('')
        return
      }
      raf = rafImpl(detectFirstFrame)
    }
    raf = rafImpl(detectFirstFrame)
    return () => cancelImpl(raf)
  }, [status, src])

  useEffect(() => {
    if (paused) {
      setProof(null)
      setProofError('')
      return
    }
    let aborted = false
    const w = clamp(Number(width) || 0, 160, 1920)
    const q = buildQuery({
      gray: gray ? 1 : undefined,
      width: w,
      url: url || undefined,
      client: clientId || undefined,
    })
    const proofUrl = `${apiBase}/stream/proof/${q ? `?${q}` : ''}`
    setProof(null)
    setProofError('')
    fetch(proofUrl, { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error('PROOF_HTTP_ERROR')
        return res.json()
      })
      .then((data) => {
        if (!aborted) {
          setProof(data)
        }
      })
      .catch(() => {
        if (!aborted) {
          setProofError('無法取得後端證明，請稍後再試')
        }
      })
    return () => {
      aborted = true
    }
  }, [apiBase, gray, width, url, reloadKey, paused, clientId])


  const handleApplySource = () => {
    const next = inputUrl.trim()
    setUrl(next)
    setStatus('IDLE')
    setStatusMessage('')
    setUserPaused(false)
    closeStreamBeforeReconnect(() => triggerReload())
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
        </div>

        <label>
          寬度（px）
          <input
            type="number" min={160} max={1920} step={10}
            value={width}
            onChange={(e) => {
              setStatusMessage('')
              setWidth(clamp(Number(e.target.value) || 0, 160, 1920))
              if (!userPaused) {
                closeStreamBeforeReconnect(() => triggerReload())
              }
            }}
          />
        </label>

        <label>
          <input
            type="checkbox"
            checked={gray}
            onChange={(e) => {
              setStatusMessage('')
              setGray(e.target.checked)
              if (!userPaused) {
                closeStreamBeforeReconnect(() => triggerReload())
              }
            }}
          />
          轉灰階（gray=1）
        </label>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              if (userPaused) {
                setUserPaused(false)
                closeStreamBeforeReconnect(() => triggerReload())
              } else {
                abortStreamOnServer()
                forceCloseImage()
                clearDisconnectTimer()
                setDisconnecting(false)
                setUserPaused(true)
                setStatus('IDLE')
                setStatusMessage('')
              }
            }}
          >
            {userPaused ? 'Resume' : 'Pause'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (userPaused) return
              closeStreamBeforeReconnect(() => triggerReload())
            }}
          >
            Reload
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              color:
                status === 'LIVE' ? 'green' :
                status === 'CONNECTING' ? '#666' :
                status === 'ERROR' ? 'crimson' : '#666'
            }}>
              {status}
            </span>
            {statusMessage && (
              <small style={{ color: '#c00' }}>{statusMessage}</small>
            )}
          </div>
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
              setStatusMessage('')
            }}
            onError={(e) => {
              setStatus('ERROR')
              setStatusMessage('串流連線失敗（檢查 CAMERA_URL / url 參數 / 後端日誌）')
              e.currentTarget.alt = '串流連線失敗（檢查 CAMERA_URL / url 參數 / 後端日誌）'
            }}
          />
        ) : (
          <p style={{ color: '#666' }}>
            {userPaused ? '串流已暫停' : disconnecting ? '釋放舊串流，準備重新連線…' : '串流暫停中'}
          </p>
        )}
      </div>

      <div style={{
        marginTop: 12,
        padding: 12,
        border: '1px solid #ddd',
        borderRadius: 4,
        background: '#fafafa',
        maxWidth: 720,
      }}>
        <strong>後端串流證明</strong>
        {paused ? (
          <p style={{ margin: '4px 0 0', color: '#666' }}>
            串流暫停或重新連線中，暫無證明
          </p>
        ) : proof ? (
          <div style={{ marginTop: 4, display: 'grid', gap: 2, fontSize: 14 }}>
            <span>會話 ID：<code>{proof.client_id || clientId}</code></span>
            <span>伺服器時間：{proof.server_time}</span>
            <span>來源協定：{proof.camera_protocol || '未知'}</span>
            <span>來源主機：{proof.camera_host || '未知'}</span>
            <span>請求 ID：<code>{proof.request_id}</code></span>
            <span>來源簽章：<code style={{ wordBreak: 'break-all' }}>{proof.camera_signature}</code></span>
          </div>
        ) : (
          <p style={{ margin: '4px 0 0', color: proofError ? '#c00' : '#666' }}>
            {proofError || '取得後端證明中…'}
          </p>
        )}
      </div>

      <details style={{ marginTop: 8 }}>
        <summary>目前請求 URL</summary>
        <code style={{ wordBreak: 'break-all' }}>{src || '(paused)'}</code>
      </details>
    </section>
  )
}
