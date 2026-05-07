import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useMyTimezone } from './lib/useMyTimezone'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import FileViewer from './pages/FileViewer'
import Monthly from './pages/Monthly'
import Costs from './pages/Costs'
import Clients from './pages/Clients'
import Settings from './pages/Settings'

function NavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>{title}</p>
      <ul className="flex flex-col gap-px">{children}</ul>
    </div>
  )
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          `block rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
          }`
        }
        style={({ isActive }) => isActive ? {} : { color: 'var(--text-secondary)' }}
      >
        {label}
      </NavLink>
    </li>
  )
}

function MyClock() {
  const [myTz] = useMyTimezone()
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => {
      try {
        setTime(new Date().toLocaleTimeString('en-GB', { timeZone: myTz, hour: '2-digit', minute: '2-digit' }))
      } catch { setTime('') }
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [myTz])
  return (
    <span className="font-mono tnum text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{time}</span>
  )
}

function AppShell() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <aside
        className="sticky top-0 h-screen w-[240px] shrink-0 flex flex-col"
        style={{ borderRight: '1px solid var(--border-faint)', background: 'var(--bg-base)' }}
      >
        <div className="px-6 pt-7 pb-6" style={{ borderBottom: '1px solid var(--border-faint)' }}>
          <span
            className="text-[28px] leading-none font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Ledger
          </span>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>Freelance · 2026</p>
        </div>

        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          <NavGroup title="Overview">
            <NavItem to="/" label="Dashboard" />
            <NavItem to="/monthly" label="Monthly P&L" />
          </NavGroup>
          <NavGroup title="Work">
            <NavItem to="/projects" label="Projects" />
            <NavItem to="/clients" label="Clients" />
          </NavGroup>
          <NavGroup title="Money">
            <NavItem to="/costs" label="Costs" />
          </NavGroup>
        </nav>

        <div className="flex items-center justify-between border-t border-[var(--border-faint)] px-5 py-3">
          <MyClock />
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex size-7 items-center justify-center rounded-md transition-colors ${
                isActive ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
              }`
            }
            aria-label="Settings"
            title="Settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </NavLink>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-[1280px] px-12 py-10">
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
        <Route path="/projects/:projectId/files/:fileId/view" element={<FileViewer />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<Clients />} />
        <Route path="/monthly" element={<Monthly />} />
        <Route path="/costs" element={<Costs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
