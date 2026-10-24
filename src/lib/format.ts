export interface MoneyFormat {
  compact?: boolean;
  /** Round to a sensible precision for prose ("approximately $420,000"). */
  approx?: boolean;
  signed?: boolean;
}

/** Round to 2 significant figures, at least to the nearest $1,000 (for prose). */
export function roundForProse(n: number): number {
  const abs = Math.abs(n);
  if (abs < 1000) return Math.round(n);
  const mag = Math.pow(10, Math.floor(Math.log10(abs)) - 1);
  const step = Math.max(1000, mag);
  return Math.round(n / step) * step;
}

export function formatMoney(n: number, opts: MoneyFormat = {}): string {
  if (!Number.isFinite(n)) return '—';
  let v = opts.approx ? roundForProse(n) : n;
  const sign = v < 0 ? '−' : opts.signed && v > 0 ? '+' : '';
  v = Math.abs(v);
  if (opts.compact) {
    if (v >= 999.5e6) return `${sign}$${trim(v / 1e9, 2)}B`;
    if (v >= 999.5e3) return `${sign}$${trim(v / 1e6, v >= 1e8 ? 0 : v >= 1e7 ? 1 : 2)}M`;
    if (v >= 999.5) return `${sign}$${trim(v / 1e3, v >= 1e5 ? 0 : 1)}K`;
    return `${sign}$${Math.round(v)}`;
  }
  return `${sign}$${Math.round(v).toLocaleString('en-US')}`;
}

function trim(n: number, digits: number): string {
  return String(parseFloat(n.toFixed(digits)));
}

export function formatPct(rate: number, digits = 1): string {
  if (!Number.isFinite(rate)) return '—';
  return `${trim(rate * 100, digits)}%`;
}

export function formatAge(age: number): string {
  return `age ${age}`;
}

export function formatYears(n: number): string {
  return `${n} year${n === 1 ? '' : 's'}`;
}
