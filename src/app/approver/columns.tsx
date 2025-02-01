'use client';

import { LoanApplicationStatus } from '@prisma/client';
import { ColumnDef, Row } from '@tanstack/react-table';
import Link from 'next/link';
import { getLoanStatusStyle } from '@/utils/colour';
import { formatDateToUS } from '@/utils/date';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import {
  getLoanAmountAction,
  getLoanRemainingMonthsAction,
  getLoanRepaymentAmountAction,
  getTokenSymbolAction,
  updateLoanApplicationStatus,
} from './actions';
import { useEffect, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export type LoanApplicationsForTable = {
  id: string;
  creatorAddress: string;
  creditScoreEquifax: number | null;
  creditScoreTransUnion: number | null;
  transactionCount: number | null;
  status: LoanApplicationStatus;
  createdDate: Date;
  updatedDate: Date;
};

const ActionsCell: React.FC<{ loanApplication: LoanApplicationsForTable }> = ({
  loanApplication,
}) => {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const onApprove = () => {
    startTransition(async () => {
      const { isError, errorMessage } = await updateLoanApplicationStatus({
        loanApplicationId: loanApplication.id,
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
        loanApplicationId: loanApplication.id,
        status: LoanApplicationStatus.REJECTED,
      });

      if (isError) {
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      } else {
        toast({ title: 'Success', description: 'Loan application rejected' });
      }
    });
  };

  const onAddtionalInfoNeeded = () => {
    startTransition(async () => {
      const { isError, errorMessage } = await updateLoanApplicationStatus({
        loanApplicationId: loanApplication.id,
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem disabled={isPending} onClick={onApprove}>
            Approve
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isPending} onClick={onReject}>
            Reject
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isPending} onClick={onAddtionalInfoNeeded}>
            Request More Info
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const columns: ColumnDef<LoanApplicationsForTable>[] = [
  {
    accessorKey: 'id',
    header: 'Application ID',
    cell: ({ row }) => (
      <Link
        href={`/approver/loans/${row.getValue('id')}`}
        className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 hover:bg-blue-100 hover:text-blue-800"
      >
        {row.getValue('id')}
      </Link>
    ),
  },
  {
    accessorKey: 'creatorAddress',
    header: 'Borrower Address',
    cell: ({ row }) => <div>{row.getValue('creatorAddress')}</div>,
  },

  {
    accessorKey: 'loan',
    header: 'Loan',
    cell: LoanCell,
  },

  {
    accessorKey: 'remainingMonths',
    header: 'Remaining Months',
    cell: LoanRemainingMonthsCell,
  },

  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as LoanApplicationStatus;

      const statusStyle = getLoanStatusStyle(status);

      return (
        <div
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}
        >
          {status.replace(/_/g, ' ')}
        </div>
      );
    },
  },
  {
    accessorKey: 'createdDate',
    header: 'Application Date',
    cell: ({ row }) => <div>{formatDateToUS(row.getValue('createdDate'))}</div>,
  },
  {
    accessorKey: 'updatedDate',
    header: 'Updated Date',
    cell: ({ row }) => <div>{formatDateToUS(row.getValue('updatedDate'))}</div>,
  },
  {
    id: 'actions',
    cell: ({ row }) => <ActionsCell loanApplication={row.original} />,
  },
];

function LoanCell({ row }: { row: Row<LoanApplicationsForTable> }) {
  const id = row.getValue('id') as string;

  const [symbol, setSymbol] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState<number | null>(null);

  const repaymentProgress =
    amount && repaymentAmount && amount > 0 ? (repaymentAmount / amount) * 100 : 0;

  useEffect(() => {
    const fetchLoanAmount = async () => {
      const loanAmount = await getLoanAmountAction(id);
      const loanRepaymentAmount = await getLoanRepaymentAmountAction(id);
      const tokenSymbol = await getTokenSymbolAction();
      setAmount(loanAmount);
      setRepaymentAmount(loanRepaymentAmount);
      setSymbol(tokenSymbol);
    };
    fetchLoanAmount();
  }, [id]);

  if (amount === null || repaymentAmount === null) {
    return <Skeleton className="h-4 w-60" />;
  }

  return (
    <div className="flex items-center gap-2">
      <div>
        Amount: {amount} {symbol}
      </div>
      <div>
        Repaid: {repaymentAmount} {symbol}
      </div>
      <div>Remaining: {repaymentProgress.toFixed(2)}%</div>
    </div>
  );
}

function LoanRemainingMonthsCell({ row }: { row: Row<LoanApplicationsForTable> }) {
  const id = row.getValue('id') as string;

  const [remainingMonths, setRemainingMonths] = useState<number | null>(null);

  useEffect(() => {
    const fetchLoanRemainingMonths = async () => {
      const loanRemainingMonths = await getLoanRemainingMonthsAction(id);
      setRemainingMonths(loanRemainingMonths);
    };
    fetchLoanRemainingMonths();
  }, [id]);

  if (remainingMonths === null) {
    return <Skeleton className="h-4 w-60" />;
  }

  const status = row.getValue('status') as LoanApplicationStatus;

  if (remainingMonths === 0) {
    if (status === LoanApplicationStatus.APPROVED) {
      return <div>Loan is due</div>;
    }

    return <div>-</div>;
  }

  if (status === LoanApplicationStatus.APPROVED) {
    return <div>{remainingMonths} months</div>;
  }

  return <div>-</div>;
}
