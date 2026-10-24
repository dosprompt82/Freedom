'use client';

import Link from 'next/link';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ Button */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantCls: Record<Variant, string> = {
  primary: 'bg-ink text-bg hover:opacity-90 dark:bg-accent dark:text-accent-ink shadow-card',
  secondary: 'bg-surface text-ink border border-line hover:border-line-strong shadow-card',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'text-negative hover:bg-negative-soft',
};
const sizeCls: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ variant = 'secondary', size = 'md', className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center rounded-full font-medium transition-[background,opacity,border-color,color] duration-150 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap',
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      {...rest}
    />
  );
});

export function ButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  className,
  children,
  onClick,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center rounded-full font-medium transition-[background,opacity,border-color] duration-150 whitespace-nowrap',
        variantCls[variant],
        sizeCls[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({
  children,
  className,
  as: As = 'section',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx('rounded-2xl border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */

export type Tone = 'positive' | 'neutral' | 'caution' | 'negative' | 'gold';

const toneCls: Record<Tone, string> = {
  positive: 'bg-accent-soft text-accent',
  neutral: 'bg-surface-2 text-ink-2',
  caution: 'bg-caution-soft text-caution',
  negative: 'bg-negative-soft text-negative',
  gold: 'bg-gold-soft text-[color:var(--gold)]',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', toneCls[tone], className)}>
      {children}
    </span>
  );
}

/** Small shape+color marker so tone never relies on color alone. */
export function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  const common = cx('h-4 w-4 shrink-0', className);
  if (tone === 'positive')
    return (
      <svg viewBox="0 0 16 16" className={cx(common, 'text-accent')} aria-hidden>
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
        <path d="M5 8.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (tone === 'caution')
    return (
      <svg viewBox="0 0 16 16" className={cx(common, 'text-caution')} aria-hidden>
        <path d="M8 1.8l6.6 11.6H1.4z" fill="currentColor" opacity="0.15" />
        <path d="M8 6v3.4M8 11.4v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  if (tone === 'negative')
    return (
      <svg viewBox="0 0 16 16" className={cx(common, 'text-negative')} aria-hidden>
        <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="currentColor" opacity="0.15" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className={cx(common, 'text-ink-3')} aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

/* ----------------------------------------------------------------- InfoTip */

/** Accessible definition popover for financial terms. */
export function InfoTip({ term, children }: { term: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`What is ${term}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line-strong text-[10px] font-semibold text-ink-3 hover:text-ink hover:border-ink-3"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="fa-rise absolute left-1/2 top-6 z-50 w-64 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-left text-[12.5px] font-normal leading-relaxed text-ink-2 shadow-float"
        >
          <span className="mb-1 block font-semibold text-ink">{term}</span>
          {children}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------ Number input */

export type NumberFormat = 'money' | 'percent' | 'age' | 'years' | 'number';

function toDisplay(v: number, fmt: NumberFormat): string {
  if (!Number.isFinite(v)) return '';
  if (fmt === 'percent') return String(parseFloat((v * 100).toFixed(2)));
  if (fmt === 'money') return Math.round(v).toLocaleString('en-US');
  return String(v);
}

function fromDisplay(s: string, fmt: NumberFormat): number | null {
  const cleaned = s.replace(/[$,%\s]/g, '').replace(/[kK]$/, '000').replace(/[mM]$/, '000000');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return fmt === 'percent' ? n / 100 : n;
}

function unitFor(fmt: NumberFormat) {
  return fmt === 'percent' ? '%' : fmt === 'years' ? 'yrs' : '';
}

function describe(v: number, fmt: NumberFormat) {
  if (fmt === 'money') return `$${Math.round(v).toLocaleString('en-US')}`;
  if (fmt === 'percent') return `${parseFloat((v * 100).toFixed(2))}%`;
  return String(v);
}

export interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  format?: NumberFormat;
  min?: number;
  max?: number;
  /** Integer-only values (ages, years). */
  integer?: boolean;
  label: string;
  id?: string;
  className?: string;
  hideLabel?: boolean;
  allowNegative?: boolean;
}

/**
 * Precise numeric entry. Values outside [min, max] are adjusted on commit and
 * the adjustment is explained inline — never silently clamped.
 */
export function NumberInput({
  value,
  onChange,
  format = 'number',
  min = -Infinity,
  max = Infinity,
  integer,
  label,
  id,
  className,
  hideLabel = true,
}: NumberInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [text, setText] = useState(toDisplay(value, format));
  const [focused, setFocused] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!focused) setText(toDisplay(value, format));
  }, [value, format, focused]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 6000);
    return () => clearTimeout(t);
  }, [note]);

  const commit = () => {
    const parsed = fromDisplay(text, format);
    if (parsed == null) {
      setText(toDisplay(value, format));
      setNote('Enter a number.');
      return;
    }
    let v = integer ? Math.round(parsed) : parsed;
    if (v < min) {
      setNote(`Adjusted to the minimum of ${describe(min, format)}.`);
      v = min;
    } else if (v > max) {
      setNote(`Adjusted to the maximum of ${describe(max, format)}.`);
      v = max;
    } else if (integer && parsed !== v) {
      setNote(`Rounded to ${v}.`);
    }
    onChange(v);
    setText(toDisplay(v, format));
  };

  const unit = unitFor(format);
  return (
    <div className={cx('relative', className)}>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'mb-1 block text-[13px] text-ink-2'}>
        {label}
      </label>
      <div className="flex h-9 items-center rounded-lg border border-line bg-surface px-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft">
        {format === 'money' && <span className="mr-0.5 text-[13px] text-ink-3">$</span>}
        <input
          id={inputId}
          inputMode="decimal"
          className="tnum w-full min-w-0 bg-transparent text-right text-[14px] text-ink outline-none"
          value={text}
          onFocus={() => setFocused(true)}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-describedby={note ? `${inputId}-note` : undefined}
        />
        {unit && <span className="ml-1 text-[12px] text-ink-3">{unit}</span>}
      </div>
      {note && (
        <p id={`${inputId}-note`} role="status" className="fa-rise mt-1 text-[11.5px] text-caution">
          {note}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Slider field */

export interface SliderFieldProps {
  label: ReactNode;
  ariaLabel: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: NumberFormat;
  /** Hard limits for typed values (default: slider range). */
  hardMin?: number;
  hardMax?: number;
  integer?: boolean;
  hint?: ReactNode;
  display?: (v: number) => string;
}

/** Slider for exploration + numeric box for precision. Typed values may exceed the slider range up to hard limits. */
export function SliderField({
  label,
  ariaLabel,
  value,
  onChange,
  min,
  max,
  step,
  format = 'number',
  hardMin,
  hardMax,
  integer,
  hint,
}: SliderFieldProps) {
  const id = useId();
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="group">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={`${id}-range`} className="text-[13px] font-medium text-ink-2">
          {label}
        </label>
        <NumberInput
          className="w-[132px]"
          label={ariaLabel}
          value={value}
          onChange={onChange}
          format={format}
          min={hardMin ?? min}
          max={hardMax ?? max}
          integer={integer}
        />
      </div>
      <input
        id={`${id}-range`}
        type="range"
        className="fa-range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={Math.max(min, Math.min(max, value))}
        aria-valuetext={describe(value, format)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--fill' as string]: `${pct}%` }}
      />
      {hint && <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{hint}</p>}
    </div>
  );
}

/* ---------------------------------------------------------- Segmented ctrl */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-surface-2 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-full font-medium transition-all duration-150',
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]',
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Switch */

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-surface-3',
        )}
      >
        <span
          className={cx(
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- TextInput */

export function TextInput({
  value,
  onChange,
  label,
  hideLabel,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hideLabel?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'mb-1 block text-[13px] text-ink-2'}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[14px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  hideLabel,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'mb-1 block text-[13px] text-ink-2'}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-[14px] text-ink outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* --------------------------------------------------------------- Disclosure */

export function Disclosure({
  title,
  subtitle,
  children,
  defaultOpen = false,
  badge,
  open: openProp,
  onOpenChange,
  id: anchorId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
}) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOpenState(v));
  const id = useId();
  return (
    <div id={anchorId} className="scroll-mt-20 border-t border-line first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
            {title}
            {badge}
          </span>
          {subtitle && <span className="mt-0.5 block text-[12.5px] text-ink-3">{subtitle}</span>}
        </span>
        <svg
          viewBox="0 0 16 16"
          className={cx('h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div id={id} className="fa-rise px-5 pb-5 sm:px-6">
          {children}
        </div>
      )}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="tnum mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}
