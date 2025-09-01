import React from 'react'

export default function Drawer({
  open, onClose, onCreate, onRunModel, onViewExperiment, onStats,
  stageTitle, breadcrumb
}:{
  open: boolean
  onClose: ()=>void
  onCreate: ()=>void
  onRunModel: ()=>void
  onViewExperiment: ()=>void
  onStats: ()=>void
  stageTitle: string
  breadcrumb: string[]
}) {
  return (
    <>
      <div className={open ? 'drawer drawer-open' : 'drawer'}>
        <div className="drawer-header">
          <div>
            <div className="drawer-title">Dashboard</div>
            <div className="drawer-context">
              <div className="context-title">{stageTitle}</div>
              <div className="breadcrumb">{breadcrumb.join(' › ')}</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <nav className="drawer-nav">
          <button className="drawer-item" onClick={onCreate}>
            <span className="glyph">＋</span>
            <span className="drawer-text">Create an Experiment</span>
          </button>

          <button className="drawer-item" onClick={onRunModel}>
            <span className="glyph">⚙</span>
            <span className="drawer-text">Run a model</span>
          </button>

          <button className="drawer-item" onClick={onViewExperiment}>
            <span className="glyph">🧪</span>
            <span className="drawer-text">View Experiment</span>
          </button>

          <button className="drawer-item" onClick={onStats}>
            <span className="glyph">📈</span>
            <span className="drawer-text">Experiment Statistics</span>
          </button>
        </nav>
      </div>

      {open && <div className="drawer-backdrop" onClick={onClose} />}
    </>
  )
}
