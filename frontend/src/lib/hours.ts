/// Helpers shared by the hourly panel and the month sheet: month keys, rate
/// categories, and the client-side mirror of the server's rate resolution rule.
import type { ProjectRate } from '../types'
import { MONTH_FULL_NAMES } from '../types'

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return `${MONTH_FULL_NAMES[month - 1]} ${year}`
}

export function lastDayOfMonth(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return `${key}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
}

export function shiftMonth(key: string, by: number): string {
  const [year, month] = key.split('-').map(Number)
  const d = new Date(year, month - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/// Distinct rate categories on the project, in alphabetical order. The standard
/// (uncategorised) rate is not in this list; it is the '' option everywhere.
export function categoriesOf(rates: ProjectRate[]): string[] {
  const seen = new Map<string, string>()
  for (const r of rates) {
    if (r.category && !seen.has(r.category.toLowerCase())) seen.set(r.category.toLowerCase(), r.category)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

export const STANDARD_LABEL = 'Standard'

export function categoryLabel(category: string | null | undefined): string {
  return category && category.length > 0 ? category : STANDARD_LABEL
}

/// The rate the server would snapshot for this category on this date, for the live
/// amount preview while a row is being edited. Same rule as RateResolutionService.
export function rateFor(rates: ProjectRate[], category: string, date: string): ProjectRate | undefined {
  const wanted = category.toLowerCase()
  return rates
    .filter((r) => (r.category ?? '').toLowerCase() === wanted && r.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.id - a.id)[0]
}

