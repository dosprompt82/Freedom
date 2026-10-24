export * from './types';
export * from './math';
export * from './projection';
export * from './metrics';
export * from './milestones';
export * from './insights';
export * from './scenarios';
export * from './validate';
export * from './defaults';
export * from './montecarlo';
export * from './equity';
export * from './equityAnalysis';
export * from './migrate';

import { computeMetrics, targetReachedAge, workOptionalAge } from './metrics';
import { computeMilestones } from './milestones';
import { planInsights } from './insights';
import { analyzeEquity } from './equityAnalysis';
import { projectPlan } from './projection';
import { validateInputs } from './validate';
import type { PlanInputs } from './types';

/** One-call analysis used by the UI. Pure and deterministic. */
export function analyzePlan(inputs: PlanInputs) {
  const projection = projectPlan(inputs);
  const metrics = computeMetrics(projection);
  const targetAge = targetReachedAge(inputs);
  const workOptional = workOptionalAge(inputs);
  const milestones = computeMilestones(projection, { targetAge, workOptional });
  const issues = validateInputs(inputs);
  return { inputs, projection, metrics, targetAge, workOptional, milestones, issues };
}

export type PlanAnalysis = ReturnType<typeof analyzePlan>;

export function analyzeWithInsights(inputs: PlanInputs) {
  const a = analyzePlan(inputs);
  const equity = analyzeEquity(inputs);
  return { ...a, equity, insights: planInsights(inputs, a.projection, a.metrics, { ...a, equity }) };
}
