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
import { Wallet, PercentIcon, DollarSign, TrendingUpIcon, Gavel, Coins } from 'lucide-react';
import { getLoanStatusStyle } from '@/utils/colour';
import { Progress } from '@/components/ui/progress';
import { updateLoanApplicationStatus, disburseLoan, requestRevision, closeLoan, distributeYieldForLoan } from './actions';
import { useTransition, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { HoldConfirmModal } from '@/components/ui/hold-confirm-modal';

interface Props {
  loanApplication: LoanApplication;
  tokenSymbol: string;
  loanActive: boolean;
  loanAmount: number;
  loanInterestRate: number;
  loanRepaymentAmount: number;
  adminAddress: string;
  interestAmount: number;
  yieldDistributed: boolean;
}

export default function AdminLoanInformation({
  loanApplication,
  tokenSymbol,
  loanActive = false,
  loanAmount,
  loanInterestRate,
  loanRepaymentAmount,
  adminAddress,
  interestAmount,
  yieldDistributed,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isDisbursingFunds, setIsDisbursingFunds] = useState(false);
  const [isClosingLoan, setIsClosingLoan] = useState(false);
  const [isDistributingYield, setIsDistributingYield] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showYieldModal, setShowYieldModal] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const { toast } = useToast();

  const statusStyle = getLoanStatusStyle(loanApplication.status);
  const repaymentProgress = loanAmount > 0 ? (loanRepaymentAmount / loanAmount) * 100 : 0;
  const currentStatus = loanApplication.status;

  // Check if actions should be shown
  const isFinalized =
    currentStatus === LoanApplicationStatus.REPAID ||
    currentStatus === LoanApplicationStatus.DEFAULTED;

  const canApprove =
    currentStatus === LoanApplicationStatus.SUBMITTED ||
    currentStatus === LoanApplicationStatus.PENDING;
  const canDisburse = currentStatus === LoanApplicationStatus.APPROVED;
  const canClose =
    currentStatus === LoanApplicationStatus.DISBURSED && !loanActive && loanAmount > 0;
  const canReject =
    currentStatus !== LoanApplicationStatus.REJECTED &&
    currentStatus !== LoanApplicationStatus.APPROVED &&
    currentStatus !== LoanApplicationStatus.DISBURSED;
  const canRequestRevision =
    currentStatus !== LoanApplicationStatus.ADDITIONAL_INFO_NEEDED &&
    currentStatus !== LoanApplicationStatus.APPROVED &&
    currentStatus !== LoanApplicationStatus.REJECTED &&
    currentStatus !== LoanApplicationStatus.DISBURSED;
  const canDistributeYield =
    !loanActive && loanAmount > 0 && interestAmount > 0 && !yieldDistributed &&
    (currentStatus === LoanApplicationStatus.DISBURSED || currentStatus === LoanApplicationStatus.REPAID);

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

  const handleCloseLoan = async () => {
    setIsClosingLoan(true);
    try {
      const { isError, errorMessage } = await closeLoan({
        accountAddress: adminAddress,
        loanApplicationId: loanApplication.id,
      });
      if (isError) {
        toast({ variant: 'destructive', title: 'Close Failed', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Loan marked as repaid' });
      }
    } finally {
      setIsClosingLoan(false);
    }
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

  const handleDistributeYield = async () => {
    setIsDistributingYield(true);
    try {
      const { isError, errorMessage, txHash } = await distributeYieldForLoan({
        accountAddress: adminAddress,
        loanApplicationId: loanApplication.id,
      });
      if (isError) {
        toast({ variant: 'destructive', title: 'Yield Distribution Failed', description: errorMessage });
      } else {
        toast({
          title: 'Success',
          description: `Yield distributed to investors${txHash ? ` (${txHash.slice(0, 10)}...)` : ''}`,
        });
      }
    } finally {
      setIsDistributingYield(false);
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
              <span className="ml-1">
                {loanApplication.status === LoanApplicationStatus.DISBURSED
                  ? 'ACTIVE'
                  : loanApplication.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Loan Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>
                  {currentStatus === LoanApplicationStatus.APPROVED ||
                   currentStatus === LoanApplicationStatus.DISBURSED ||
                   currentStatus === LoanApplicationStatus.REPAID
                    ? 'Loan Amount'
                    : 'Requested Amount'}
                </span>
              </div>
              <p className="mt-1 text-xl font-bold">
                {(currentStatus === LoanApplicationStatus.APPROVED ||
                  currentStatus === LoanApplicationStatus.DISBURSED ||
                  currentStatus === LoanApplicationStatus.REPAID
                    ? loanAmount
                    : loanApplication.requestedAmount
                      ? Number(loanApplication.requestedAmount)
                      : loanAmount
                ).toLocaleString()}{' '}
                {tokenSymbol}
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
            ) : repaymentProgress >= 100 ? (
              <div className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                Fully Repaid
              </div>
            ) : (
              <div className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                Not Issued
              </div>
            )}
          </div>

          {/* Yield Distribution Status */}
          {!loanActive && loanAmount > 0 && interestAmount > 0 && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Yield Distribution</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {interestAmount.toLocaleString()} {tokenSymbol}
                </span>
                {yieldDistributed ? (
                  <div className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
                    Distributed
                  </div>
                ) : (
                  <div className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                    Pending
                  </div>
                )}
              </div>
            </div>
          )}

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
          {((!isFinalized && (canApprove || canDisburse || canClose || canReject || canRequestRevision)) || canDistributeYield) && (
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
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setShowDisburseModal(true)}
                    disabled={isPending || isDisbursingFunds}
                  >
                    Disburse Funds
                  </Button>
                )}
                {canClose && (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowCloseModal(true)}
                    disabled={isPending || isClosingLoan}
                  >
                    Close Loan
                  </Button>
                )}
                {canDistributeYield && (
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => setShowYieldModal(true)}
                    disabled={isPending || isDistributingYield}
                  >
                    <Coins className="mr-1 h-3.5 w-3.5" />
                    Distribute Yield
                  </Button>
                )}
                {canReject && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowRejectModal(true)}
                    disabled={isPending}
                  >
                    Reject
                  </Button>
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

      {/* Disburse Funds Confirmation Modal */}
      <HoldConfirmModal
        open={showDisburseModal}
        onOpenChange={setShowDisburseModal}
        onConfirm={handleDisburse}
        title="Disburse Loan Funds"
        description="This will transfer funds from the pool to the borrower's wallet. This action cannot be undone."
        confirmText="Hold to Disburse"
        variant="success"
        duration={2000}
        loading={isDisbursingFunds}
        details={
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">
                {loanAmount.toLocaleString()} {tokenSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate:</span>
              <span className="font-medium">{loanInterestRate / 100}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Borrower:</span>
              <span className="font-mono text-xs">
                {loanApplication.accountAddress.slice(0, 6)}...
                {loanApplication.accountAddress.slice(-4)}
              </span>
            </div>
          </div>
        }
      />

      {/* Reject Loan Confirmation Modal */}
      <HoldConfirmModal
        open={showRejectModal}
        onOpenChange={setShowRejectModal}
        onConfirm={onReject}
        title="Reject Loan Application"
        description="This will permanently reject the loan application. The borrower will be notified."
        confirmText="Hold to Reject"
        variant="destructive"
        duration={1500}
        loading={isPending}
        details={
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Business:</span>
              <span className="font-medium">{loanApplication.businessLegalName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Requested Amount:</span>
              <span className="font-medium">
                {loanAmount.toLocaleString()} {tokenSymbol}
              </span>
            </div>
          </div>
        }
      />

      {/* Close Loan Confirmation Modal */}
      <HoldConfirmModal
        open={showCloseModal}
        onOpenChange={setShowCloseModal}
        onConfirm={handleCloseLoan}
        title="Close Loan (Mark as Repaid)"
        description="This will verify the loan is fully repaid on-chain and update the status to REPAID."
        confirmText="Hold to Close"
        variant="success"
        duration={1500}
        loading={isClosingLoan}
        details={
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loan Amount:</span>
              <span className="font-medium">
                {loanAmount.toLocaleString()} {tokenSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">On-chain Status:</span>
              <span className="font-medium text-blue-600">Fully Repaid</span>
            </div>
          </div>
        }
      />

      {/* Distribute Yield Confirmation Modal */}
      <HoldConfirmModal
        open={showYieldModal}
        onOpenChange={setShowYieldModal}
        onConfirm={handleDistributeYield}
        title="Distribute Yield to Investors"
        description="This will transfer the interest earned from this loan to the StakingPool, increasing the share value for all investors in the pool."
        confirmText="Hold to Distribute"
        variant="success"
        duration={2000}
        loading={isDistributingYield}
        details={
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Yield Amount:</span>
              <span className="font-medium text-purple-600">
                {interestAmount.toLocaleString()} {tokenSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loan Principal:</span>
              <span className="font-medium">
                {loanAmount.toLocaleString()} {tokenSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate:</span>
              <span className="font-medium">{loanInterestRate / 100}%</span>
            </div>
          </div>
        }
      />
    </>
  );
}
