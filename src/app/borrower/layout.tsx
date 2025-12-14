'use client';

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import BorrowerSidebar from '@/components/borrower/sidebar';
import BorrowerHeader from '@/components/borrower/header';
import WaveFooter from '@/components/wave-footer';
import AuthGuard from '@/components/auth-guard';
import { Role } from '@prisma/client';

export default function BorrowerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole={[Role.ADMIN, Role.BORROWER]} fallbackUrl="/unauthorized">
      <SidebarProvider>
        <BorrowerSidebar />
        <main className="flex-1 flex flex-col min-h-screen">
          <div className="flex items-center justify-between">
            <SidebarTrigger className="ml-4" />
            <BorrowerHeader />
          </div>
          <div className="container py-6 flex-1">{children}</div>
          <WaveFooter />
        </main>
      </SidebarProvider>
    </AuthGuard>
  );
}
