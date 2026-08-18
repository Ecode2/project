import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { BottomNav } from '@/components/bottom-nav';
import { Toaster } from '@/components/ui/toaster';
import AuthProvider from '@/components/auth/AuthContext';
import { PlayerProvider } from '@/components/player/player-provider';
import { MiniPlayer } from '@/components/player/mini-player';

export const metadata: Metadata = {
  title: 'BookVerse',
  description: 'Listen to any book. A mobile-first reader and audiobook player.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'BookVerse' },
  icons: {
    icon: '/icons/manifest-icon-192.maskable.png',
    apple: '/icons/apple-icon-180.png',
  },
};

// viewportFit=cover lets the fixed chrome sit under the notch/home indicator,
// which the pt-safe/pb-safe utilities then pad back out.
export const viewport: Viewport = {
  themeColor: '#141417',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <html lang="en" className="dark" suppressHydrationWarning>
        <body className="bg-background text-foreground antialiased">
          <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
            <PlayerProvider>
              {/* Bottom padding clears the tab bar + mini-player. */}
              <main className="mx-auto min-h-screen w-full max-w-2xl pb-40">
                {children}
              </main>
              <MiniPlayer />
              <BottomNav />
              <Toaster />
            </PlayerProvider>
          </ThemeProvider>
        </body>
      </html>
    </AuthProvider>
  );
}
