'use client';

import { LoanApplicationStatus } from '@prisma/client';
import { updateLoanApplicationStatus, disburseLoan } from './actions';
import { Button } from '@/components/ui/button';
import { getLoanStatusStyle } from '@/utils/colour';
import { useTransition, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  approverAddress: string;
  loanId: string;
  currentStatus: LoanApplicationStatus;
  isAdmin?: boolean;
}

export default function LoanStatus(props: Props) {
  const [isPending, startTransition] = useTransition();
  const [showDisburseConfirm, setShowDisburseConfirm] = useState(false);
  const { toast } = useToast();

  const approvedStyle = getLoanStatusStyle(LoanApplicationStatus.APPROVED);
  const rejectedStyle = getLoanStatusStyle(LoanApplicationStatus.REJECTED);
  const revisionNeededStyle = getLoanStatusStyle(LoanApplicationStatus.ADDITIONAL_INFO_NEEDED);
  const disbursedStyle = 'bg-blue-600 hover:bg-blue-700 text-white';

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

  const onDisburse = () => {
    setShowDisburseConfirm(true);
  };

  const confirmDisburse = () => {
    setShowDisburseConfirm(false);
    startTransition(async () => {
      const { isError, errorMessage } = await disburseLoan({
        accountAddress: props.approverAddress,
        loanApplicationId: props.loanId,
      });

      if (isError) {
        toast({ variant: 'destructive', title: 'Disbursement Failed', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Funds disbursed to borrower' });
      }
    });
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
          <Button className={disbursedStyle} onClick={onDisburse} disabled={isPending}>
            Disburse Funds
          </Button>
        )}

        {/* Show Reject button for non-approved/non-rejected loans */}
        {props.currentStatus !== LoanApplicationStatus.REJECTED &&
          props.currentStatus !== LoanApplicationStatus.APPROVED &&
          props.currentStatus !== LoanApplicationStatus.DISBURSED && (
            <Button className={rejectedStyle} onClick={onReject} disabled={isPending}>
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

      {/* Disbursement Confirmation Dialog */}
      <AlertDialog open={showDisburseConfirm} onOpenChange={setShowDisburseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Fund Disbursement</AlertDialogTitle>
            <AlertDialogDescription>
              This will transfer funds from the loan pool to the borrower&apos;s wallet. This action
              cannot be undone. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisburse} className={disbursedStyle}>
              Confirm Disbursement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
