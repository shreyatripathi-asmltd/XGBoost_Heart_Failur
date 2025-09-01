import { useEffect, useMemo, useState } from 'react'
import { getAllExperimentsCompat, type Experiment } from '../lib/mlflowApi'

const TRAIN_BASE = import.meta.env.VITE_TRAIN_BASE || 'http://127.0.0.1:5055'

export default function RunWizard({
  open, onClose, onRunCreated
}:{
  open: boolean
  onClose: ()=>void
  onRunCreated: (runId: string | null, experimentId: string)=>void
}) {
  const [step, setStep] = useState<1|2|3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[]>([])
  const [code, setCode] = useState<string>('')
  const [syntaxOk, setSyntaxOk] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [experimentId, setExperimentId] = useState<string>('')
  const [runName, setRunName] = useState<string>('manual-run')

  useEffect(() => {
    if (!open) return
    document.body.classList.add('no-scroll')
    return () => document.body.classList.remove('no-scroll')
  }, [open])

  useEffect(() => {
    if (!open) return
    getAllExperimentsCompat().then(setExperiments).catch(()=>{})
  }, [open])

  async function handleFile(f: File) {
    setErr(null)
    const txt = await f.text()
    const lines = txt.split(/\r?\n/).slice(0, 5)
    setPreview(lines)
    setFile(f)
  }

  async function checkSyntax() {
    setBusy(true); setErr(null); setSyntaxOk(null)
    try {
      const res = await fetch(`${TRAIN_BASE}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      if (!res.ok) throw new Error(await res.text())
      const j = await res.json()
      setSyntaxOk(j.ok === true)
      if (!j.ok && j.error) setErr(j.error)
    } catch (e:any) {
      setSyntaxOk(false)
      setErr(String(e))
    } finally { setBusy(false) }
  }

  async function runTraining() {
    if (!file || !experimentId) return
    setBusy(true); setErr(null)
    try {
      const fd = new FormData()
      fd.append('experiment_id', experimentId)
      fd.append('run_name', runName)
      fd.append('code', new Blob([code], { type: 'text/plain' }), 'train.py')
      fd.append('data', file, file.name)

      const res = await fetch(`${TRAIN_BASE}/train`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'failed')
      onRunCreated(j.run_id || null, experimentId)
    } catch (e:any) {
      setErr(String(e))
    } finally { setBusy(false) }
  }

  const canNext1 = !!file
  const canNext2 = !!code && syntaxOk === true
  const codeHint = useMemo(() => (
`# Example: read dataset via TRAIN_DATA_PATH and log to MLflow
import os, mlflow, pandas as pd
mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI","http://127.0.0.1:5000"))
exp_id = os.getenv("MLFLOW_EXPERIMENT_ID")
data_path = os.getenv("TRAIN_DATA_PATH")
df = pd.read_csv(data_path)

with mlflow.start_run(experiment_id=exp_id, run_name=os.getenv("RUN_NAME","manual-run")) as r:
    print("run_id=", r.info.run_id)  # <- helps UI jump directly
    mlflow.log_param("rows", len(df))
    mlflow.log_metric("preview_cols", len(df.columns))
    # … train model, log artifacts/metrics/params …
`.trim()), [])

  if (!open) return null

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-wrap">
        <div className="modal" style={{width:'780px', maxWidth:'95vw'}}>
          <div className="modal-header">
            <h3>Run a model</h3>
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>

          <div className="wizard-steps">
            <div className={step===1?'wstep active':'wstep'}>1. Dataset</div>
            <div className={step===2?'wstep active':'wstep'}>2. Code</div>
            <div className={step===3?'wstep active':'wstep'}>3. Experiment</div>
          </div>

          {step===1 && (
            <div className="modal-body">
              <label className="label">Upload dataset (.csv)</label>
              <input className="input" type="file" accept=".csv,text/csv" onChange={e=>e.target.files && handleFile(e.target.files[0])} />
              {file && (
                <>
                  <div className="small muted">Preview (first 5 lines of {file.name}):</div>
                  <pre className="preview">{preview.join('\n')}</pre>
                </>
              )}
            </div>
          )}

          {step===2 && (
            <div className="modal-body">
              <label className="label">Training code (Python)</label>
              <textarea
                className="input" rows={16}
                placeholder={codeHint}
                value={code} onChange={e=>{ setCode(e.target.value); setSyntaxOk(null) }}
                style={{fontFamily:'ui-monospace,Menlo,Consolas,monospace', whiteSpace:'pre'}}
              />
              <div className="row">
                <button className="btn" onClick={checkSyntax} disabled={!code || busy}>
                  {busy ? 'Checking…' : 'Check syntax'}
                </button>
                {syntaxOk === true && <span className="ok">✓ Looks good</span>}
                {syntaxOk === false && <span className="error">Syntax error</span>}
              </div>
              <div className="muted small">Your script should read the dataset from <code>TRAIN_DATA_PATH</code> and log to MLflow using <code>MLFLOW_TRACKING_URI</code> & <code>MLFLOW_EXPERIMENT_ID</code>.</div>
            </div>
          )}

          {step===3 && (
            <div className="modal-body">
              <label className="label">Choose experiment</label>
              <select className="input" value={experimentId} onChange={e=>setExperimentId(e.target.value)}>
                <option value="" disabled>Select an experiment…</option>
                {experiments.map(e=>(
                  <option key={e.experiment_id} value={e.experiment_id}>{e.name} (id: {e.experiment_id})</option>
                ))}
              </select>

              <label className="label">Run name</label>
              <input className="input" value={runName} onChange={e=>setRunName(e.target.value)} />
              <div className="muted small">The service will set env vars and execute your script so it logs to the selected experiment.</div>
            </div>
          )}

          {err && <div className="error" style={{margin:'8px 0'}}>{err}</div>}

          <div className="modal-actions">
            {step>1 ? <button className="btn ghost" onClick={()=>setStep((s)=> (s-1) as any)} disabled={busy}>Back</button> : <button className="btn ghost" onClick={onClose}>Cancel</button>}
            {step===1 && <button className="btn" onClick={()=>setStep(2)} disabled={!canNext1 || busy}>Next</button>}
            {step===2 && <button className="btn" onClick={()=>setStep(3)} disabled={!canNext2 || busy}>Next</button>}
            {step===3 && <button className="btn" onClick={runTraining} disabled={!experimentId || busy}>{busy ? 'Running…' : 'Run'}</button>}
          </div>
        </div>
      </div>
    </>
  )
}
