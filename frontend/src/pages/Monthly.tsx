import { useState, useEffect } from 'react'
import { getDashboardYear, getCosts } from '../api'
import type { YearOverview, Cost } from '../types'
import { MONTH_FULL_NAMES } from '../types'

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-2 text-xl font-semibold font-mono ${color}`}>{value}</p>
    </div>
  )
}

export default function Monthly() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [overview, setOverview] = useState<YearOverview | null>(null)
  const [costs, setCosts] = useState<Cost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([getDashboardYear(year), getCosts(month, year)])
      .then(([ov, cs]) => { setOverview(ov); setCosts(cs) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [year, month])

  const monthData = overview?.months.find(m => m.month === month)
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Monthly P&L</h1>
          <p className="mt-1 text-sm text-zinc-500">Revenue vs costs breakdown</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
          >
            {MONTH_FULL_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {monthData && (
            <div className="grid grid-cols-3 gap-4">
              <SummaryCard label="Revenue" value={`NOK ${fmt(monthData.revenue)}`} color="text-emerald-400" />
              <SummaryCard label="Costs" value={`NOK ${fmt(monthData.costs)}`} color="text-red-400" />
              <SummaryCard
                label="Net Profit"
                value={`NOK ${fmt(monthData.profit)}`}
                color={monthData.profit >= 0 ? 'text-indigo-400' : 'text-red-400'}
              />
            </div>
          )}

          {/* Year context strip */}
          {overview && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">{year} Monthly Profit</h2>
              <div className="grid grid-cols-12 gap-1">
                {overview.months.map((m) => {
                  const isSelected = m.month === month
                  const profitColor = m.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                  return (
                    <button
                      key={m.month}
                      onClick={() => setMonth(m.month)}
                      className={`text-center p-2 rounded-lg transition-colors ${isSelected ? 'bg-indigo-600/20 border border-indigo-500/40' : 'hover:bg-zinc-700'}`}
                    >
                      <p className={`text-xs font-medium ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`}>
                        {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][m.month - 1]}
                      </p>
                      <p className={`text-xs font-mono mt-1 ${profitColor}`}>
                        {m.profit >= 0 ? '+' : ''}{Math.round(m.profit / 1000)}k
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Costs table */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-700">
              <h2 className="text-sm font-semibold text-zinc-300">
                Costs — {MONTH_FULL_NAMES[month - 1]} {year}
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Recurring</th>
                  <th className="text-right px-4 py-3 font-medium">Amount (NOK)</th>
                </tr>
              </thead>
              <tbody>
                {costs.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No costs recorded for this month.</td></tr>
                ) : (
                  costs.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-700/50 last:border-0">
                      <td className="px-4 py-3 text-zinc-200">{c.description}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.category}</td>
                      <td className="px-4 py-3">
                        {c.recurring ? (
                          <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">Recurring</span>
                        ) : (
                          <span className="text-xs text-zinc-600">One-time</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-300">{fmt(c.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {costs.length > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-700 bg-zinc-700/20">
                    <td colSpan={3} className="px-4 py-3 text-xs font-medium text-zinc-400">Total</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-200">
                      {fmt(costs.reduce((s, c) => s + c.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}
