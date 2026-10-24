import Link from 'next/link';

export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  // A horizon line with a rising arc: the moment work becomes optional.
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <path d="M7 21.5h18" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <path d="M9.5 21.5a6.5 6.5 0 0 1 13 0" stroke="var(--gold)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="11" r="1.6" fill="var(--gold)" />
    </svg>
  );
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Freedom at 50 home">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
        Freedom <span className="font-normal text-ink-2">at</span> 50
      </span>
    </Link>
  );
}
