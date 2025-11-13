import { get, post, put, patch, del } from '../lib/fetcher'

export const api = {
  health: () => get('/healthz/'),

  // /data/ CRUD
  listData: (search) => {
    const query = typeof search === 'string' && search.trim() !== ''
      ? `?search=${encodeURIComponent(search.trim())}`
      : ''
    return get(`/data/${query}`)
  },
  getData: (id) => get(`/data/${id}/`),
  createData: (text) => post('/data/', { json: { text } }),
  updateData: (id, text) => put(`/data/${id}/`, { json: { text } }),
  patchData: (id, text) => patch(`/data/${id}/`, { json: { text } }),
  deleteData: (id) => del(`/data/${id}/`),
}
