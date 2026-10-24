'use client';

import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { analyzeWithInsights } from './engine';
import type { PlanInputs } from './engine/types';
import { useStore } from './store';

/** True once persisted state has been read from localStorage. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Without usable storage (e.g. blocked site data) persist is not attached.
    if (!useStore.persist) {
      setHydrated(true);
      return;
    }
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

/** Full deterministic analysis, recomputed when inputs change (deferred to keep sliders smooth). */
export function useAnalysis(inputs: PlanInputs) {
  const deferred = useDeferredValue(inputs);
  return useMemo(() => analyzeWithInsights(deferred), [deferred]);
}

const reducedQuery = '(prefers-reduced-motion: reduce)';
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(reducedQuery);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}

/** Apply the theme preference to <html>. */
export function useApplyTheme() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
