import MatchEntryForm from './components/MatchEntryForm'
import RosterDashboard from './components/RosterDashboard'
import OcrDebugPanel from './components/OcrDebugPanel'
import './App.css'

function App() {
  return (
    <>
      <header>
        <h1>Uma Team Trials Score Auditor</h1>
      </header>
      <RosterDashboard />
      <MatchEntryForm />
      {import.meta.env.DEV && <OcrDebugPanel />}
    </>
  )
}

export default App
