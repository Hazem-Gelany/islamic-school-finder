'use client';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

export type CompareItem = { id: string; name: string };
const KEY = 'isf-compare', EVT = 'isf-compare-change';
export const COMPARE_MAX = 4;
const read = () => { try { return localStorage.getItem(KEY) ?? '[]'; } catch { return '[]'; } };
const subscribe = (cb: () => void) => { window.addEventListener('storage', cb); window.addEventListener(EVT, cb); return () => { window.removeEventListener('storage', cb); window.removeEventListener(EVT, cb); }; };

/** The compare list lives in the visitor's browser (no account needed) and stays in sync across tabs and components. */
export function useCompare() {
  const raw = useSyncExternalStore(subscribe, read, () => '[]');
  const items = useMemo<CompareItem[]>(() => {
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((x) => typeof x?.id === 'string' && typeof x?.name === 'string').slice(0, COMPARE_MAX) : []; } catch { return []; }
  }, [raw]);
  const write = useCallback((next: CompareItem[]) => { try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ } window.dispatchEvent(new Event(EVT)); }, []);
  return {
    items,
    has: (id: string) => items.some((i) => i.id === id),
    toggle: (item: CompareItem) => write(items.some((i) => i.id === item.id) ? items.filter((i) => i.id !== item.id) : items.length < COMPARE_MAX ? [...items, item] : items),
    remove: (id: string) => write(items.filter((i) => i.id !== id)),
    clear: () => write([]),
  };
}
