// src/components/ExperimentsPane.tsx
import { useEffect, useState } from 'react'
import { searchExperiments, type Experiment } from '../lib/mlflowApi'

export default function ExperimentsPane({
  onSelect,
  selectedId,
}: {
  onSelect: (exp: { id: string; name: string }) => void
  selectedId: string | null
}) {
  const [items, setItems] = useState<Experiment[]>([])
  const [q, setQ] = useState('') // name filter
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setErr(null)
    searchExperiments({ max_results: 1000 })
      .then((res) => {
        if (!alive) return
        const list = (res.experiments ?? []).sort((a, b) =>
          a.name.localeCompare(b.name)
        )
        setItems(list)
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const filtered = q
    ? items.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
    : items

  return (
    <>
      <input
        placeholder="Filter by name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="input"
      />
      {loading && <div className="muted">Loading…</div>}
      {err && <div className="error">{err}</div>}

      <ul className="list">
        {filtered.map((e) => (
          <li
            key={e.experiment_id}
            onClick={() => onSelect({ id: e.experiment_id, name: e.name })}
            className={selectedId === e.experiment_id ? 'item selected' : 'item'}
            title={e.artifact_location}
          >
            <div className="title">{e.name}</div>
            <div className="sub">id: {e.experiment_id}</div>
          </li>
        ))}
      </ul>
    </>
  )
}
