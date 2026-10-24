import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { MethodologyContent } from '@/components/MethodologyContent';
import { Disclaimer } from '@/components/plan/common';
import { ButtonLink } from '@/components/ui';

export const metadata: Metadata = { title: 'Methodology' };

export default function MethodologyPage() {
  return (
    <div>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <ButtonLink href="/app" size="sm">
          Open app
        </ButtonLink>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8">
        <p className="text-[13px] font-medium text-accent">Methodology</p>
        <h1 className="mt-3 text-[36px] font-semibold leading-tight tracking-[-0.035em] text-ink">How the numbers are calculated</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
          Transparency over false precision. Every figure in Freedom at 50 can be traced to the assumptions below and to inputs you control.
        </p>
        <MethodologyContent />
        <Disclaimer className="mt-12 border-t border-line pt-6" />
      </main>
    </div>
  );
}
