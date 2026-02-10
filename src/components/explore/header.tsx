'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Home, Waves, BookOpen, Menu, X } from 'lucide-react';
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
    url: 'https://docs.locale.cash/lending/intro',
    icon: BookOpen,
    external: true,
  },
];

export default function ExploreHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 border-b border-border/40 transition-all duration-200">
      <div className="container flex h-16 md:h-24 items-center justify-between px-4 md:px-6">
        {/* Left: Logo */}
        <div className="flex items-center">
          <Link href="/explore" className="flex items-center">
            <Image
              src="/logo.svg"
              alt="Locale Lending"
              width={180}
              height={48}
              priority
              className="hidden sm:block"
            />
            <Image
              src="/locale-icon.png"
              alt="Locale Lending"
              width={40}
              height={40}
              priority
              className="sm:hidden"
            />
          </Link>
        </div>

        {/* Center: Navigation (Desktop) */}
        <nav className="hidden md:flex items-center space-x-1 p-1 rounded-full bg-muted/50">
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

        {/* Right: Wallet + Mobile Menu Toggle */}
        <div className="flex items-center gap-2">
          <WalletButton />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl">
          <nav className="container px-4 py-3 flex flex-col gap-1">
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
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{item.title}</span>
                  </a>
                );
              }

              return (
                <Link
                  key={item.title}
                  href={item.url}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="font-medium">{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
