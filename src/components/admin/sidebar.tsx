'use client';

import { Home, HomeIcon, Inbox, Waves, Plus, BarChart3, Users } from 'lucide-react';
import { usePathname } from 'next/navigation'; // Add this import
import { getRoleOfAccount } from '@/app/actions';
import { useSession } from 'next-auth/react';
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
import { useCallback, useEffect, useRef } from 'react';
import { Role } from '@prisma/client';

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
];

export default function BorrowerSidebar() {
  const pathname = usePathname(); // Add this hook

  const { data: session, update } = useSession();
  const roleUpdatedRef = useRef(false);

  const updateRole = useCallback(
    (role: Role) => {
      if (session?.user?.role !== role) {
        update({
          ...session,
          user: {
            ...session?.user,
            role: role,
          },
        });
        roleUpdatedRef.current = true;
      }
    },
    [session, update]
  );

  useEffect(() => {
    const fetchRole = async () => {
      if (!session || roleUpdatedRef.current || !session.address) {
        return;
      }

      const role = await getRoleOfAccount(session.address);
      updateRole(role);
    };

    fetchRole();
  }, [session, updateRole]);

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
