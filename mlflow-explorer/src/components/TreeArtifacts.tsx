// src/components/TreeArtifacts.tsx
import { listArtifacts, buildArtifactDownloadURL } from '../lib/mlflowApi'
import { useEffect, useState } from 'react'

type Node = { path: string; is_dir: boolean; file_size?: number }
type Item = Node & { expanded?: boolean; loaded?: boolean; children?: Item[] }

export default function TreeArtifacts({ runId }: { runId: string }) {
  const [root, setRoot] = useState<Item>({ path: '', is_dir: true, loaded: false, children: [] })
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setRoot({ path: '', is_dir: true, loaded: false, children: [] })
    setErr(null)
    loadChildren('') // root
  }, [runId])

  async function loadChildren(path: string) {
    try {
      const { files = [] } = await listArtifacts(runId, path) // note: path always sent
      const kids = files.map(f => ({ ...f } as Item))
      setRoot(prev => updateNode(prev, path, { children: kids, loaded: true, expanded: true }))
    } catch (e: any) {
      setErr(String(e))
    }
  }

  function toggle(item: Item) {
    if (!item.is_dir) return
    if (!item.loaded) loadChildren(item.path)
    setRoot(prev => updateNode(prev, item.path, { expanded: !item.expanded }))
  }

  return (
    <div className="tree-wrap">
      {err && <div className="error">{err}</div>}
      <TreeRow item={root} depth={0} runId={runId} onToggle={toggle} />
    </div>
  )
}

function updateNode(node: Item, targetPath: string, patch: Partial<Item>): Item {
  if (node.path === targetPath) return { ...node, ...patch }
  if (!node.children) return node
  return { ...node, children: node.children.map(c => updateNode(c, targetPath, patch)) }
}

function TreeRow({ item, depth, runId, onToggle }:{
  item: Item; depth: number; runId: string; onToggle: (it: Item)=>void
}) {
  const isRoot = item.path === '' && item.is_dir
  const name = isRoot ? 'root' : item.path.split('/').slice(-1)[0]

  return (
    <>
      <div className="tree-row" style={{ paddingLeft: depth * 16 }}>
        <div className="tree-main">
          {item.is_dir ? (
            <button className="tree-btn" onClick={() => onToggle(item)}>
              {item.expanded ? '▾' : '▸'} {name}/
            </button>
          ) : (
            <span>{name}</span>
          )}
        </div>
        <div className="tree-meta">{item.is_dir ? '' : prettyBytes(item.file_size)}</div>
        <div className="tree-actions">
          {!item.is_dir && (
            <a className="mini-link" href={buildArtifactDownloadURL(runId, item.path)} target="_blank" rel="noreferrer">
              Download
            </a>
          )}
        </div>
      </div>

      {item.is_dir && item.expanded && (
        <>
          {item.loaded
            ? item.children?.map(child => (
                <TreeRow key={child.path} item={child} depth={depth + 1} runId={runId} onToggle={onToggle} />
              ))
            : <div className="muted" style={{ paddingLeft: (depth + 1) * 16 }}>Loading…</div>}
        </>
      )}
    </>
  )
}

function prettyBytes(n?: number) {
  if (typeof n !== 'number') return ''
  if (n < 1024) return `${n} B`
  const u = ['KB','MB','GB','TB']; let i = -1; let x = n
  do { x = x / 1024; i++ } while (x >= 1024 && i < u.length - 1)
  return `${x.toFixed(1)} ${u[i]}`
}
