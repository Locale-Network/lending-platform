'use client';

import { Home, Waves, Plus, BarChart3, Users, UserCheck, Shield } from 'lucide-react';
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

// Menu items.
const items = [
  {
    title: 'Dashboard',
    url: '/admin',
    icon: Home,
  },
];

// Pool management items
const poolItems = [
  {
    title: 'All Pools',
    url: '/admin/pools',
    icon: Waves,
  },
  {
    title: 'Create Pool',
    url: '/admin/pools/create',
    icon: Plus,
  },
  {
    title: 'Analytics',
    url: '/admin/pools/analytics',
    icon: BarChart3,
  },
  {
    title: 'Investors',
    url: '/admin/investors',
    icon: Users,
  },
  {
    title: 'Borrowers',
    url: '/admin/borrowers',
    icon: UserCheck,
  },
  {
    title: 'zkFetch Logs',
    url: '/admin/logs',
    icon: Shield,
  },
];

export default function AdminSidebar() {
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

        <SidebarGroup>
          <SidebarGroupLabel>Pool Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {poolItems.map(item => (
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
