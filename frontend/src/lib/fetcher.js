const DEFAULT_TIMEOUT = 10000

function withTimeout(promise, ms = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  return [controller, new Promise((resolve, reject) => {
    promise(controller.signal).then(v => { clearTimeout(id); resolve(v) })
      .catch(e => { clearTimeout(id); reject(e) })
  })]
}

export async function http(method, url, { json, headers, timeout } = {}) {
  const rawBase = import.meta.env.VITE_API_BASE_URL
  const base = rawBase && rawBase.trim() !== '' ? rawBase.replace(/\/$/, '') : '/api'
  const full = url.startsWith('http') ? url : `${base}${url}`

  const [controller, run] = withTimeout((signal) => fetch(full, {
    method,
    headers: {
      'Accept': 'application/json',
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : undefined,
    signal,
  }), timeout)

  try {
    const res = await run
    const text = await res.text()
    let data
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    if (!res.ok) throw Object.assign(new Error('HTTP Error'), { status: res.status, data })
    return data
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timeout')
    throw err
  } finally {
    controller.abort()
  }
}

export const get = (url, opts) => http('GET', url, opts)
export const post = (url, opts) => http('POST', url, opts)
export const put = (url, opts) => http('PUT', url, opts)
export const patch = (url, opts) => http('PATCH', url, opts)
export const del = (url, opts) => http('DELETE', url, opts)
