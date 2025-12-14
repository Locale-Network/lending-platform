'use client';

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import ApproverSidebar from '@/components/approver/sidebar';
import ApproverHeader from '@/components/approver/header';
import AdminSidebar from '@/components/admin/sidebar';
import AdminHeader from '@/components/admin/header';
import WaveFooter from '@/components/wave-footer';
import AuthGuard from '@/components/auth-guard';
import { usePrivyAuthState } from '@/components/privy-wallet-button';
import { Role } from '@prisma/client';

function ApproverLayoutContent({ children }: { children: React.ReactNode }) {
  const authState = usePrivyAuthState();
  const role = authState?.role as Role | undefined;

  return (
    <SidebarProvider>
      {role === Role.APPROVER && <ApproverSidebar />}
      {role === Role.ADMIN && <AdminSidebar />}
      <main className="flex-1 flex flex-col min-h-screen">
        <div className="flex items-center justify-between">
          <SidebarTrigger className="ml-4" />
          {role === Role.APPROVER && <ApproverHeader />}
          {role === Role.ADMIN && <AdminHeader />}
        </div>
        <div className="container py-6 flex-1">{children}</div>
        <WaveFooter />
      </main>
    </SidebarProvider>
  );
}

export default function ApproverLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole={[Role.ADMIN, Role.APPROVER]}>
      <ApproverLayoutContent>{children}</ApproverLayoutContent>
    </AuthGuard>
  );
}
