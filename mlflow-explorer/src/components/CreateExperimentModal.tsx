import { useEffect, useState } from 'react'
import { createExperiment } from '../lib/mlflowApi'

export default function CreateExperimentModal({
  onClose, onCreated
}:{
  onClose: ()=>void
  onCreated: (exp:{experiment_id:string; name:string})=>void
}) {
  const [name, setName] = useState('')
  const [artifactLocation, setArtifactLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Lock background scroll while modal is open
  useEffect(() => {
    document.body.classList.add('no-scroll')
    return () => document.body.classList.remove('no-scroll')
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setLoading(true)
    try {
      const res = await createExperiment({
        name: name.trim(),
        artifact_location: artifactLocation.trim() || undefined,
      })
      onCreated({ experiment_id: res.experiment_id, name: name.trim() })
    } catch (e:any) {
      setErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-wrap" role="dialog" aria-modal="true">
        <div className="modal">
          <div className="modal-header">
            <h3>Create Experiment</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <form onSubmit={submit} className="modal-body">
            <label className="label">Name</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} required />

            <label className="label">Artifact location (optional)</label>
            <input className="input" value={artifactLocation} onChange={e=>setArtifactLocation(e.target.value)} placeholder="e.g. file:/path/to/mlartifacts" />

            {err && <div className="error">{err}</div>}

            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn" disabled={loading || !name}>{loading ? 'Creating…' : 'Create'}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
