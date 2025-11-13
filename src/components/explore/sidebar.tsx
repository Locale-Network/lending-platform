'use client';

import { Home, Waves, Wallet, TrendingUp, History, Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const items = [
  {
    title: 'Dashboard',
    url: '/explore',
    icon: Home,
  },
  {
    title: 'Explore Pools',
    url: '/explore/pools',
    icon: Waves,
  },
  {
    title: 'My Portfolio',
    url: '/explore/portfolio',
    icon: Wallet,
  },
  {
    title: 'Earnings',
    url: '/explore/earnings',
    icon: TrendingUp,
  },
  {
    title: 'Transactions',
    url: '/explore/transactions',
    icon: History,
  },
  {
    title: 'Settings',
    url: '/explore/settings',
    icon: Settings,
  },
];

export default function ExploreSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-center p-6">
            <Image
              src="/logo.svg"
              alt="Locale Lending"
              width={200}
              height={80}
              priority
            />
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
