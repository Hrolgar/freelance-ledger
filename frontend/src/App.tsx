import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Monthly from './pages/Monthly'
import Costs from './pages/Costs'
import Settings from './pages/Settings'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/monthly', label: 'Monthly' },
  { to: '/costs', label: 'Costs' },
  { to: '/settings', label: 'Settings' },
]

function AppShell() {
  return (
    <div className="flex min-h-screen bg-[#0f1117] text-slate-200">
      {/* Sidebar */}
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-slate-700 bg-slate-900">
        <div className="border-b border-slate-700 px-4 py-4">
          <p className="text-[11px] font-semibold text-slate-500">LEDGER</p>
          <h1 className="mt-0.5 text-[15px] font-semibold text-slate-100">Freelance</h1>
        </div>

        <nav className="flex-1 p-2" aria-label="Primary">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex min-h-[36px] items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-700/80 text-slate-100 border-l-2 border-blue-500'
                        : 'border-l-2 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-700 px-4 py-3">
          <p className="font-mono text-[11px] text-slate-500">FY{new Date().getFullYear()}</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <main className="px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
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
