import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
import './globals.css';
import RootProviders from '@/providers/root-providers';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Locale Lending',
  description: 'Empowering local communities through Decentralized Finance',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress chrome.runtime.sendMessage errors from browser extensions
              if (typeof window !== 'undefined') {
                const originalError = console.error;
                console.error = function(...args) {
                  if (args[0]?.toString().includes('chrome.runtime.sendMessage') ||
                      args[0]?.toString().includes('Extension ID')) {
                    return;
                  }
                  originalError.apply(console, args);
                };
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className={cn('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
        <RootProviders>
          {children}
          <Toaster />
        </RootProviders>
      </body>
    </html>
  );
}
