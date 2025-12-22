'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Home, Waves, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import WalletButton from '@/components/wallet-button';
import { cn } from '@/lib/utils';

const navItems = [
  {
    title: 'Dashboard',
    url: '/explore',
    icon: Home,
  },
  {
    title: 'Explore',
    url: '/explore/pools',
    icon: Waves,
  },
  {
    title: 'Docs',
    url: 'https://docs.locale.cash/locale-services/locale-lending',
    icon: BookOpen,
    external: true,
  },
];

export default function ExploreHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 pt-6 border-b border-border/40 transition-all duration-200">
      <div className="container flex h-24 items-center justify-between pb-4">
        {/* Left: Logo */}
        <div className="flex items-center">
          <Link href="/explore" className="flex items-center">
            <Image
              src="/logo.svg"
              alt="Locale Lending"
              width={220}
              height={58}
              priority
              className="hidden md:block"
            />
            <Image
              src="/locale-icon.png"
              alt="Locale Lending"
              width={48}
              height={48}
              priority
              className="md:hidden"
            />
          </Link>
        </div>

        {/* Center: Navigation */}
        <nav className="flex items-center space-x-1 p-1 rounded-full bg-muted/50">
          {navItems.map((item) => {
            const isActive = pathname === item.url || (item.url !== '/explore' && pathname.startsWith(item.url));
            const Icon = item.icon;

            if (item.external) {
              return (
                <a
                  key={item.title}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="ghost"
                    className="gap-2 rounded-full"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Button>
                </a>
              );
            }

            return (
              <Link key={item.title} href={item.url}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'gap-2 rounded-full transition-all duration-200',
                    isActive && 'bg-background shadow-sm'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Right: Wallet */}
        <div className="flex items-center">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
