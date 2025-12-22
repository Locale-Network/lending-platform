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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Banknote } from 'lucide-react';

interface Props {
  adminAddress: string;
  loanId: string;
  currentStatus: LoanApplicationStatus;
}

export default function AdminLoanStatus({ adminAddress, loanId, currentStatus }: Props) {
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
        accountAddress: adminAddress,
        loanApplicationId: loanId,
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
        accountAddress: adminAddress,
        loanApplicationId: loanId,
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
        accountAddress: adminAddress,
        loanApplicationId: loanId,
        status: LoanApplicationStatus.ADDITIONAL_INFO_NEEDED,
      });

      if (isError) {
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Loan application marked as needing more info' });
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
        accountAddress: adminAddress,
        loanApplicationId: loanId,
      });

      if (isError) {
        toast({ variant: 'destructive', title: 'Disbursement Failed', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Funds disbursed to borrower' });
      }
    });
  };

  // Don't show actions for finalized statuses
  const isFinalized =
    currentStatus === LoanApplicationStatus.DISBURSED ||
    currentStatus === LoanApplicationStatus.REPAID ||
    currentStatus === LoanApplicationStatus.DEFAULTED;

  if (isFinalized) {
    return null;
  }

  // Get current status info
  const getStatusInfo = () => {
    switch (currentStatus) {
      case LoanApplicationStatus.PENDING:
      case LoanApplicationStatus.SUBMITTED:
        return {
          icon: <AlertCircle className="h-5 w-5 text-yellow-600" />,
          text: 'Awaiting Review',
          variant: 'warning' as const,
        };
      case LoanApplicationStatus.APPROVED:
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
          text: 'Approved - Ready for Disbursement',
          variant: 'success' as const,
        };
      case LoanApplicationStatus.ADDITIONAL_INFO_NEEDED:
        return {
          icon: <AlertCircle className="h-5 w-5 text-orange-600" />,
          text: 'Additional Info Requested',
          variant: 'warning' as const,
        };
      case LoanApplicationStatus.REJECTED:
        return {
          icon: <XCircle className="h-5 w-5 text-red-600" />,
          text: 'Rejected',
          variant: 'destructive' as const,
        };
      default:
        return {
          icon: <AlertCircle className="h-5 w-5 text-gray-600" />,
          text: currentStatus,
          variant: 'secondary' as const,
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <>
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold">Loan Actions</CardTitle>
            <Badge variant={statusInfo.variant as any} className="flex items-center gap-1">
              {statusInfo.icon}
              {statusInfo.text}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-3">
            {/* Show Approve button for SUBMITTED or PENDING loans */}
            {(currentStatus === LoanApplicationStatus.SUBMITTED ||
              currentStatus === LoanApplicationStatus.PENDING) && (
              <Button
                className={`${approvedStyle} min-w-[120px]`}
                onClick={onApprove}
                disabled={isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}

            {/* Show Disburse button for APPROVED loans */}
            {currentStatus === LoanApplicationStatus.APPROVED && (
              <Button
                className={`${disbursedStyle} min-w-[140px]`}
                onClick={onDisburse}
                disabled={isPending}
              >
                <Banknote className="mr-2 h-4 w-4" />
                Disburse Funds
              </Button>
            )}

            {/* Show Reject button for non-approved/non-rejected loans */}
            {currentStatus !== LoanApplicationStatus.REJECTED &&
              currentStatus !== LoanApplicationStatus.APPROVED && (
                <Button
                  variant="destructive"
                  className={`${rejectedStyle} min-w-[100px]`}
                  onClick={onReject}
                  disabled={isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              )}

            {/* Show Request Revision button */}
            {currentStatus !== LoanApplicationStatus.ADDITIONAL_INFO_NEEDED &&
              currentStatus !== LoanApplicationStatus.APPROVED &&
              currentStatus !== LoanApplicationStatus.REJECTED && (
                <Button
                  variant="outline"
                  className={revisionNeededStyle}
                  onClick={onRevisionNeeded}
                  disabled={isPending}
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Request Revision
                </Button>
              )}
          </div>
        </CardContent>
      </Card>

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
