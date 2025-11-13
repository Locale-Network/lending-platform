import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function ApplyFundingButton() {
  return (
    <Link href="/borrower/loans/apply" className="block">
      <Button
        variant="outline"
        size="lg"
        className="w-full border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
      >
        Apply for Funding
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </Link>
  );
}
