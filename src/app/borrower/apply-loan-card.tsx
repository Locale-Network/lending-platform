'use client';

import { Pencil } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

// TODO: decide if KYC is complete

export default function ApplyLoanCard() {
  const router = useRouter();


  const handleClick = () => {
    router.push('/borrower/loans/apply');
  };

  return (
    <Card className="w-full max-w-2xl" onClick={handleClick}>
      <CardHeader className="space-y-4">
        <div className="h-14 w-14 rounded-xl bg-blue-100 p-4">
          <Pencil className="h-6 w-6 text-blue-600" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold">Apply for loan</CardTitle>
          <CardDescription className="text-base leading-relaxed text-muted-foreground">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}