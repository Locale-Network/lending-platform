'use client';

import { LoanApplicationStatus } from '@prisma/client';
import { updateLoanApplicationStatus } from './actions';
import { Button } from '@/components/ui/button';
import { getLoanStatusStyle } from '@/utils/colour';
import { useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  approverAddress: string;
  loanId: string;
  currentStatus: LoanApplicationStatus;
}

export default function LoanStatus(props: Props) {
  const [isPending, startTransition] = useTransition();
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

  return (
    <div className="flex justify-center gap-4">
      {props.currentStatus !== LoanApplicationStatus.APPROVED && (
        <Button className={approvedStyle} onClick={onApprove} disabled={isPending}>
          Approve
        </Button>
      )}
      {props.currentStatus !== LoanApplicationStatus.REJECTED &&
        props.currentStatus !== LoanApplicationStatus.APPROVED && (
          <Button className={rejectedStyle} onClick={onReject} disabled={isPending}>
            Reject
          </Button>
        )}
      {props.currentStatus !== LoanApplicationStatus.ADDITIONAL_INFO_NEEDED &&
        props.currentStatus !== LoanApplicationStatus.APPROVED && (
          <Button className={revisionNeededStyle} onClick={onRevisionNeeded} disabled={isPending}>
            Request Revision
          </Button>
        )}
    </div>
  );
}
