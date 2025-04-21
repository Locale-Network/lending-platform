'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ApplyLoanCard() {
  const router = useRouter();

  const handleClick = () => {
    router.push('/borrower/loans/apply');
  };

  return (
    <div>
      <Card
        className="cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg"
        onClick={handleClick}
      >
        <CardHeader className="space-y-4">
          <div className="h-14 w-14 rounded-xl bg-blue-100 p-4">
            <Pencil className="h-6 w-6 text-blue-600" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold">Apply for loan</CardTitle>
            <CardDescription className="text-base leading-relaxed text-muted-foreground">
              Funds are distributed through a decentralized loan pool contract.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
