'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useHydrated } from '@/lib/hooks';
import { useActivePlan, useStore, type ThemePref } from '@/lib/store';
import { Logo } from './Logo';
import { ButtonLink, Segmented, cx } from './ui';

const NAV = [
  { href: '/app', label: 'Financial Picture', icon: 'M3 13h4v6H3zM10 8h4v11h-4zM17 4h4v15h-4z' },
  { href: '/app/timeline', label: 'Freedom Timeline', icon: 'M3 17c4-1 6-9 10-9s4 5 8 3M3 21h18' },
  { href: '/app/scenarios', label: 'Scenario Lab', icon: 'M9 3v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V3M8 3h8' },
  { href: '/app/plan', label: 'My Plan', icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7' },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const plan = useActivePlan();
  const { dollarMode, setDollarMode, uiMode, setUiMode, theme, setTheme } = useStore();
  const [menu, setMenu] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Logo href="/" />
          <nav aria-label="Primary" className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                    active ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink',
                  )}
                >
                  <NavIcon d={n.icon} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {hydrated && plan && (
              <>
                <div className="hidden md:block">
                  <Segmented
                    label="Dollar display"
                    value={dollarMode}
                    onChange={setDollarMode}
                    size="sm"
                    options={[
                      { value: 'real', label: "Today's $", title: 'Inflation-adjusted to today’s purchasing power' },
                      { value: 'nominal', label: 'Future $', title: 'Nominal dollars in each future year' },
                    ]}
                  />
                </div>
                <div className="hidden sm:block">
                  <Segmented
                    label="Interface mode"
                    value={uiMode}
                    onChange={setUiMode}
                    size="sm"
                    options={[
                      { value: 'simple', label: 'Simple' },
                      { value: 'advanced', label: 'Advanced' },
                    ]}
                  />
                </div>
              </>
            )}
            <ThemeButton theme={theme} setTheme={setTheme} />
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 lg:hidden"
              aria-label="Open menu"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <path d={menu ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} />
              </svg>
            </button>
          </div>
        </div>
        {menu && (
          <div className="fa-rise border-t border-line bg-bg px-4 pb-4 pt-2 lg:hidden">
            <nav aria-label="Mobile" className="grid gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenu(false)}
                  aria-current={pathname === n.href ? 'page' : undefined}
                  className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px]', pathname === n.href ? 'bg-surface text-ink shadow-card' : 'text-ink-2')}
                >
                  <NavIcon d={n.icon} />
                  {n.label}
                </Link>
              ))}
            </nav>
            {hydrated && plan && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Segmented label="Dollar display" value={dollarMode} onChange={setDollarMode} size="sm" options={[{ value: 'real', label: "Today's $" }, { value: 'nominal', label: 'Future $' }]} />
                <Segmented label="Interface mode" value={uiMode} onChange={setUiMode} size="sm" options={[{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }]} />
              </div>
            )}
          </div>
        )}
      </header>

      <main id="main" className="mx-auto max-w-[1440px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        {!hydrated ? (
          <LoadingState />
        ) : !plan ? (
          <EmptyState />
        ) : (
          children
        )}
      </main>
    </div>
  );
}

function ThemeButton({ theme, setTheme }: { theme: ThemePref; setTheme: (t: ThemePref) => void }) {
  const next: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
  const label = theme === 'system' ? 'Theme: system' : theme === 'light' ? 'Theme: light' : 'Theme: dark';
  return (
    <button
      onClick={() => setTheme(next[theme])}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
      aria-label={`${label}. Click to change.`}
      title={label}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        {theme === 'dark' ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        ) : theme === 'light' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </>
        )}
      </svg>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading your plan">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  );
}

function EmptyState() {
  const openSample = useStore((s) => s.openSample);
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-ink">No plan yet</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
        Build your own plan in about two minutes, or explore a sample household first. Nothing leaves your browser.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/start" variant="primary" size="lg">
          Build My Freedom Plan
        </ButtonLink>
        <button
          onClick={() => openSample()}
          className="inline-flex h-12 items-center rounded-full border border-line bg-surface px-6 text-[15px] font-medium text-ink shadow-card"
        >
          Explore a Sample Plan
        </button>
      </div>
    </div>
  );
}
