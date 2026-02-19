'use client';

import { LoanApplicationStatus } from '@prisma/client';
import { MoreHorizontal, Trash2, FileEdit } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoanApplicationsForTable } from './columns';

interface LoanActionsCellProps {
  loan: LoanApplicationsForTable;
  onDeleteClick?: (loan: LoanApplicationsForTable) => void;
}

export function LoanActionsCell({ loan, onDeleteClick }: LoanActionsCellProps) {
  const router = useRouter();

  // Only show actions menu for draft applications
  if (loan.status !== LoanApplicationStatus.DRAFT) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => router.push(`/borrower/loans/apply?applicationId=${loan.id}`)}
        >
          <FileEdit className="mr-2 h-4 w-4" />
          Continue editing
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDeleteClick?.(loan)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete draft
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
