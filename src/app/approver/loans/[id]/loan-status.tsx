'use client';

import { LoanApplicationStatus } from '@prisma/client';
import { updateLoanApplicationStatus, disburseLoan, closeLoan } from './actions';
import { Button } from '@/components/ui/button';
import { getLoanStatusStyle } from '@/utils/colour';
import { useTransition, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { HoldConfirmModal } from '@/components/ui/hold-confirm-modal';
import { formatAddress } from '@/utils/string';
import { Address } from 'viem';

interface Props {
  approverAddress: string;
  loanId: string;
  currentStatus: LoanApplicationStatus;
  isAdmin?: boolean;
  loanAmount?: number;
  tokenSymbol?: string;
  borrowerAddress?: string;
  interestRate?: number;
  loanActive?: boolean;
}

export default function LoanStatus(props: Props) {
  const [isPending, startTransition] = useTransition();
  const [isDisbursingFunds, setIsDisbursingFunds] = useState(false);
  const [isClosingLoan, setIsClosingLoan] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const { toast } = useToast();

  const approvedStyle = getLoanStatusStyle(LoanApplicationStatus.APPROVED);
  const rejectedStyle = getLoanStatusStyle(LoanApplicationStatus.REJECTED);
  const revisionNeededStyle = getLoanStatusStyle(LoanApplicationStatus.ADDITIONAL_INFO_NEEDED);

  const onApprove = () => {
    startTransition(async () => {
      const { isError, errorMessage } = await updateLoanApplicationStatus({
        accountAddress: props.approverAddress,
        loanApplicationId: props.loanId,
        status: LoanApplicationStatus.APPROVED,
      });

      if (isError) {
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Loan application approved' });
      }
    });
  };

  const onReject = () => {
    startTransition(async () => {
      const { isError, errorMessage } = await updateLoanApplicationStatus({
        accountAddress: props.approverAddress,
        loanApplicationId: props.loanId,
        status: LoanApplicationStatus.REJECTED,
      });

      if (isError) {
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Loan application rejected' });
      }
    });
  };

  const onRevisionNeeded = () => {
    startTransition(async () => {
      const { isError, errorMessage } = await updateLoanApplicationStatus({
        accountAddress: props.approverAddress,
        loanApplicationId: props.loanId,
        status: LoanApplicationStatus.ADDITIONAL_INFO_NEEDED,
      });

      if (isError) {
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Loan application needs more info' });
      }
    });
  };

  const handleCloseLoan = async () => {
    setIsClosingLoan(true);
    try {
      const { isError, errorMessage } = await closeLoan({
        accountAddress: props.approverAddress,
        loanApplicationId: props.loanId,
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
        accountAddress: props.approverAddress,
        loanApplicationId: props.loanId,
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
      <div className="flex justify-center gap-4">
        {/* Show Approve button for SUBMITTED or PENDING loans */}
        {(props.currentStatus === LoanApplicationStatus.SUBMITTED ||
          props.currentStatus === LoanApplicationStatus.PENDING) && (
          <Button className={approvedStyle} onClick={onApprove} disabled={isPending}>
            Approve
          </Button>
        )}

        {/* Show Disburse button for APPROVED loans (ADMIN only) */}
        {props.currentStatus === LoanApplicationStatus.APPROVED && props.isAdmin && (
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setShowDisburseModal(true)}
            disabled={isPending || isDisbursingFunds}
          >
            Disburse Funds
          </Button>
        )}

        {/* Show Close Loan button for DISBURSED loans that are fully repaid on-chain */}
        {props.currentStatus === LoanApplicationStatus.DISBURSED &&
          props.isAdmin &&
          props.loanActive === false && (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowCloseModal(true)}
              disabled={isPending || isClosingLoan}
            >
              Close Loan
            </Button>
          )}

        {/* Show Reject button for non-approved/non-rejected loans */}
        {props.currentStatus !== LoanApplicationStatus.REJECTED &&
          props.currentStatus !== LoanApplicationStatus.APPROVED &&
          props.currentStatus !== LoanApplicationStatus.DISBURSED && (
            <Button
              variant="destructive"
              onClick={() => setShowRejectModal(true)}
              disabled={isPending}
            >
              Reject
            </Button>
          )}

        {/* Show Request Revision button */}
        {props.currentStatus !== LoanApplicationStatus.ADDITIONAL_INFO_NEEDED &&
          props.currentStatus !== LoanApplicationStatus.APPROVED &&
          props.currentStatus !== LoanApplicationStatus.DISBURSED && (
            <Button className={revisionNeededStyle} onClick={onRevisionNeeded} disabled={isPending}>
              Request Revision
            </Button>
          )}
      </div>

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
          <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">{props.loanAmount?.toLocaleString()} {props.tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate:</span>
              <span className="font-medium">{((props.interestRate ?? 0) / 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Borrower:</span>
              <span className="font-mono font-medium">
                {props.borrowerAddress ? formatAddress(props.borrowerAddress as Address) : ''}
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
          <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loan Amount:</span>
              <span className="font-medium">{props.loanAmount?.toLocaleString()} {props.tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">On-chain Status:</span>
              <span className="font-medium text-blue-600">Fully Repaid</span>
            </div>
          </div>
        }
      />
    </>
  );
}
