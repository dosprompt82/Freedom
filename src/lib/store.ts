'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { samplePlanInputs, uid } from './engine/defaults';
import { normalizeInputs } from './engine/migrate';
import { templateById } from './engine/scenarios';
import type { DollarMode, PlanInputs } from './engine/types';

/**
 * Client-side persistence only. Plans live in this browser's localStorage and
 * are never sent anywhere — privacy by design. Export/import moves them.
 */

export const SCENARIO_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'] as const;
export const BASE_ID = 'base';
export const MAX_COMPARE = 3;
const MAX_VERSIONS = 25;

export interface Scenario {
  id: string;
  name: string;
  description: string;
  inputs: PlanInputs;
  createdAt: number;
  updatedAt: number;
}

export interface PlanVersion {
  id: string;
  label: string;
  savedAt: number;
  name: string;
  inputs: PlanInputs;
  scenarios: Scenario[];
}

export interface Plan {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isSample: boolean;
  inputs: PlanInputs;
  scenarios: Scenario[];
  /** Up to three ids; BASE_ID refers to the plan's own inputs. */
  compare: string[];
  versions: PlanVersion[];
}

export type UiMode = 'simple' | 'advanced';
export type ThemePref = 'system' | 'light' | 'dark';

interface State {
  plans: Plan[];
  activePlanId: string | null;
  dollarMode: DollarMode;
  uiMode: UiMode;
  theme: ThemePref;

  createPlan: (opts: { name: string; inputs: PlanInputs; isSample?: boolean }) => string;
  openSample: () => string;
  setActivePlan: (id: string) => void;
  updateInputs: (fn: (prev: PlanInputs) => PlanInputs) => void;
  renamePlan: (id: string, name: string) => void;
  duplicatePlan: (id: string) => string | null;
  deletePlan: (id: string) => void;
  saveVersion: (label?: string) => void;
  restoreVersion: (versionId: string) => void;
  deleteVersion: (versionId: string) => void;
  importPlan: (plan: Plan) => string;

  addScenario: (opts: { templateId?: string; fromId?: string; name?: string }) => string | null;
  updateScenario: (id: string, fn: (prev: PlanInputs) => PlanInputs) => void;
  renameScenario: (id: string, name: string, description?: string) => void;
  deleteScenario: (id: string) => void;
  toggleCompare: (id: string) => void;

  setDollarMode: (m: DollarMode) => void;
  setUiMode: (m: UiMode) => void;
  setTheme: (t: ThemePref) => void;
}

function now() {
  return Date.now();
}

function makePlan(name: string, inputs: PlanInputs, isSample = false): Plan {
  const t = now();
  return {
    id: uid('plan'),
    name,
    createdAt: t,
    updatedAt: t,
    isSample,
    inputs,
    scenarios: [],
    compare: [BASE_ID],
    versions: [],
  };
}

function withSampleScenarios(plan: Plan): Plan {
  const ids = ['retire-55', 'downturn'];
  const scenarios = ids
    .map((id) => templateById(id))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({
      id: uid('scn'),
      name: t.name,
      description: t.description,
      inputs: t.apply(plan.inputs),
      createdAt: now(),
      updatedAt: now(),
    }));
  return { ...plan, scenarios, compare: [BASE_ID, ...scenarios.map((s) => s.id)].slice(0, MAX_COMPARE) };
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const patchActive = (fn: (p: Plan) => Plan) =>
        set((s) => ({
          plans: s.plans.map((p) => (p.id === s.activePlanId ? { ...fn(p), updatedAt: now() } : p)),
        }));

      return {
        plans: [],
        activePlanId: null,
        dollarMode: 'real',
        uiMode: 'simple',
        theme: 'system',

        createPlan: ({ name, inputs, isSample }) => {
          const plan = makePlan(name, inputs, isSample);
          set((s) => ({ plans: [plan, ...s.plans], activePlanId: plan.id }));
          return plan.id;
        },

        openSample: () => {
          const existing = get().plans.find((p) => p.isSample);
          if (existing) {
            set({ activePlanId: existing.id });
            return existing.id;
          }
          const plan = withSampleScenarios(makePlan('Sample plan — the Rivera household', samplePlanInputs(), true));
          set((s) => ({ plans: [plan, ...s.plans], activePlanId: plan.id }));
          return plan.id;
        },

        setActivePlan: (id) => set({ activePlanId: id }),

        updateInputs: (fn) => patchActive((p) => ({ ...p, inputs: fn(p.inputs) })),

        renamePlan: (id, name) =>
          set((s) => ({ plans: s.plans.map((p) => (p.id === id ? { ...p, name, updatedAt: now() } : p)) })),

        duplicatePlan: (id) => {
          const src = get().plans.find((p) => p.id === id);
          if (!src) return null;
          const copy: Plan = {
            ...structuredClone(src),
            id: uid('plan'),
            name: `${src.name} (copy)`,
            createdAt: now(),
            updatedAt: now(),
            isSample: false,
          };
          set((s) => ({ plans: [copy, ...s.plans], activePlanId: copy.id }));
          return copy.id;
        },

        deletePlan: (id) =>
          set((s) => {
            const plans = s.plans.filter((p) => p.id !== id);
            return {
              plans,
              activePlanId: s.activePlanId === id ? (plans[0]?.id ?? null) : s.activePlanId,
            };
          }),

        saveVersion: (label) =>
          patchActive((p) => {
            const v: PlanVersion = {
              id: uid('ver'),
              label: label?.trim() || new Date().toLocaleString(),
              savedAt: now(),
              name: p.name,
              inputs: structuredClone(p.inputs),
              scenarios: structuredClone(p.scenarios),
            };
            return { ...p, versions: [v, ...p.versions].slice(0, MAX_VERSIONS) };
          }),

        restoreVersion: (versionId) =>
          patchActive((p) => {
            const v = p.versions.find((x) => x.id === versionId);
            if (!v) return p;
            const scenarios = structuredClone(v.scenarios);
            const valid = new Set([BASE_ID, ...scenarios.map((s) => s.id)]);
            return {
              ...p,
              inputs: structuredClone(v.inputs),
              scenarios,
              compare: p.compare.filter((c) => valid.has(c)),
            };
          }),

        deleteVersion: (versionId) =>
          patchActive((p) => ({ ...p, versions: p.versions.filter((v) => v.id !== versionId) })),

        importPlan: (plan) => {
          const copy: Plan = { ...plan, id: uid('plan'), updatedAt: now(), isSample: false };
          set((s) => ({ plans: [copy, ...s.plans], activePlanId: copy.id }));
          return copy.id;
        },

        addScenario: ({ templateId, fromId, name }) => {
          const plan = get().plans.find((p) => p.id === get().activePlanId);
          if (!plan) return null;
          const template = templateId ? templateById(templateId) : undefined;
          const source =
            fromId && fromId !== BASE_ID ? plan.scenarios.find((s) => s.id === fromId) : undefined;
          const baseInputs = source ? source.inputs : plan.inputs;
          const scn: Scenario = {
            id: uid('scn'),
            name:
              name ??
              (template
                ? template.name
                : source
                  ? `${source.name} (copy)`
                  : fromId === BASE_ID
                    ? 'Copy of current plan'
                    : 'New scenario'),
            description: template?.description ?? source?.description ?? 'Starts from your current plan.',
            inputs: template ? template.apply(baseInputs) : structuredClone(baseInputs),
            createdAt: now(),
            updatedAt: now(),
          };
          patchActive((p) => ({
            ...p,
            scenarios: [...p.scenarios, scn],
            compare: p.compare.length < MAX_COMPARE ? [...p.compare, scn.id] : p.compare,
          }));
          return scn.id;
        },

        updateScenario: (id, fn) =>
          patchActive((p) => ({
            ...p,
            scenarios: p.scenarios.map((s) => (s.id === id ? { ...s, inputs: fn(s.inputs), updatedAt: now() } : s)),
          })),

        renameScenario: (id, name, description) =>
          patchActive((p) => ({
            ...p,
            scenarios: p.scenarios.map((s) =>
              s.id === id ? { ...s, name, description: description ?? s.description, updatedAt: now() } : s,
            ),
          })),

        deleteScenario: (id) =>
          patchActive((p) => ({
            ...p,
            scenarios: p.scenarios.filter((s) => s.id !== id),
            compare: p.compare.filter((c) => c !== id),
          })),

        toggleCompare: (id) =>
          patchActive((p) => {
            if (p.compare.includes(id)) return { ...p, compare: p.compare.filter((c) => c !== id) };
            if (p.compare.length >= MAX_COMPARE) return p;
            return { ...p, compare: [...p.compare, id] };
          }),

        setDollarMode: (dollarMode) => set({ dollarMode }),
        setUiMode: (uiMode) => set({ uiMode }),
        setTheme: (theme) => set({ theme }),
      };
    },
    {
      name: 'freedom-at-50',
      version: 2,
      // v1 → v2: the single privateEquity block became a list of equity holdings.
      migrate: (persisted) => {
        const st = persisted as { plans?: Plan[] };
        return {
          ...st,
          plans: (st.plans ?? []).map((p) => ({
            ...p,
            inputs: normalizeInputs(p.inputs),
            scenarios: p.scenarios.map((sc) => ({ ...sc, inputs: normalizeInputs(sc.inputs) })),
            versions: p.versions.map((v) => ({ ...v, inputs: normalizeInputs(v.inputs), scenarios: v.scenarios.map((sc) => ({ ...sc, inputs: normalizeInputs(sc.inputs) })) })),
          })),
        } as unknown as State;
      },
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function useActivePlan(): Plan | null {
  return useStore((s) => s.plans.find((p) => p.id === s.activePlanId) ?? null);
}

/** Validate and normalize an imported JSON file. Throws with a readable message. */
export function parsePlanFile(text: string): Plan {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const obj = data as { app?: string; plan?: Plan };
  const plan = obj?.app === 'freedom-at-50' ? obj.plan : (data as Plan);
  if (!plan || typeof plan !== 'object' || !plan.inputs || typeof plan.inputs.currentAge !== 'number') {
    throw new Error('This does not look like a Freedom at 50 plan export.');
  }
  const inputs = normalizeInputs(plan.inputs);
  return {
    id: uid('plan'),
    name: plan.name || 'Imported plan',
    createdAt: plan.createdAt || now(),
    updatedAt: now(),
    isSample: false,
    inputs,
    scenarios: Array.isArray(plan.scenarios) ? plan.scenarios.map((sc) => ({ ...sc, inputs: normalizeInputs(sc.inputs) })) : [],
    compare: Array.isArray(plan.compare) ? plan.compare.slice(0, MAX_COMPARE) : [BASE_ID],
    versions: Array.isArray(plan.versions)
      ? plan.versions.map((v) => ({ ...v, inputs: normalizeInputs(v.inputs), scenarios: v.scenarios.map((sc) => ({ ...sc, inputs: normalizeInputs(sc.inputs) })) }))
      : [],
  };
}

export function exportPlanFile(plan: Plan): string {
  return JSON.stringify({ app: 'freedom-at-50', format: 1, exportedAt: new Date().toISOString(), plan }, null, 2);
}
