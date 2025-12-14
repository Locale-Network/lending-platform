'use client';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import QRCode from 'react-qr-code';
import { Plus, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { revalidateLoanApplication } from './actions';

interface Props {
  loanApplicationId: string;
}

export default function DebtServiceDialog({ loanApplicationId }: Props) {
  const [hasDebtServiceProof, setHasDebtServiceProof] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  // React.useEffect(() => {
  //   let intervalId: NodeJS.Timeout;

  //   const pollDebtServiceStatus = async () => {
  //     try {
  //       const response = await fetch(statusUrl);
  //       const data = await response.json();

  //       if (data?.session?.statusV2 === 'PROOF_SUBMITTED') {
  //         setHasDebtServiceProof(true);
  //         clearInterval(intervalId);
  //         await revalidateLoanApplication(loanApplicationId);
  //       }
  //     } catch (error) {
  //       console.error('Error polling Plaid status:', error);
  //     }
  //   };

  //   if (isOpen && !hasDebtServiceProof) {
  //     // Only poll when dialog is open
  //     // Poll every 3 seconds
  //     intervalId = setInterval(pollDebtServiceStatus, 3000);

  //     // Initial check
  //     pollDebtServiceStatus();
  //   }

  //   // Cleanup function
  //   return () => {
  //     if (intervalId) {
  //       clearInterval(intervalId);
  //     }
  //   };
  // }, [hasDebtServiceProof, isOpen, loanApplicationId]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative">
          <div className="relative inline-block">
            <Landmark className="h-4 w-4" />
            <Plus className="absolute -right-2 -top-2 h-1 w-1" />
          </div>
          <span className="ml-2">Update Bank Data</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect your bank account</DialogTitle>
          <DialogDescription>Loan id: {loanApplicationId}</DialogDescription>
          <DialogDescription>Scan the QR code to link your bank account</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4">
          {hasDebtServiceProof ? (
            <div className="flex items-center space-x-2 rounded-lg bg-green-100 p-3 text-green-700">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="font-medium">Bank account connected</p>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <p className="animate-pulse">Waiting for completion...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
