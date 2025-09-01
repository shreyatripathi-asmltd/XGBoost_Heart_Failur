// src/components/RunsPane.tsx
import { useEffect, useState } from 'react'
import { searchRuns, type Run } from '../lib/mlflowApi'

export default function RunsPane({
  experimentId,
  onSelectRun,
  selectedRunId,
}: {
  experimentId: string | null
  onSelectRun: (runId: string) => void
  selectedRunId: string | null
}) {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState('') // MLflow filter expression

  useEffect(() => {
    if (!experimentId) {
      setRuns([])
      return
    }
    let alive = true
    setLoading(true)
    setErr(null)
    searchRuns({
      experiment_ids: [experimentId],
      filter: filter || undefined,
      max_results: 1000,
      order_by: ['attributes.start_time DESC'],
    })
      .then((res) => {
        if (!alive) return
        setRuns(res.runs ?? [])
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
    return () => {
      alive = false
    }
  }, [experimentId, filter])

  if (!experimentId) {
    return <div className="muted">Select an experiment.</div>
  }

  return (
    <>
      <input
        placeholder={`Filter (e.g. metrics.accuracy > 0.9)`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="input"
      />
      {loading && <div className="muted">Loading…</div>}
      {err && <div className="error">{err}</div>}

      <ul className="list">
        {runs.map((r) => (
          <li
            key={r.info.run_id}
            onClick={() => onSelectRun(r.info.run_id)}
            className={selectedRunId === r.info.run_id ? 'item selected' : 'item'}
            title={r.info.run_name || r.info.run_id}
          >
            <div className="title">{r.info.run_name || r.info.run_id}</div>
            <div className="sub">
              status: {r.info.status} · start:{' '}
              {r.info.start_time ? new Date(r.info.start_time).toLocaleString() : '—'}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
