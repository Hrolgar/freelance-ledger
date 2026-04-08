import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Button, cx } from './ui'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/monthly', label: 'Monthly' },
  { to: '/costs', label: 'Costs' },
  { to: '/settings', label: 'Settings' },
]

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const year = new Date().getFullYear()

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_32%),radial-gradient(circle_at_85%_15%,_rgba(59,130,246,0.12),_transparent_20%)]" />
        <div className="relative flex min-h-screen">
          <aside
            className={cx(
              'border-r border-zinc-800/90 bg-zinc-900/90 transition-all duration-200',
              collapsed ? 'w-20' : 'w-72',
            )}
          >
            <div className="flex h-full flex-col px-4 py-5">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-5">
                {!collapsed ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-300">
                      Ledger
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-white">
                      Freelance Ledger
                    </p>
                  </div>
                ) : (
                  <div className="text-lg font-semibold text-white">FL</div>
                )}
                <Button
                  variant="ghost"
                  className="h-11 w-11 px-0"
                  onClick={() => setCollapsed((value) => !value)}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {collapsed ? '→' : '←'}
                </Button>
              </div>

              <nav className="mt-6 space-y-2" aria-label="Primary">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cx(
                        'flex min-h-11 items-center rounded-xl px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300',
                        isActive
                          ? 'bg-indigo-500/15 text-indigo-100 ring-1 ring-inset ring-indigo-400/30'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white',
                      )
                    }
                  >
                    {collapsed ? item.label.slice(0, 1) : item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-auto rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Active year
                </p>
                <p
                  className="mt-3 text-2xl font-semibold text-white"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {year}
                </p>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-10 border-b border-zinc-800/90 bg-zinc-950/85 backdrop-blur">
              <div className="flex min-h-18 items-center justify-between px-5 sm:px-8">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-white">Freelance Ledger</p>
                  <p className="text-sm text-zinc-400">Revenue, costs, and project flow in one place.</p>
                </div>
                <div
                  className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-300"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {year}
                </div>
              </div>
            </header>

            <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
