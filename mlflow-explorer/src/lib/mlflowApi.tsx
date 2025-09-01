// MLflow REST helpers (experiments, runs, artifacts)
const BASE = import.meta.env.VITE_MLFLOW_BASE || '/api/2.0/mlflow'

export type FileInfo = { path: string; is_dir: boolean; file_size?: number }

export type Experiment = {
  experiment_id: string
  name: string
  lifecycle_stage: string
  artifact_location?: string
  creation_time?: number
  last_update_time?: number
}

export type RunInfo = {
  run_id: string
  run_uuid?: string
  experiment_id: string
  status: string
  start_time?: number
  end_time?: number
  run_name?: string
  lifecycle_stage?: string
  artifact_uri?: string
}

export type RunData = {
  metrics: { key: string; value: number }[]
  params: { key: string; value: string }[]
  tags: { key: string; value: string }[]
}

export type Run = { info: RunInfo; data: RunData }

// ---- core fetch with readable errors ----
async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch {}
    throw new Error(`${res.status} ${res.statusText} @ ${url}${body ? ` — ${body}` : ''}`)
  }
  return res.json() as Promise<T>
}

// ---- Experiments ----
export async function searchExperiments(opts?: {
  filter?: string
  max_results?: number
  page_token?: string
  order_by?: string[]
  view_type?: 'ACTIVE_ONLY' | 'DELETED_ONLY' | 'ALL'
}) {
  const body = JSON.stringify({
    filter: opts?.filter,
    max_results: opts?.max_results ?? 1000,
    page_token: opts?.page_token,
    order_by: opts?.order_by,
    view_type: opts?.view_type ?? 'ACTIVE_ONLY',
  })
  return http<{ experiments?: Experiment[]; next_page_token?: string }>(
    `${BASE}/experiments/search`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
  )
}

export async function listExperiments() {
  return http<{ experiments?: Experiment[] }>(`${BASE}/experiments/list`)
}

export async function getAllExperimentsCompat() {
  try {
    const r = await searchExperiments({ max_results: 1000 })
    return r.experiments ?? []
  } catch {
    const r = await listExperiments()
    return r.experiments ?? []
  }
}

export async function getExperimentById(experiment_id: string) {
  const q = new URLSearchParams({ experiment_id })
  return http<{ experiment: Experiment }>(`${BASE}/experiments/get?${q}`)
}

export async function createExperiment(opts:{ name:string; artifact_location?:string }) {
  const body = JSON.stringify({
    name: opts.name,
    artifact_location: opts.artifact_location || undefined,
  })
  return http<{ experiment_id: string }>(
    `${BASE}/experiments/create`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
  )
}

/** Update experiment metadata (supports rename). */
export async function updateExperiment(opts: { experiment_id: string; new_name?: string }) {
  const body = JSON.stringify({
    experiment_id: opts.experiment_id,
    new_name: opts.new_name || undefined,
  })
  return http<{}>(`${BASE}/experiments/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  })
}

// ---- Runs ----
export async function searchRuns(opts: {
  experiment_ids: string[]
  filter?: string
  max_results?: number
  page_token?: string
  order_by?: string[]
  run_view_type?: 'ACTIVE_ONLY' | 'DELETED_ONLY' | 'ALL'
}) {
  const body = JSON.stringify({
    experiment_ids: opts.experiment_ids,
    filter: opts.filter,
    max_results: opts.max_results ?? 1000,
    page_token: opts.page_token,
    order_by: opts.order_by ?? ['attributes.start_time DESC'],
    run_view_type: opts.run_view_type ?? 'ALL',
  })
  return http<{ runs?: Run[]; next_page_token?: string }>(
    `${BASE}/runs/search`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
  )
}

export async function getRun(run_id: string) {
  return http<{ run: Run }>(`${BASE}/runs/get?run_id=${encodeURIComponent(run_id)}`)
}

/** Create a run record under an experiment (optional if your script calls start_run). */
export async function createRun(opts: {
  experiment_id: string
  run_name?: string
  start_time?: number
  tags?: { key: string; value: string }[]
}) {
  const body = JSON.stringify({
    experiment_id: opts.experiment_id,
    run_name: opts.run_name,
    start_time: opts.start_time ?? Date.now(),
    tags: opts.tags,
  })
  return http<{ run: Run }>(`${BASE}/runs/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  })
}

// ---- Artifacts ----
export async function listArtifacts(run_id: string, path = '') {
  const q = new URLSearchParams({ run_id, path })
  return http<{ files: FileInfo[]; root_uri?: string }>(
    `${BASE}/artifacts/list?${q.toString()}`
  )
}

export async function getMetricHistory(run_id: string, metric_key: string) {
  const q = new URLSearchParams({ run_id, metric_key })
  return http<{ metrics: { key: string; value: number; timestamp: number }[] }>(
    `${BASE}/metrics/get-history?${q.toString()}`
  )
}

export function buildArtifactDownloadURL(run_id: string, filePath: string) {
  const baseOrigin = BASE.startsWith('http')
    ? new URL(BASE).origin
    : window.location.origin
  const u = new URL('/get-artifact', baseOrigin)
  u.searchParams.set('run_uuid', run_id)
  u.searchParams.set('path', filePath)
  return u.toString()
}
