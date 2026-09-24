import MatchEntryForm from './components/MatchEntryForm'
import RosterDashboard from './components/RosterDashboard'
import './App.css'

function App() {
  return (
    <>
      <header>
        <h1>Uma Team Trials Score Auditor</h1>
      </header>
      <RosterDashboard />
      <MatchEntryForm />
    </>
  )
}

export default App
