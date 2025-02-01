'use client';

import { HomeIcon } from 'lucide-react';
import { usePathname } from 'next/navigation'; // Add this import
import { getRoleOfAccount } from '@/app/actions';
import { useSession } from 'next-auth/react';

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
    url: '/approver',
    icon: HomeIcon,
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
          <SidebarGroupLabel>Application</SidebarGroupLabel>
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
