import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeController } from '@/components/ThemeController';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Freedom at 50 — Your money. Your time. Your next chapter.',
    template: '%s · Freedom at 50',
  },
  description:
    'See what your money makes possible. Explore when work could become optional, compare scenarios, and plan your next chapter — privately, in your browser.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f7f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1522' },
  ],
};

// Set the theme class before first paint to avoid a flash.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem('freedom-at-50')||'{}');var t=(s.state&&s.state.theme)||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <ThemeController />
        {children}
      </body>
    </html>
  );
}
