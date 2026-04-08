import { useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Monthly from './pages/Monthly'
import Costs from './pages/Costs'
import Settings from './pages/Settings'

const navItems = [
  { to: '/', label: 'Dashboard', shortLabel: 'DB' },
  { to: '/projects', label: 'Projects', shortLabel: 'PR' },
  { to: '/monthly', label: 'Monthly', shortLabel: 'MO' },
  { to: '/costs', label: 'Costs', shortLabel: 'CO' },
  { to: '/settings', label: 'Settings', shortLabel: 'SE' },
]

function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const currentYear = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="grid min-h-screen lg:grid-cols-[auto_1fr]">
        <aside
          className={`border-r border-zinc-800 bg-zinc-900/90 transition-[width] duration-200 ${
            collapsed ? 'w-20' : 'w-72'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-5">
              <div className={collapsed ? 'hidden' : 'block'}>
                <p className="text-xs uppercase tracking-[0.35em] text-indigo-300">
                  Personal Finance
                </p>
                <h1 className="mt-2 text-xl font-semibold text-zinc-50">
                  Freelance Ledger
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-sm text-zinc-200 transition hover:border-indigo-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? '»' : '«'}
              </button>
            </div>

            <nav className="flex-1 px-3 py-5" aria-label="Primary">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `flex min-h-11 items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                          isActive
                            ? 'border-indigo-500 bg-indigo-500/15 text-indigo-100'
                            : 'border-transparent bg-transparent text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100'
                        } ${collapsed ? 'justify-center' : ''}`
                      }
                    >
                      <span className="font-mono text-xs tracking-[0.25em] text-indigo-300">
                        {item.shortLabel}
                      </span>
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-zinc-800 px-4 py-4 text-xs text-zinc-500">
              {collapsed ? `FY${String(currentYear).slice(2)}` : `Financial year ${currentYear}`}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
                  Freelance Finance Tracker
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-50">
                  Freelance Ledger
                </p>
              </div>
              <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 font-mono text-sm text-indigo-200">
                {currentYear}
              </div>
            </div>
          </header>

          <main className="px-5 py-6 lg:px-8">
            <Outlet />
          </main>
        </div>
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
