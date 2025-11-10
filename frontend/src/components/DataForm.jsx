import { useState } from 'react'

export default function DataForm({ onSubmit, initial }) {
  const [text, setText] = useState(() => JSON.stringify(initial?.content ?? { foo: 'bar' }, null, 2))

  const submit = (e) => {
    e.preventDefault()
    try {
      const content = JSON.parse(text)
      onSubmit(content)
      setText(JSON.stringify({ foo: 'bar' }, null, 2))
    } catch (e) {
      alert('請輸入合法 JSON')
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
      <label>
        content (JSON)
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} style={{ width: '100%' }} />
      </label>
      <button type="submit">Create</button>
    </form>
  )
}