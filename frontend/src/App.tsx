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
          <NavGroup title="Setup">
            <NavItem to="/settings" label="Settings" />
          </NavGroup>
        </nav>

        <div className="px-6 py-3" style={{ borderTop: '1px solid var(--border-faint)' }}>
          <MyClock />
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
