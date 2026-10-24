# Freedom at 50

**Your money. Your time. Your next chapter.**

Freedom at 50 is a privacy-first financial independence planner for high-earning professionals. It answers one question — *when could work become optional?* — with a transparent year-by-year cash-flow model, an interactive Freedom Timeline, a What If? Scenario Lab, and a printable plan report.

No account, no bank connections, no server. Plans are calculated and stored in the browser.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # financial engine + I/O tests (Vitest)
npm run typecheck
npm run lint
npm run build
```

Requires Node 20+.

## What's inside

| Route | Experience |
| --- | --- |
| `/` | Landing page with a live sample projection, pricing and FAQ |
| `/start` | Eight-question guided onboarding (≈2 minutes), including illiquid equity, ending with a first projection |
| `/app` | **My Financial Picture** — KPI cards, sliders + exact inputs, insights, and all editable details |
| `/app/timeline` | **My Freedom Timeline** — main chart with phases, markers, events and per-year tooltips; milestones; income-vs-spending and withdrawal charts; year table; Monte Carlo (beta, Advanced mode) |
| `/app/scenarios` | **What If? Scenario Lab** — create from templates, duplicate, rename, delete; compare up to three; computed tradeoffs |
| `/app/plan` | **My Plan** — rename, duplicate, delete, checkpoints (save/restore), JSON export/import, assumptions review |
| `/report` | Printable report (browser print → PDF) |
| `/methodology` | Plain-language methodology |

Simple mode shows only the essential levers; Advanced mode adds withdrawal strategy, employment phases, other income, one-time events, private equity cases, real estate, downturn stress tests and Monte Carlo.

## Architecture

```
src/lib/engine/     Pure, deterministic financial model — no React
  types.ts          Typed inputs/outputs and conventions
  projection.ts     Year-by-year cash-flow model, display conversion (nominal/real)
  metrics.ts        Plan metrics, Freedom Target age, work-optional search
  milestones.ts     Milestones derived from projections
  insights.ts       Plain-English insights from re-running the model
  scenarios.ts      Scenario templates
  montecarlo.ts     Seeded Monte Carlo (beta)
  validate.ts       Input limits and warnings
src/lib/store.ts    Zustand store persisted to localStorage; import/export
src/components/     UI primitives, charts (Recharts), editors
src/app/            Next.js App Router pages
tests/              Vitest suites
```

The engine runs in nominal dollars internally and reports both nominal and today's-dollar values; the real presentation reconciles exactly (beginning + inflows + real return − outflows = ending). `projectPlan` accepts a per-period return sequence, which is how Monte Carlo reuses the deterministic engine; the per-period step is structured so monthly periods could be added later.

See [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) for formulas, timing conventions and limitations.

## Key product decisions and assumptions

- **Two distinct milestones.** *Freedom Target reached* = portfolio ≥ spending ÷ withdrawal-rate heuristic (3.5% default). *Work-optional age* = earliest age at which stopping **all** paid work funds fixed real spending through the horizon in the deterministic projection. The UI never presents either as a guarantee.
- **No double counting of earnings.** While working full-time, the model uses *net annual savings*. Post-career work phases and other income apply only after full-time work ends.
- **After-tax inputs.** Savings, phase income, events and equity payouts are net after tax. An optional effective tax rate grosses up withdrawals. Tax brackets and account rules are not modeled.
- **Illiquid wealth stays illiquid.** Home equity and company equity never count as investable until a modeled sale/payout.
- **Equity is a range, not a number.** Holdings carry outcomes, a timing window, tax and probability; the app shows work-optional age for every combination, the minimum proceeds the plan needs, and concentration.
- **Conservative timing.** Outflows at the start of the year, inflows at the end.
- **Defaults:** 6% nominal return, 2.5% inflation, 3.5% target withdrawal rate, horizon age 95.
- **Pricing:** the landing page presents a free tier and a $99/year "Freedom Plus" tier; all features are unlocked during early access (there is no payment integration).

## Disclaimer

Freedom at 50 is an educational planning tool, not investment, tax or legal advice. Projections depend entirely on user assumptions and are not guarantees.
