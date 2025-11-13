import ExploreHeader from '@/components/explore/header';
import ExploreSidebar from '@/components/explore/sidebar';
import WaveFooter from '@/components/wave-footer';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { requireInvestor } from '@/lib/auth/authorization';

export default async function ExploreLayout({ children }: { children: React.ReactNode }) {
  // Protect all explore routes - INVESTOR or ADMIN role required
  await requireInvestor();

  return (
    <SidebarProvider>
      <ExploreSidebar />
      <main className="flex-1 flex flex-col min-h-screen">
        <div className="flex items-center">
          <SidebarTrigger className="ml-4" />
          <ExploreHeader />
        </div>
        <div className="container mx-auto flex-1">{children}</div>
        <WaveFooter />
      </main>
    </SidebarProvider>
  );
}
