import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Monthly from './pages/Monthly'
import Costs from './pages/Costs'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/monthly" element={<Monthly />} />
        <Route path="/costs" element={<Costs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
