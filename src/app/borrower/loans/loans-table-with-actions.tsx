'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteDraftLoanApplication } from './actions';
import { LoanApplicationsForTable } from './columns';
import { LoanActionsCell } from './loan-actions-cell';
import { LoanApplicationStatus } from '@prisma/client';
import Link from 'next/link';
import { getLoanStatusStyle } from '@/utils/colour';
import { formatDateToUS } from '@/utils/date';
import Pagination from '@/components/custom/pagination';

interface LoansTableWithActionsProps {
  loans: LoanApplicationsForTable[];
  totalPages: number;
}

export function LoansTableWithActions({ loans, totalPages }: LoansTableWithActionsProps) {
  const [loanToDelete, setLoanToDelete] = useState<LoanApplicationsForTable | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDeleteClick = (loan: LoanApplicationsForTable) => {
    setLoanToDelete(loan);
  };

  const handleDeleteConfirm = async () => {
    if (!loanToDelete) return;

    setIsDeleting(true);

    try {
      const result = await deleteDraftLoanApplication(loanToDelete.id, loanToDelete.accountAddress);

      if (result.success) {
        toast({
          title: 'Draft deleted',
          description: 'Your draft application has been deleted.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete draft application.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setLoanToDelete(null);
      router.refresh();
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !isDeleting) {
      setLoanToDelete(null);
    }
  };

  // Define columns with the delete handler
  const columns: ColumnDef<LoanApplicationsForTable>[] = [
    {
      accessorKey: 'id',
      header: 'Application ID',
      cell: ({ row }) => {
        const id = row.getValue('id') as string;
        const status = row.original.status;
        const href =
          status === LoanApplicationStatus.DRAFT
            ? `/borrower/loans/apply?applicationId=${id}`
            : `/borrower/loans/${id}`;

        return (
          <Link
            href={href}
            className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 hover:bg-blue-100 hover:text-blue-800"
          >
            {id}
          </Link>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as LoanApplicationStatus;
        const statusStyles = getLoanStatusStyle(status);

        return (
          <div
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles}`}
          >
            {status}
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
      header: '',
      cell: ({ row }) => (
        <LoanActionsCell loan={row.original} onDeleteClick={handleDeleteClick} />
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-auto">
        <DataTable columns={columns} data={loans} />
        <div className="flex w-full items-center justify-center">
          <p className="flex flex-row gap-2 whitespace-nowrap">Total: {loans.length}</p>
          <Pagination totalPages={totalPages} />
        </div>
      </div>

      {/* Delete Confirmation Dialog - rendered at this stable level */}
      <AlertDialog open={loanToDelete !== null} onOpenChange={handleDialogClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your draft loan application. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button onClick={handleDeleteConfirm} disabled={isDeleting} variant="destructive">
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
