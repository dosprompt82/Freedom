/** Plain-language methodology. Shared by /methodology and the printable report. */
export function MethodologyContent({ compact = false }: { compact?: boolean }) {
  const H = ({ children }: { children: React.ReactNode }) => (
    <h3 className={`${compact ? 'mt-5 text-[14px]' : 'mt-10 text-[18px]'} font-semibold tracking-[-0.01em] text-ink`}>{children}</h3>
  );
  const P = ({ children }: { children: React.ReactNode }) => (
    <p className={`mt-2 ${compact ? 'text-[12.5px]' : 'text-[14.5px]'} leading-relaxed text-ink-2`}>{children}</p>
  );
  const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="tnum rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] text-ink">{children}</code>
  );
  return (
    <div>
      <H>Annual cash-flow model</H>
      <P>
        Freedom at 50 projects your investable portfolio one year at a time, from your current age through the end of your planning horizon (age 95 by default). Each year records the beginning balance, contributions, employment and other income, spending, any modeled taxes, one-time cash flows, withdrawals, investment returns and the ending balance. The year-by-year model is used rather than a closed-form formula so that phases, events and stress tests can be layered in; with no events it reproduces the standard future-value formula exactly.
      </P>

      <H>Timing conventions</H>
      <P>
        Money leaving the portfolio — withdrawals for spending, housing costs paid from the portfolio, and one-time expenses — is taken at the <strong>start</strong> of each year. Money entering the portfolio — savings, income surpluses, windfalls and sale proceeds — arrives at the <strong>end</strong> of each year. The year’s return is applied to what remains invested:
      </P>
      <P>
        <Code>Ending = (Beginning − Outflows) × (1 + Return) + Inflows</Code>
      </P>
      <P>
        During accumulation this is <Code>Ending = Beginning × (1 + Return) + Contribution</Code>. Both conventions are mildly conservative, and they are applied identically to every scenario. “Portfolio at age X” means the balance on reaching that age, after the prior year’s contributions.
      </P>

      <H>Inflation, today’s dollars and future dollars</H>
      <P>
        You enter savings, spending and income in today’s dollars. The model inflates each amount to the year it occurs and computes in nominal (future) dollars, then converts back for display. The real return uses the exact relationship <Code>(1 + nominal) ÷ (1 + inflation) − 1</Code>, not simple subtraction. Every screen labels which dollars it shows. In today’s-dollar views, the “investment return” line is the return after inflation.
      </P>

      <H>Freedom Target</H>
      <P>
        An illustrative portfolio size: <Code>annual retirement spending ÷ withdrawal-rate assumption</Code> (3.5% by default, editable), plus any housing carrying costs you choose to pay on top of spending. Reaching it is a rule of thumb, not proof that a plan works, and no withdrawal rate is universally safe.
      </P>

      <H>Work-optional age</H>
      <P>
        A stricter test than the Freedom Target. The model tries each possible stopping age and finds the earliest at which you could stop <em>all</em> paid work — no consulting or part-time phases — spend your fixed real budget, and never run short through the planning horizon, using your return, inflation, income and event assumptions. It is a single steady-return path, so real-world outcomes will differ.
      </P>

      <H>Withdrawal strategies</H>
      <P>
        <strong>Fixed real spending:</strong> you spend the same inflation-adjusted amount every year; income and pensions reduce what the portfolio must supply, and surpluses are reinvested. <strong>Percentage of portfolio:</strong> each year you withdraw a set share of the beginning balance. Income then rises and falls with markets, and the portfolio never fully depletes; the model reports the years when this falls short of your spending target rather than treating the two strategies as equivalent.
      </P>

      <H>Work after full-time employment</H>
      <P>
        Consulting or part-time phases use after-tax take-home income and apply only after full-time work ends. While you work full-time, your annual savings are already net of income and spending, so earnings are never counted twice. Phase income covers spending first; any surplus is invested at year end. A phase can instead be set to cover all expenses: it is assumed to earn exactly what you spend each year, nothing is withdrawn from the portfolio, and the app shows how much that work needs to bring in.
      </P>

      <H>Taxes</H>
      <P>
        Taxes are not calculated automatically. Savings, incomes and one-time events are entered as net after-tax amounts. You may set a single effective tax rate on portfolio withdrawals, which grosses them up: a $100,000 need at 20% requires a $125,000 withdrawal. Account-specific rules (required distributions, Roth conversions, capital-gains rates) are not modeled.
      </P>

      <H>Real estate and private equity</H>
      <P>
        Home equity is never counted as spendable. A property affects the portfolio only when you model a sale (net proceeds after selling costs and the remaining mortgage, added once) or choose to pay its costs from the portfolio after full-time work. Mortgage payoff dates come from your balance, rate and payment.
      </P>

      <H>Company equity</H>
      <P>
        Each holding has conservative, base and optimistic pre-tax values, an effective tax rate, an earliest, expected and latest payout age, a chance of paying out at all, and an optional number of years over which proceeds arrive. Nothing counts as investable until it pays out; proceeds then arrive after tax at year end. The main projection uses the outcome and timing you choose. Alongside it, the model computes the work-optional age for every outcome and timing (and for no payout), the minimum after-tax proceeds your plan needs to last through the horizon (found by searching payout sizes at the expected age), and the share of your net worth the base case represents. The probability-weighted value is chance × (25% conservative + 50% base + 25% optimistic); Monte Carlo draws each holding’s outcome and timing with the same weights.
      </P>

      <H>Stress tests and Monte Carlo</H>
      <P>
        A market downturn replaces one year’s return with the decline you choose, optionally followed by a set recovery return. It is a deterministic “what if,” not a probability. The beta Monte Carlo simulation draws 2,000 seeded paths of independent lognormal annual returns with your mean and chosen volatility while holding inflation constant. It illustrates dispersion; it does not capture fat tails, momentum, regime changes or the link between inflation and returns.
      </P>

      <H>Insights</H>
      <P>
        Each observation is generated by re-running the model with one assumption changed — two more years of work, $15,000 less spending, a 25% early decline, returns one point lower — and reporting the computed difference, rounded for readability. No figure is estimated by hand.
      </P>

      <H>Limitations</H>
      <P>
        Returns are assumed constant unless you stress-test them; real markets are volatile, and the order of returns matters. The model uses one return for all accounts, annual rather than monthly steps, and your own estimates of spending, income and events. It is an educational tool and not investment, tax or legal advice.
      </P>
    </div>
  );
}
