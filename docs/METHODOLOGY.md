# Methodology

This document describes the Freedom at 50 financial engine (`src/lib/engine`). The in-app `/methodology` page is a plain-language version.

## Periods and units

- Annual periods. Period `t = 0` is the current year, when the household is `currentAge`. The projection runs through the year the household is `planningHorizonAge` (inclusive).
- Money inputs are in **today's dollars** unless labeled otherwise (fixed future-dollar events, equity payouts, mortgage payments, property sale overrides).
- The engine computes in **nominal** dollars. `priceStart = (1+i)^t`, `priceEnd = (1+i)^(t+1)`.

## Timing convention

```
outflowsStart = withdrawal + one-time expenses          (start of year)
invested      = max(0, begin − outflowsStart)
return        = invested × r
end           = invested + return + contributions + surplus + windfalls   (end of year)
```

Today's-dollar amounts are priced at the moment they occur: start-of-year flows × `priceStart`, end-of-year flows × `priceEnd`. With constant inflation this is exactly equivalent to running the model in real terms with the Fisher real return `(1+n)/(1+i) − 1`. With no outflows, `end = begin × (1+r) + contribution` — the standard end-of-year contribution formula (verified against the closed form in tests).

"Portfolio at age X" = beginning balance of the year the household is X. "End of plan" = ending balance of the horizon year.

## Accumulation

While `age < retirementAge`: `contribution_t = annualSavings × (1 + savingsRealGrowth)^t × priceEnd`. Savings are net of taxes and household spending, so no separate income or spending is modeled while working full-time (mortgage payments and other costs are implicitly covered).

## After full-time work

- Spending: `retirementSpending × priceStart` (or a work phase's spending override).
- Income: active work phases (`annualNetIncome × (1+g)^(years into phase) × priceStart`) plus other income streams (inflation-adjusted or fixed). Phases and streams never apply before `retirementAge`.
- A phase marked *covers spending* earns exactly the year's spending + housing not met by other income; nothing is withdrawn (under either strategy) and its entered income is ignored. `phaseSummaries` reports the after-tax income this requires.
- Housing costs are added only for properties marked "costs separate from spending" (carrying costs × priceStart + actual mortgage payment), until a sale.

### Fixed real spending

`need = spending + housing − income`. If `need > 0`: `withdrawal = need / (1 − taxRate)`; otherwise `−need` is invested at year end.

### Percentage of portfolio

`withdrawal = rate × begin`. Spendable = `withdrawal × (1 − taxRate) + income`. Years where spendable < spending need are counted as lifestyle shortfalls; the strategy is never treated as equivalent to fixed real spending.

### Depletion

If outflows exceed the beginning balance, the balance goes to zero and the excess is recorded as `unfunded`. Depletion age = first year with unfunded spending. Later inflows can still rebuild the balance.

## Events, equity, real estate

- One-time events: positive amounts arrive at year end, negative amounts leave at year start; inflated if marked today's dollars.
- Company equity (`equity.ts`, `equityAnalysis.ts`): each holding has pre-tax conservative/base/optimistic values, an effective tax rate, earliest/expected/latest payout ages, a probability of paying out, and a payout period. The main projection uses the plan-wide outcome and timing; net proceeds `value × (1 − tax)` arrive in equal year-end parts over the payout period. A holding marked *requires employment* forfeits any installment that falls in a year when full-time work has already ended (age ≥ retirement age), so work-optional searches never count on a payout the household would have left behind. Analyses: a work-optional age for every outcome × timing plus no payout; the minimum after-tax proceeds (bisection over a scale of the base case at the expected age) for the plan as entered to last through the horizon; base-case share of net worth (investable + equity + home equity); probability-weighted value `p × (0.25·cons + 0.5·base + 0.25·opt)`; an uncertainty band of balances across all outcomes.
- Property: value grows at its appreciation rate; mortgages amortize as `balance × (1 + rate) − payment`. A planned sale adds `value × (1 − selling costs) − remaining mortgage` (or the override) once. Equity is otherwise excluded from investable assets.

## Market downturn

Replaces the return in the downturn year with `−decline`, then `recoveryReturn` for `recoveryYears`, then the base return. Deterministic stress test, not a probability.

## Derived measures

- **Work-optional age** = smallest `R ≥ currentAge` such that retiring at `R` with fixed real spending, all work phases removed, has no unfunded year through the horizon.
- **Insights** re-run the model with one change (retire 2 years later, spend $15,000 less, 25% decline in the first retirement year vs. ten years later, returns −1 pt, no work phases, no equity payout) and quote the computed differences, rounded to two significant figures.

## Monte Carlo (beta)

2,000 paths; annual nominal returns `exp(μ + σZ) − 1` with `σ² = ln(1 + v²/(1+m)²)` and `μ = ln(1+m) − σ²/2`, so the arithmetic mean equals the input return `m` and the standard deviation equals `v`. Inflation is held constant so real and nominal stay coherent. Equity holdings are drawn per path: pays out with its probability; outcome 25/50/25 conservative/base/optimistic; age uniform over the window. Mulberry32 PRNG with a fixed seed for reproducibility. Limitations: independent draws (no autocorrelation or regimes), thin lognormal tails, no inflation–return correlation, single asset class.

## Not modeled

Tax brackets, account-specific withdrawal ordering, RMDs, Roth conversions, Social Security claiming rules, healthcare-specific costs, monthly timing, multiple asset classes.
