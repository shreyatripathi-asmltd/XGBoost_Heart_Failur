// src/components/ArtifactsBrowser.tsx
import { useEffect, useState } from 'react'
import { listArtifacts, buildArtifactDownloadURL } from '../lib/mlflowApi'

type Node = { path: string; is_dir: boolean; file_size?: number }

export default function ArtifactsBrowser({ runId }: { runId: string }) {
  const [cwd, setCwd] = useState<string>('') // current path within artifacts
  const [files, setFiles] = useState<Node[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setErr(null)
    listArtifacts(runId, cwd || undefined)
      .then((res) => {
        if (!alive) return
        setFiles(res.files || [])
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
    return () => {
      alive = false
    }
  }, [runId, cwd])

  const crumbs = [''].concat(cwd ? cwd.split('/').filter(Boolean) : [])
  const crumbPath = (idx: number) =>
    crumbs.slice(1, idx + 1).join('/')

  return (
    <div>
      <div className="breadcrumbs">
        <span onClick={() => setCwd('')} className="crumb">root</span>
        {crumbs.slice(1).map((c, i) => (
          <span key={i}>
            <span className="sep">/</span>
            <span onClick={() => setCwd(crumbPath(i + 1))} className="crumb">{c}</span>
          </span>
        ))}
      </div>

      {loading && <div className="muted">Loading…</div>}
      {err && <div className="error">{err}</div>}

      <table className="table files">
        <thead><tr><th>Name</th><th>Size</th><th></th></tr></thead>
        <tbody>
          {files.map((f) => {
            const name = f.path.split('/').slice(-1)[0]
            return (
              <tr key={f.path}>
                <td>
                  {f.is_dir ? (
                    <button className="link" onClick={() => setCwd(f.path)}>{name}/</button>
                  ) : (
                    <span>{name}</span>
                  )}
                </td>
                <td>{f.is_dir ? '' : (typeof f.file_size === 'number' ? prettyBytes(f.file_size) : '')}</td>
                <td>
                  {!f.is_dir && (
                    <a href={buildArtifactDownloadURL(runId, f.path)} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`
  const u = ['KB','MB','GB','TB']
  let i = -1
  do { n = n / 1024; i++ } while (n >= 1024 && i < u.length-1)
  return `${n.toFixed(1)} ${u[i]}`
}
