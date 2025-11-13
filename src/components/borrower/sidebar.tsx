'use client';

import { HandCoins, Home, User } from 'lucide-react';
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
    title: 'Home',
    url: '/borrower',
    icon: Home,
  },
  {
    title: 'Loans',
    url: '/borrower/loans',
    icon: HandCoins,
  },
  {
    title: 'Account',
    url: '/borrower/account',
    icon: User,
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
      </SidebarContent>
    </Sidebar>
  );
}
