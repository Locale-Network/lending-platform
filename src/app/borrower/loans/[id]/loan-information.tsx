'use client';

import { LoanApplication, LoanApplicationStatus } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Clock, RefreshCw, Hash } from 'lucide-react';
import { getLoanStatusStyle } from '@/utils/colour';
import { formatDateToUS } from '@/utils/date';
import { formatAddress } from '@/utils/string';
import { Address } from 'viem';

interface Props {
  loanApplication: LoanApplication;
}

export default function LoanInformation({ loanApplication }: Props) {
  const statusStyle = getLoanStatusStyle(loanApplication.status);

  return (
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
        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <Hash className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Loan id:</span>
          </div>
          <span className="break-all font-mono text-xs sm:text-sm">{loanApplication.id}</span>
        </div>

        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Borrower address:</span>
          </div>
          <span className="break-all font-mono text-xs sm:text-sm">
            {formatAddress(loanApplication.accountAddress as Address)}
          </span>
        </div>
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Created At:</span>
          </div>
          <span className="text-sm">{formatDateToUS(loanApplication.createdAt)}</span>
        </div>
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Last Updated:</span>
          </div>
          <span className="text-sm">{formatDateToUS(loanApplication.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}