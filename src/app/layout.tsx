import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import RootProviders from '@/providers/root-providers';
import { headers } from 'next/headers';
import { cookieToInitialState } from 'wagmi';
import { config } from '@/utils/cookie';
import { cn } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/auth-options';
import { Toaster } from '@/components/ui/toaster';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Locale Lending',
  description: 'Empowering local communities through Decentralized Finance',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialState = cookieToInitialState(config, (await headers()).get('cookie'));
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={cn('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
        <RootProviders session={session} initialState={initialState}>
          {children}
          <Toaster />
        </RootProviders>
      </body>
    </html>
  );
}
