'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ValidationIssue } from '@/lib/engine';
import { Badge, ToneIcon } from '../ui';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[12.5px] font-medium text-ink-3">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function IssuesBanner({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) return null;
  return (
    <div role="status" className="mb-5 rounded-xl border border-caution/30 bg-caution-soft/60 px-4 py-3">
      <ul className="space-y-1">
        {issues.map((i, idx) => (
          <li key={idx} className="flex items-start gap-2 text-[13px] text-ink">
            <ToneIcon tone={i.severity === 'error' ? 'negative' : 'caution'} className="mt-0.5" />
            {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SampleBadge({ isSample }: { isSample: boolean }) {
  if (!isSample) return null;
  return (
    <Badge tone="gold">
      Sample plan ·{' '}
      <Link href="/start" className="underline underline-offset-2">
        build your own
      </Link>
    </Badge>
  );
}

export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11.5px] leading-relaxed text-ink-3 ${className}`}>
      Freedom at 50 provides educational projections based on the assumptions you enter. It is not investment, tax or legal advice, and no projection is a guarantee of future results. Actual returns, inflation, taxes and spending will differ. Consider consulting a qualified financial professional before making major decisions.
    </p>
  );
}
