import './globals.css';
import type { Metadata } from 'next';
//import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { BottomNav } from '@/components/bottom-nav';
import { Toaster } from '@/components/ui/toaster';
import AuthProvider from '@/components/auth/AuthContext';

//const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BookVerse - Your Digital Reading Companion',
  description: 'A modern progressive web app for reading and managing your digital books',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <html lang="en" suppressHydrationWarning>
        <body> {/* className={inter.className}>*/}j
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <main className="min-h-screen pb-16">
              {children}
            </main>
            <BottomNav />
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </AuthProvider>
  );
}