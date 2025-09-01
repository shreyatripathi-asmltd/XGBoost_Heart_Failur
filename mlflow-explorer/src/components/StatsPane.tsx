// src/components/StatsPane.tsx
import { useEffect, useMemo, useState } from 'react'
import { searchRuns, type Run } from '../lib/mlflowApi'

export default function StatsPane({ experimentId }: { experimentId: string }) {
  const [runs, setRuns] = useState<Run[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [metricKey, setMetricKey] = useState('accuracy') // change if your key differs

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    searchRuns({
      experiment_ids: [experimentId],
      max_results: 1000,
      order_by: ['attributes.start_time DESC'],
      run_view_type: 'ALL',
    })
      .then(res => { if (alive) setRuns(res.runs ?? []) })
      .catch(e => setErr(String(e)))
      .finally(()=>setLoading(false))
    return ()=>{ alive = false }
  }, [experimentId])

  const stats = useMemo(() => {
    const vals:number[] = []
    for (const r of runs) {
      const m = r.data.metrics?.find(x => x.key === metricKey)
      if (m) vals.push(m.value)
    }
    if (!vals.length) return null
    vals.sort((a,b)=>a-b)
    const mean = vals.reduce((a,b)=>a+b,0)/vals.length
    const p50 = vals[Math.floor(vals.length*0.5)]
    const p90 = vals[Math.floor(vals.length*0.9)]
    const best = Math.max(...vals)
    return { count: vals.length, mean, p50, p90, best }
  }, [runs, metricKey])

  return (
    <div>
      <div className="bar">
        <label className="mr">Metric key:</label>
        <input className="input small" value={metricKey} onChange={e=>setMetricKey(e.target.value)} placeholder="e.g. accuracy, f1, auc"/>
      </div>

      {loading && <div className="muted">Loading…</div>}
      {err && <div className="error">{err}</div>}

      {stats ? (
        <div className="cards">
          <div className="card stat"><div className="stat-title">Runs</div><div className="stat-val">{stats.count}</div></div>
          <div className="card stat"><div className="stat-title">Mean</div><div className="stat-val">{fmt(stats.mean)}</div></div>
          <div className="card stat"><div className="stat-title">P50</div><div className="stat-val">{fmt(stats.p50)}</div></div>
          <div className="card stat"><div className="stat-title">P90</div><div className="stat-val">{fmt(stats.p90)}</div></div>
          <div className="card stat"><div className="stat-title">Best</div><div className="stat-val">{fmt(stats.best)}</div></div>
        </div>
      ) : (
        <div className="muted">No metric named “{metricKey}” found in these runs.</div>
      )}

      <div className="card">
        <h3>Latest values per run (top 20)</h3>
        <table className="table">
          <thead><tr><th>Run name</th><th>Run id</th><th>{metricKey}</th><th>Started</th></tr></thead>
          <tbody>
            {runs.slice(0,20).map(r=>{
              const m = r.data.metrics?.find(x=>x.key===metricKey)
              return (
                <tr key={r.info.run_id}>
                  <td>{r.info.run_name || '—'}</td>
                  <td className="mono small">{r.info.run_id.slice(0,12)}…</td>
                  <td>{m?.value ?? '—'}</td>
                  <td>{r.info.start_time ? new Date(r.info.start_time).toLocaleString() : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function fmt(n:number){ return Number.isFinite(n) ? Number(n.toFixed(4)) : '—' }
