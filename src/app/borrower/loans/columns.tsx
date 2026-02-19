'use client';

import { LoanApplicationStatus } from '@prisma/client';
import { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { getLoanStatusStyle } from '@/utils/colour';
import { formatDateToUS } from '@/utils/date';
import { LoanActionsCell } from './loan-actions-cell';

export type LoanApplicationsForTable = {
  id: string;
  status: LoanApplicationStatus;
  createdDate: Date;
  updatedDate: Date;
  accountAddress: string;
};

export const columns: ColumnDef<LoanApplicationsForTable>[] = [
  {
    accessorKey: 'id',
    header: 'Application ID',
    cell: ({ row }) => {
      const id = row.getValue('id') as string;
      const status = row.original.status;
      // Draft applications link to the apply page to continue editing
      const href = status === LoanApplicationStatus.DRAFT
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
    cell: ({ row }) => <LoanActionsCell loan={row.original} />,
  },
];
