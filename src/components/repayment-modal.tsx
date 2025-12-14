'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMakeRepayment } from '@/hooks/useLoanPool';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { formatUnits } from 'viem';

interface RepaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  loanAmount: number;
  interestRate: number;
  repaidAmount: number;
  tokenSymbol: string;
  onSuccess?: () => void;
}

export function RepaymentModal({
  open,
  onOpenChange,
  loanId,
  loanAmount,
  interestRate,
  repaidAmount,
  tokenSymbol,
  onSuccess,
}: RepaymentModalProps) {
  const { toast } = useToast();
  const { makeRepayment, isPending, isConfirmed, error, hash, reset } = useMakeRepayment();
  const [step, setStep] = useState<'confirm' | 'processing' | 'success' | 'error'>('confirm');

  // Calculate amounts
  const remainingPrincipal = loanAmount - repaidAmount;
  const interestAmount = (remainingPrincipal * interestRate) / 10000; // Interest rate is in basis points
  const totalDue = remainingPrincipal + interestAmount;

  useEffect(() => {
    if (isPending) {
      setStep('processing');
    } else if (isConfirmed) {
      setStep('success');
    } else if (error) {
      setStep('error');
    }
  }, [isPending, isConfirmed, error]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('confirm');
      reset();
    }
  }, [open, reset]);

  const handleConfirmRepayment = async () => {
    try {
      await makeRepayment(loanId);
      toast({
        title: 'Repayment Successful',
        description: 'Your loan repayment has been processed.',
      });
      onSuccess?.();
    } catch (err) {
      toast({
        title: 'Repayment Failed',
        description: err instanceof Error ? err.message : 'Failed to process repayment',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (!isPending) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'confirm' && 'Confirm Repayment'}
            {step === 'processing' && 'Processing Repayment'}
            {step === 'success' && 'Repayment Complete'}
            {step === 'error' && 'Repayment Failed'}
          </DialogTitle>
          <DialogDescription>
            {step === 'confirm' && 'Review your repayment details before confirming.'}
            {step === 'processing' && 'Please wait while your transaction is being processed.'}
            {step === 'success' && 'Your loan has been successfully repaid.'}
            {step === 'error' && 'There was an issue processing your repayment.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining Principal</span>
                <span className="font-medium">
                  {remainingPrincipal.toLocaleString()} {tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Interest ({interestRate / 100}%)</span>
                <span className="font-medium">
                  {interestAmount.toLocaleString()} {tokenSymbol}
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-medium">Total Due</span>
                  <span className="text-lg font-bold">
                    {totalDue.toLocaleString()} {tokenSymbol}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <p>
                This will repay your entire remaining loan balance. Make sure you have sufficient{' '}
                {tokenSymbol} in your wallet.
              </p>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Waiting for transaction confirmation...
            </p>
            {hash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View on Arbiscan
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="mt-4 font-medium">Repayment Successful!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your loan has been fully repaid.
            </p>
            {hash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View Transaction
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 font-medium">Transaction Failed</p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {error?.message || 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleConfirmRepayment} disabled={isPending}>
                Confirm Repayment
              </Button>
            </>
          )}
          {step === 'processing' && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </Button>
          )}
          {(step === 'success' || step === 'error') && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
