import { useEffect, useState } from 'react'
export default function DataForm({ onSubmit, initial }) {
  const [text, setText] = useState(() => initial?.text ?? '')

  useEffect(() => {
    setText(initial?.text ?? '')
  }, [initial])

  const submit = (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) {
      alert('請輸入內容')
      return
    }
    onSubmit(trimmed)
    setText('')
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
      <label>
        text
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="請輸入內容"
          style={{ width: '100%', padding: 6 }}
        />
      </label>
      <button type="submit">Create</button>
    </form>
  )
}
