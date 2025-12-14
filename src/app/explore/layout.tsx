import ExploreHeader from '@/components/explore/header';
import WaveFooter from '@/components/wave-footer';
import { requireInvestor } from '@/lib/auth/authorization';

export default async function ExploreLayout({ children }: { children: React.ReactNode }) {
  // Protect all explore routes - INVESTOR or ADMIN role required
  await requireInvestor();

  return (
    <div className="flex flex-col min-h-screen">
      <ExploreHeader />
      <main className="container mx-auto flex-1">{children}</main>
      <WaveFooter />
    </div>
  );
}
