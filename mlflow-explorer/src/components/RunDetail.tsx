import { useEffect, useMemo, useState } from 'react'
import { getRun, type Run } from '../lib/mlflowApi'

export default function RunDetail({ runId }: { runId: string | null }) {
  const [run, setRun] = useState<Run | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!runId) { setRun(null); return }
      setLoading(true); setErr(null)
      try {
        const { run } = await getRun(runId)
        if (alive) setRun(run)
      } catch (e:any) {
        if (alive) setErr(String(e))
      } finally { if (alive) setLoading(false) }
    }
    load()
    return () => { alive = false }
  }, [runId])

  const info = useMemo(() => {
    const i = run?.info
    return {
      run_id: i?.run_id ?? '',
      name: i?.run_name ?? '',
      status: i?.status ?? '',
      start: i?.start_time ? new Date(i.start_time).toLocaleString() : '',
      end: i?.end_time ? new Date(i.end_time).toLocaleString() : '',
      artifact_uri: i?.artifact_uri ?? '',
    }
  }, [run])

  const params = run?.data?.params ?? []
  const metrics = run?.data?.metrics ?? []

  if (!runId) return <div className="muted">Select a run from the <b>Experiment</b> tab.</div>
  if (loading) return <div className="muted">Loading run…</div>
  if (err) return <div className="error">{err}</div>
  if (!run) return null

  return (
    <div className="run-grid">
      {/* Run Info */}
      <section className="section-card">
        <h3 className="section-title">Run Info</h3>
        <div className="kv fixed">
          <div className="key">run_id</div>
          <div className="val mono wrap">{info.run_id}</div>

          <div className="key">name</div>
          <div className="val">{info.name}</div>

          <div className="key">status</div>
          <div className="val">{info.status}</div>

          <div className="key">start</div>
          <div className="val">{info.start}</div>

          <div className="key">end</div>
          <div className="val">{info.end}</div>

          <div className="key">artifact_uri</div>
          <div className="val mono wrap">{info.artifact_uri}</div>
        </div>
      </section>

      {/* Params */}
      <section className="section-card">
        <h3 className="section-title">Params</h3>
        <div className="kv fixed">
          {params.length === 0 && <div className="muted small">No params logged.</div>}
          {params.map(p => (
            <FragmentKV key={p.key} k={p.key} v={p.value} />
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section className="section-card">
        <h3 className="section-title">Metrics (latest)</h3>
        <div className="kv fixed">
          {metrics.length === 0 && <div className="muted small">No metrics logged.</div>}
          {metrics.map(m => (
            <FragmentKV key={m.key} k={m.key} v={String(m.value)} />
          ))}
        </div>
      </section>
    </div>
  )
}

function FragmentKV({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div className="key">{k}</div>
      <div className="val mono wrap">{v}</div>
    </>
  )
}
