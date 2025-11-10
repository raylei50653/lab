import { get, post, put, patch, del } from '../lib/fetcher'

export const api = {
  health: () => get('/healthz/'),

  // /data/ CRUD
  listData: () => get('/data/'),
  getData: (id) => get(`/data/${id}/`),
  createData: (content) => post('/data/', { json: { content } }),
  updateData: (id, content) => put(`/data/${id}/`, { json: { content } }),
  patchData: (id, content) => patch(`/data/${id}/`, { json: { content } }),
  deleteData: (id) => del(`/data/${id}/`),
}