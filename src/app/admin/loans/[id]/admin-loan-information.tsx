'use client';

import { LoanApplication, LoanApplicationStatus } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Wallet, PercentIcon, DollarSign, TrendingUpIcon, Gavel } from 'lucide-react';
import { getLoanStatusStyle } from '@/utils/colour';
import { Progress } from '@/components/ui/progress';
import { updateLoanApplicationStatus, disburseLoan, requestRevision } from './actions';
import { useTransition, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { HoldToConfirmButton } from '@/components/ui/hold-to-confirm-button';

interface Props {
  loanApplication: LoanApplication;
  tokenSymbol: string;
  loanActive: boolean;
  loanAmount: number;
  loanInterestRate: number;
  loanRepaymentAmount: number;
  adminAddress: string;
}

export default function AdminLoanInformation({
  loanApplication,
  tokenSymbol,
  loanActive = false,
  loanAmount,
  loanInterestRate,
  loanRepaymentAmount,
  adminAddress,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isDisbursingFunds, setIsDisbursingFunds] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const { toast } = useToast();

  const statusStyle = getLoanStatusStyle(loanApplication.status);
  const repaymentProgress = loanAmount > 0 ? (loanRepaymentAmount / loanAmount) * 100 : 0;
  const currentStatus = loanApplication.status;

  // Check if actions should be shown
  const isFinalized =
    currentStatus === LoanApplicationStatus.DISBURSED ||
    currentStatus === LoanApplicationStatus.REPAID ||
    currentStatus === LoanApplicationStatus.DEFAULTED;

  const canApprove =
    currentStatus === LoanApplicationStatus.SUBMITTED ||
    currentStatus === LoanApplicationStatus.PENDING;
  const canDisburse = currentStatus === LoanApplicationStatus.APPROVED;
  const canReject =
    currentStatus !== LoanApplicationStatus.REJECTED &&
    currentStatus !== LoanApplicationStatus.APPROVED &&
    currentStatus !== LoanApplicationStatus.DISBURSED;
  const canRequestRevision =
    currentStatus !== LoanApplicationStatus.ADDITIONAL_INFO_NEEDED &&
    currentStatus !== LoanApplicationStatus.APPROVED &&
    currentStatus !== LoanApplicationStatus.REJECTED &&
    currentStatus !== LoanApplicationStatus.DISBURSED;

  const onApprove = () => {
    startTransition(async () => {
      const { isError, errorMessage } = await updateLoanApplicationStatus({
        accountAddress: adminAddress,
        loanApplicationId: loanApplication.id,
        status: LoanApplicationStatus.APPROVED,
      });
      if (isError) {
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Loan approved' });
      }
    });
  };

  const onReject = () => {
    startTransition(async () => {
      const { isError, errorMessage } = await updateLoanApplicationStatus({
        accountAddress: adminAddress,
        loanApplicationId: loanApplication.id,
        status: LoanApplicationStatus.REJECTED,
      });
      if (isError) {
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Loan rejected' });
      }
    });
  };

  const onRevisionNeeded = () => {
    setShowRevisionDialog(true);
  };

  const confirmRevision = () => {
    if (!revisionNote.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please provide details on what information is needed' });
      return;
    }
    setShowRevisionDialog(false);
    startTransition(async () => {
      const { isError, errorMessage } = await requestRevision({
        accountAddress: adminAddress,
        loanApplicationId: loanApplication.id,
        revisionNote: revisionNote.trim(),
      });
      if (isError) {
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Revision requested' });
        setRevisionNote('');
      }
    });
  };

  const handleDisburse = async () => {
    setIsDisbursingFunds(true);
    try {
      const { isError, errorMessage } = await disburseLoan({
        accountAddress: adminAddress,
        loanApplicationId: loanApplication.id,
      });
      if (isError) {
        toast({ variant: 'destructive', title: 'Disbursement Failed', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Funds disbursed to borrower' });
      }
    } finally {
      setIsDisbursingFunds(false);
    }
  };

  return (
    <>
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="mb-2 text-xl font-bold sm:mb-0 sm:text-2xl">
              Loan Information
            </CardTitle>
            <div
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}
            >
              <span className="ml-1">{loanApplication.status.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Loan Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Loan Amount</span>
              </div>
              <p className="mt-1 text-xl font-bold">
                {loanAmount.toLocaleString()} {tokenSymbol}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PercentIcon className="h-4 w-4" />
                <span>Interest Rate</span>
              </div>
              <p className="mt-1 text-xl font-bold">{loanInterestRate / 100}%</p>
            </div>
          </div>

          {/* Funds Status */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Funds Status</span>
            </div>
            {loanActive ? (
              <div className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                Issued
              </div>
            ) : (
              <div className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                Not Issued
              </div>
            )}
          </div>

          {/* Repayment Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUpIcon className="h-4 w-4" />
                <span>Repayment Progress</span>
              </div>
              <span className="font-medium">
                {loanRepaymentAmount.toLocaleString()} / {loanAmount.toLocaleString()} {tokenSymbol}
              </span>
            </div>
            <Progress value={repaymentProgress} className="h-2" />
            <p className="text-right text-xs text-muted-foreground">
              {repaymentProgress.toFixed(1)}% complete
            </p>
          </div>

          {/* Decisions Section */}
          {!isFinalized && (canApprove || canDisburse || canReject || canRequestRevision) && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Gavel className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Decisions</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {canApprove && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={onApprove}
                    disabled={isPending}
                  >
                    Approve
                  </Button>
                )}
                {canDisburse && (
                  <HoldToConfirmButton
                    onConfirm={handleDisburse}
                    duration={2000}
                    disabled={isPending || isDisbursingFunds}
                    loading={isDisbursingFunds}
                    variant="success"
                    size="sm"
                  >
                    Hold to Disburse Funds
                  </HoldToConfirmButton>
                )}
                {canReject && (
                  <HoldToConfirmButton
                    onConfirm={onReject}
                    duration={1500}
                    disabled={isPending}
                    variant="destructive"
                    size="sm"
                  >
                    Hold to Reject
                  </HoldToConfirmButton>
                )}
                {canRequestRevision && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-50"
                    onClick={onRevisionNeeded}
                    disabled={isPending}
                  >
                    Request Revision
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revision Request Dialog */}
      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Additional Information</DialogTitle>
            <DialogDescription>
              Please specify what additional information or changes are needed from the borrower.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="revision-note" className="text-sm font-medium">
              What information is needed?
            </Label>
            <Textarea
              id="revision-note"
              placeholder="e.g., Please provide updated bank statements from the last 3 months, or clarify the business revenue figures..."
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              className="mt-2 min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevisionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmRevision}
              disabled={isPending || !revisionNote.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
