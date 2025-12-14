'use client';

import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ApplyLoanButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    router.push('/borrower/loans/apply');
  };

  return (
    <div>
      <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleClick}>
        New
        {!loading && <Plus className="mr-2 h-4 w-4" />}
        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
      </Button>
    </div>
  );
}
