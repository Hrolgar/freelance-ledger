import { useCallback, useSyncExternalStore } from 'react'
import type { Currency } from '../types'

const KEY = 'freelance-ledger:mainCurrency'
const DEFAULT: Currency = 'NOK'

function getSnapshot(): Currency {
  return (localStorage.getItem(KEY) as Currency) || DEFAULT
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  // Custom event for same-tab updates
  window.addEventListener('mainCurrencyChanged', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('mainCurrencyChanged', callback)
  }
}

export function useMainCurrency() {
  const currency = useSyncExternalStore(subscribe, getSnapshot)

  const setCurrency = useCallback((c: Currency) => {
    localStorage.setItem(KEY, c)
    window.dispatchEvent(new Event('mainCurrencyChanged'))
  }, [])

  return [currency, setCurrency] as const
}
