/** Short, plain-language definitions surfaced through InfoTips. */
export const GLOSSARY = {
  investable:
    'Money you could draw on to fund your life: brokerage accounts, 401(k)s and IRAs, Roth accounts, cash. Exclude your home equity and private company stock that cannot be sold yet.',
  savings:
    'What you add to investments each year after taxes and household spending — including 401(k) contributions and employer match. Enter it in today’s dollars.',
  spending:
    'Your annual after-tax lifestyle budget once full-time work ends, in today’s dollars. It does not have to match what you spend today.',
  nominalReturn:
    'The average annual return on your whole portfolio before inflation. A diversified stock-and-bond mix has historically returned roughly 5–8% nominal, with wide year-to-year variation.',
  inflation:
    'How fast prices rise each year. The model grows your spending with inflation and can show every figure in today’s or future dollars.',
  realReturn:
    'Return after inflation: (1 + nominal return) ÷ (1 + inflation) − 1. At 6% nominal and 2.5% inflation that is 3.41%, not 3.5%.',
  todaysDollars:
    'Future amounts converted back to today’s purchasing power. $1M in 20 years at 2.5% inflation is about $610K in today’s dollars.',
  futureDollars:
    'Nominal amounts as they will actually appear on statements in that year, before adjusting for inflation.',
  workOptional:
    'The earliest age at which you could stop all paid work and still fund your spending through your planning horizon — in a single projection with steady returns. Real markets are uneven, so treat it as a guide.',
  fixedReal:
    'You spend the same inflation-adjusted amount every year. The portfolio absorbs market ups and downs, and can run out.',
  percentage:
    'You withdraw a fixed percentage of whatever the portfolio is worth each year. Your income rises and falls with markets, and the portfolio never fully runs out.',
  sequence:
    'Poor returns early in retirement do more damage than the same returns later, because withdrawals lock in losses while the portfolio is largest.',
  monteCarlo:
    'Runs thousands of hypothetical return paths to show a range of outcomes. Useful for seeing dispersion, but only as good as its assumptions.',
  horizon: 'The last age the plan funds. 95 is a common conservative default for planning.',
  netAfterTax:
    'Enter what actually lands in your account after taxes, fees and withholding. The model does not calculate taxes on one-time events.',
} as const;
