'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMakeRepayment, useMakePartialRepayment } from '@/hooks/useLoanPool';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Wallet,
  Building2,
  Clock,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getExplorerUrl } from '@/lib/explorer';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { parseUnits } from 'viem';

interface BankAccount {
  accountId: string;
  name: string;
  type: string;
  subtype: string;
  mask: string;
  availableBalance: number | null;
}

interface RepaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  loanAmount: number;
  interestRate: number;
  repaidAmount: number;
  tokenSymbol: string;
  hasBankLinked?: boolean;
  onSuccess?: () => void;
}

type PaymentMethod = 'crypto' | 'ach';
type Step = 'select-method' | 'select-account' | 'confirm' | 'processing' | 'success' | 'error';

export function RepaymentModal({
  open,
  onOpenChange,
  loanId,
  loanAmount,
  interestRate,
  repaidAmount,
  tokenSymbol,
  hasBankLinked = false,
  onSuccess,
}: RepaymentModalProps) {
  const { toast } = useToast();
  const { makeRepayment, isPending, isConfirmed, error, hash, reset } = useMakeRepayment();
  const {
    makePartialRepayment,
    isPending: isPartialPending,
    isConfirmed: isPartialConfirmed,
    error: partialError,
    hash: partialHash,
    reset: resetPartial,
  } = useMakePartialRepayment();
  const [step, setStep] = useState<Step>('select-method');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [achStatus, setAchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [achError, setAchError] = useState<string | null>(null);

  // Bank account selection state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Combine full/partial crypto state
  const cryptoPending = isPending || isPartialPending;
  const cryptoConfirmed = isConfirmed || isPartialConfirmed;
  const cryptoError = error || partialError;
  const cryptoHash = hash || partialHash;

  // Calculate amounts
  const remainingPrincipal = loanAmount - repaidAmount;
  const interestAmount = (remainingPrincipal * interestRate) / 10000; // Interest rate is in basis points
  const totalDue = remainingPrincipal + interestAmount;

  useEffect(() => {
    if (paymentMethod === 'crypto') {
      if (cryptoPending) {
        setStep('processing');
      } else if (cryptoConfirmed) {
        setStep('success');
      } else if (cryptoError) {
        setStep('error');
      }
    }
  }, [cryptoPending, cryptoConfirmed, cryptoError, paymentMethod]);

  // Fetch bank accounts when ACH is selected
  const fetchBankAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const response = await fetch(`/api/loan/${loanId}/accounts`);
      const data = await response.json();

      if (response.ok && data.accounts) {
        setBankAccounts(data.accounts);
        // Auto-select if only one account
        if (data.accounts.length === 1) {
          setSelectedAccountId(data.accounts[0].accountId);
        }
      } else {
        console.error('Failed to fetch accounts:', data.error);
        setBankAccounts([]);
      }
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
      setBankAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, [loanId]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('select-method');
      setPaymentMethod(null);
      setPaymentType('full');
      setCustomAmount('');
      setAchStatus('idle');
      setAchError(null);
      setBankAccounts([]);
      setSelectedAccountId(null);
      setLoadingAccounts(false);
      reset();
      resetPartial();
    }
  }, [open, reset, resetPartial]);

  const handleSelectMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    if (method === 'ach') {
      // Fetch accounts and go to account selection step
      fetchBankAccounts();
      setStep('select-account');
    } else {
      setStep('confirm');
    }
  };

  const handleSelectAccount = () => {
    if (selectedAccountId) {
      setStep('confirm');
    }
  };

  const handleConfirmCryptoRepayment = async () => {
    try {
      if (paymentType === 'partial' && customAmount) {
        const amount = parseUnits(customAmount, 6); // USDC has 6 decimals
        await makePartialRepayment(loanId, amount);
        toast({
          title: 'Partial Repayment Successful',
          description: `${customAmount} ${tokenSymbol} repayment has been processed.`,
        });
      } else {
        await makeRepayment(loanId);
        toast({
          title: 'Repayment Successful',
          description: 'Your full loan repayment has been processed.',
        });
      }
      onSuccess?.();
    } catch (err) {
      toast({
        title: 'Repayment Failed',
        description: err instanceof Error ? err.message : 'Failed to process repayment',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmACHRepayment = async () => {
    setAchStatus('loading');
    setStep('processing');

    try {
      const response = await fetch(`/api/loan/${loanId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalDue,
          plaidAccountId: selectedAccountId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      setAchStatus('success');
      setStep('success');
      toast({
        title: 'ACH Payment Initiated',
        description: 'Your payment is being processed. ACH transfers typically take 3-5 business days.',
      });
      onSuccess?.();
    } catch (err) {
      setAchStatus('error');
      setAchError(err instanceof Error ? err.message : 'Failed to process ACH payment');
      setStep('error');
      toast({
        title: 'Payment Failed',
        description: err instanceof Error ? err.message : 'Failed to initiate ACH payment',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmRepayment = () => {
    if (paymentMethod === 'crypto') {
      handleConfirmCryptoRepayment();
    } else if (paymentMethod === 'ach') {
      handleConfirmACHRepayment();
    }
  };

  const handleBack = () => {
    if (step === 'select-account') {
      setStep('select-method');
      setPaymentMethod(null);
      setBankAccounts([]);
      setSelectedAccountId(null);
    } else if (step === 'confirm') {
      if (paymentMethod === 'ach') {
        setStep('select-account');
      } else {
        setStep('select-method');
        setPaymentMethod(null);
      }
    }
  };

  const handleClose = () => {
    if (!cryptoPending && achStatus !== 'loading') {
      onOpenChange(false);
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'select-method':
        return 'Choose Payment Method';
      case 'select-account':
        return 'Select Bank Account';
      case 'confirm':
        return paymentMethod === 'ach' ? 'Confirm ACH Payment' : 'Confirm Crypto Payment';
      case 'processing':
        return 'Processing Payment';
      case 'success':
        return 'Payment Complete';
      case 'error':
        return 'Payment Failed';
    }
  };

  const getDescription = () => {
    switch (step) {
      case 'select-method':
        return 'Select how you would like to make your loan repayment.';
      case 'select-account':
        return 'Choose which bank account to use for this payment.';
      case 'confirm':
        return 'Review your repayment details before confirming.';
      case 'processing':
        return 'Please wait while your payment is being processed.';
      case 'success':
        return paymentMethod === 'ach'
          ? 'Your ACH payment has been initiated and will be processed in 3-5 business days.'
          : 'Your loan has been successfully repaid.';
      case 'error':
        return 'There was an issue processing your payment.';
    }
  };

  // Get the selected account details for display
  const selectedAccount = bankAccounts.find(acc => acc.accountId === selectedAccountId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        {step === 'select-method' && (
          <div className="space-y-3 py-4">
            {/* Crypto Payment Option */}
            <button
              onClick={() => handleSelectMethod('crypto')}
              className={cn(
                'flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors',
                'hover:border-primary hover:bg-primary/5'
              )}
            >
              <div className="rounded-full bg-primary/10 p-2">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Pay with Crypto</p>
                <p className="text-sm text-muted-foreground">
                  Pay instantly using {tokenSymbol} from your connected wallet
                </p>
              </div>
            </button>

            {/* ACH Payment Option */}
            <button
              onClick={() => handleSelectMethod('ach')}
              disabled={!hasBankLinked}
              className={cn(
                'flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors',
                hasBankLinked
                  ? 'hover:border-primary hover:bg-primary/5'
                  : 'cursor-not-allowed opacity-50'
              )}
            >
              <div className="rounded-full bg-blue-100 p-2">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Pay with Bank Account (ACH)</p>
                <p className="text-sm text-muted-foreground">
                  {hasBankLinked
                    ? 'Transfer from your linked bank account (3-5 business days)'
                    : 'Link a bank account to enable ACH payments'}
                </p>
                {!hasBankLinked && (
                  <p className="mt-1 text-xs text-amber-600">Bank account not linked</p>
                )}
              </div>
            </button>
          </div>
        )}

        {step === 'select-account' && (
          <div className="space-y-4 py-4">
            {loadingAccounts ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Loading bank accounts...</p>
              </div>
            ) : bankAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-8 w-8 text-amber-500" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No eligible bank accounts found. Please link a checking or savings account.
                </p>
              </div>
            ) : (
              <RadioGroup
                value={selectedAccountId || ''}
                onValueChange={setSelectedAccountId}
                className="space-y-3"
              >
                {bankAccounts.map((account) => (
                  <div key={account.accountId} className="flex items-center">
                    <RadioGroupItem
                      value={account.accountId}
                      id={account.accountId}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={account.accountId}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors',
                        'peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5',
                        'hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      <div className="rounded-full bg-blue-100 p-2">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {account.subtype.charAt(0).toUpperCase() + account.subtype.slice(1)} ****{account.mask}
                        </p>
                        {account.availableBalance !== null && (
                          <p className="text-xs text-muted-foreground">
                            Available: ${account.availableBalance.toLocaleString()}
                          </p>
                        )}
                      </div>
                      {selectedAccountId === account.accountId && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining Principal</span>
                <span className="font-medium">
                  {paymentMethod === 'ach'
                    ? `$${remainingPrincipal.toLocaleString()}`
                    : `${remainingPrincipal.toLocaleString()} ${tokenSymbol}`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Interest ({interestRate / 100}%)</span>
                <span className="font-medium">
                  {paymentMethod === 'ach'
                    ? `$${interestAmount.toLocaleString()}`
                    : `${interestAmount.toLocaleString()} ${tokenSymbol}`}
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-medium">Total Due</span>
                  <span className="text-lg font-bold">
                    {paymentMethod === 'ach'
                      ? `$${totalDue.toLocaleString()}`
                      : `${totalDue.toLocaleString()} ${tokenSymbol}`}
                  </span>
                </div>
              </div>
            </div>

            {paymentMethod === 'crypto' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPaymentType('full'); setCustomAmount(''); }}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      paymentType === 'full'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    Full Payment
                  </button>
                  <button
                    onClick={() => setPaymentType('partial')}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      paymentType === 'partial'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    Partial Payment
                  </button>
                </div>

                {paymentType === 'partial' && (
                  <div className="space-y-2">
                    <Label htmlFor="partial-amount">Payment Amount ({tokenSymbol})</Label>
                    <Input
                      id="partial-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={totalDue}
                      placeholder={`Enter amount (max ${totalDue.toLocaleString()})`}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                    />
                    {customAmount && Number(customAmount) > totalDue && (
                      <p className="text-xs text-destructive">
                        Amount cannot exceed total due ({totalDue.toLocaleString()} {tokenSymbol})
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  <p>
                    {paymentType === 'partial'
                      ? `This will make a partial payment of ${customAmount || '0'} ${tokenSymbol}. Interest is paid first, then principal.`
                      : `This will repay your entire remaining loan balance. Make sure you have sufficient ${tokenSymbol} in your wallet.`}
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'ach' && selectedAccount && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedAccount.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedAccount.subtype.charAt(0).toUpperCase() + selectedAccount.subtype.slice(1)} ****{selectedAccount.mask}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'ach' && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>
                    ACH payments typically take 3-5 business days to process. Your loan will be
                    marked as paid once the funds are received.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              {paymentMethod === 'ach'
                ? 'Initiating ACH transfer...'
                : 'Waiting for transaction confirmation...'}
            </p>
            {paymentMethod === 'crypto' && cryptoHash && (
              <a
                href={getExplorerUrl('tx', cryptoHash)}
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
            <p className="mt-4 font-medium">
              {paymentMethod === 'ach'
                ? 'ACH Payment Initiated!'
                : paymentType === 'partial'
                  ? 'Partial Repayment Successful!'
                  : 'Repayment Successful!'}
            </p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {paymentMethod === 'ach'
                ? 'Your payment will be processed in 3-5 business days.'
                : paymentType === 'partial'
                  ? `${customAmount} ${tokenSymbol} has been applied to your loan.`
                  : 'Your loan has been fully repaid.'}
            </p>
            {paymentMethod === 'crypto' && cryptoHash && (
              <a
                href={getExplorerUrl('tx', cryptoHash)}
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
            <p className="mt-4 font-medium">Payment Failed</p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {paymentMethod === 'ach'
                ? achError || 'Failed to initiate ACH payment.'
                : cryptoError?.message || 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'select-method' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === 'select-account' && (
            <>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                onClick={handleSelectAccount}
                disabled={!selectedAccountId || loadingAccounts}
              >
                Continue
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                onClick={handleConfirmRepayment}
                disabled={
                  cryptoPending ||
                  achStatus === 'loading' ||
                  (paymentMethod === 'crypto' && paymentType === 'partial' && (!customAmount || Number(customAmount) < 0.01 || Number(customAmount) > totalDue))
                }
              >
                {paymentMethod === 'ach'
                  ? 'Initiate ACH Payment'
                  : paymentType === 'partial'
                    ? `Pay ${customAmount || '0'} ${tokenSymbol}`
                    : 'Confirm Full Repayment'}
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
