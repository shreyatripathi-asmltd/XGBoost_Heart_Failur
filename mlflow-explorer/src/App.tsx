import { useState } from 'react'
import ExperimentsPane from './components/ExperimentsPane'
import RunsPane from './components/RunsPane'
import RunDetail from './components/RunDetail'
import StatsPane from './components/StatsPane'
import Drawer from './components/Drawer'
import CreateExperimentModal from './components/CreateExperimentModal'
import RunWizard from './components/RunWizard'
import './index.css'

type Stage = 'experiments' | 'runs' | 'run' | 'stats'

export default function App() {
  const [stage, setStage] = useState<Stage>('experiments')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  const [selectedExperiment, setSelectedExperiment] = useState<{id:string; name:string} | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  function goBack() {
    if (stage === 'run') {
      setStage('runs'); setSelectedRunId(null)
    } else if (stage === 'runs' || stage === 'stats') {
      setStage('experiments'); if (stage === 'runs') setSelectedExperiment(null)
    }
  }

  const stageTitle =
    stage === 'stats' ? 'Experiment Statistics' : 'View Experiment'

  const breadcrumb =
    stage === 'experiments' ? ['Experiment'] :
    stage === 'runs'       ? ['Experiment', 'Run'] :
    stage === 'run'        ? ['Experiment', 'Run', 'Run Details'] :
                             ['Experiment', 'Statistics']

  return (
    <div className="layout">
      {/* Top bar: brand+crumbs (left), ABS centered title, back (right) */}
      <header className="topbar">
        <div className="inner container topgrid rel">
          <div className="left">
            <button className="icon-btn" onClick={()=>setDrawerOpen(true)} aria-label="Open menu">
              <span className="icon-bars" />
            </button>
            <div className="brand-wrap">
              <div className="brand">MLflow Explorer</div>
              <div className="crumbs">
                {breadcrumb.map((c, i) => (
                  <span key={c + i} className="crumb">
                    {c}{i < breadcrumb.length - 1 && <span className="sep">›</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Absolutely centered title so it never shifts */}
          <div className="center-abs" aria-hidden="true">{stageTitle}</div>

          <div className="right">
            {stage !== 'experiments' && (
              <button className="back-btn" onClick={goBack} aria-label="Back">← Back</button>
            )}
          </div>
        </div>
      </header>

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={()=>setDrawerOpen(false)}
        onCreate={()=>{ setCreateOpen(true); setDrawerOpen(false) }}
        onRunModel={()=>{ setWizardOpen(true); setDrawerOpen(false) }}
        onViewExperiment={()=>{ setStage('experiments'); setSelectedRunId(null); setDrawerOpen(false) }}
        onStats={()=>{
          if (!selectedExperiment) { alert('Select an experiment first.'); return }
          setStage('stats'); setDrawerOpen(false)
        }}
        stageTitle={stageTitle}
        breadcrumb={breadcrumb}
      />

      {/* Create Experiment modal */}
      {createOpen && (
        <CreateExperimentModal
          onClose={()=>setCreateOpen(false)}
          onCreated={(exp)=>{ setCreateOpen(false); setSelectedExperiment({id: exp.experiment_id, name: exp.name}); setStage('runs') }}
        />
      )}

      {/* Run Wizard */}
      {wizardOpen && (
        <RunWizard
          open={wizardOpen}
          onClose={()=>setWizardOpen(false)}
          onRunCreated={(runId, expId)=>{
            setWizardOpen(false)
            setSelectedExperiment({ id: expId, name: selectedExperiment?.id===expId ? (selectedExperiment?.name||'') : '' })
            if (runId) { setSelectedRunId(runId); setStage('run') }
            else { setSelectedRunId(null); setStage('runs') }
          }}
        />
      )}

      {/* STAGES */}
      {stage === 'experiments' && (
        <main className="container center">
          <section className="panel panel-lg">
            <h2>Experiments</h2>
            <ExperimentsPane
              onSelect={(exp) => { setSelectedExperiment(exp); setSelectedRunId(null); setStage('runs') }}
              selectedId={selectedExperiment?.id ?? null}
            />
          </section>
        </main>
      )}

      {stage === 'runs' && (
        <main className="container center">
          <section className="panel panel-lg">
            <h2>Runs — {selectedExperiment?.name}</h2>
            <RunsPane
              experimentId={selectedExperiment?.id ?? null}
              onSelectRun={(runId) => { setSelectedRunId(runId); setStage('run') }}
              selectedRunId={selectedRunId}
            />
          </section>
        </main>
      )}

      {stage === 'run' && (
        <main className="container center">
          <section className="panel panel-xl">
            <h2>Run Details</h2>
            <RunDetail runId={selectedRunId} />
          </section>
        </main>
      )}

      {stage === 'stats' && (
        <main className="container center">
          <section className="panel panel-lg">
            <h2>Experiment Statistics — {selectedExperiment?.name}</h2>
            {selectedExperiment && <StatsPane experimentId={selectedExperiment.id} />}
          </section>
        </main>
      )}
    </div>
  )
}
