import { useEffect, useState } from 'react'
import { getExchangeRates } from '../api'
import type { ExchangeRate } from '../types'

/// One shared copy of the exchange-rate table for every component that converts.
///
/// The old per-component cache stored the resolved array, not the request, so every
/// MoneyAmount mounted in the same render fired its own GET (the dashboard fired
/// three on one paint). It also never expired, so rates fetched in Settings were
/// invisible until a hard reload. Here the in-flight promise is shared, and
/// `invalidateRates()` makes every subscriber reload.

let cache: ExchangeRate[] | null = null
let inflight: Promise<ExchangeRate[]> | null = null
// Bumped by invalidateRates(); a response from an older generation is ignored so a
// request that was already in flight cannot overwrite the fresher table.
let generation = 0
const listeners = new Set<() => void>()

export function loadRates(): Promise<ExchangeRate[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    const started = generation
    inflight = getExchangeRates()
      .then((data) => {
        if (started === generation) {
          cache = data
          inflight = null
          listeners.forEach((l) => l())
        }
        return data
      })
      .catch((err: unknown) => {
        if (started === generation) inflight = null
        throw err
      })
  }
  return inflight
}

/// Call after anything that writes rates (a fetch in Settings, an edit) so the
/// tooltips and totals on every page pick the new figures up.
export function invalidateRates(): void {
  generation++
  cache = null
  inflight = null
  listeners.forEach((l) => l())
}

export function useRates(): ExchangeRate[] {
  const [rates, setRates] = useState<ExchangeRate[]>(cache ?? [])

  useEffect(() => {
    let alive = true
    const sync = () => {
      if (cache) {
        setRates(cache)
        return
      }
      loadRates()
        .then((data) => { if (alive) setRates(data) })
        .catch(() => { /* the page's own error handling covers a dead API */ })
    }
    listeners.add(sync)
    sync()
    return () => {
      alive = false
      listeners.delete(sync)
    }
  }, [])

  return rates
}
