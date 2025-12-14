'use client';

import { GalleryHorizontalEnd } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function ViewLoansCard() {
  const router = useRouter();

  const handleClick = () => {
    router.push('/borrower/loans');
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg"
      onClick={handleClick}
    >
      <CardHeader className="space-y-4">
        <div className="h-14 w-14 rounded-xl bg-blue-100 p-4">
          <GalleryHorizontalEnd className="h-6 w-6 text-blue-600" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold">View loan applications</CardTitle>
          <CardDescription className="text-base leading-relaxed text-muted-foreground">
            See the status of your loan applications.
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}
