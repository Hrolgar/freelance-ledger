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
const listeners = new Set<() => void>()

export function loadRates(): Promise<ExchangeRate[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = getExchangeRates()
      .then((data) => {
        cache = data
        inflight = null
        listeners.forEach((l) => l())
        return data
      })
      .catch((err: unknown) => {
        inflight = null
        throw err
      })
  }
  return inflight
}

/// Call after anything that writes rates (a fetch in Settings, an edit) so the
/// tooltips and totals on every page pick the new figures up.
export function invalidateRates(): void {
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
