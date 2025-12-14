'use client';

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AdminSidebar from '@/components/admin/sidebar';
import AdminHeader from '@/components/admin/header';
import WaveFooter from '@/components/wave-footer';
import AuthGuard from '@/components/auth-guard';
import { Role } from '@prisma/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole={Role.ADMIN} fallbackUrl="/unauthorized">
      <SidebarProvider>
        <AdminSidebar />
        <main className="flex-1 flex flex-col min-h-screen">
          <div className="flex items-center justify-between">
            <SidebarTrigger className="ml-4" />
            <AdminHeader />
          </div>
          <div className="container py-6 flex-1">{children}</div>
          <WaveFooter />
        </main>
      </SidebarProvider>
    </AuthGuard>
  );
}
