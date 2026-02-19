'use client';

import { LoanApplication, LoanApplicationStatus } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Wallet,
  Clock,
  RefreshCw,
  Hash,
  TrendingUpIcon,
  PercentIcon,
  DollarSign,
} from 'lucide-react';
import { getLoanStatusStyle } from '@/utils/colour';
import { formatDateToUS } from '@/utils/date';
import { formatAddress } from '@/utils/string';
import { Address } from 'viem';
import { Progress } from '@/components/ui/progress';

interface Props {
  loanApplication?: LoanApplication;
  tokenSymbol?: string;
  loanActive?: boolean;
  loanAmount?: number;
  /** Interest rate in basis points (e.g., 1500 = 15.00%) */
  loanInterestRate?: number;
  loanRepaymentAmount?: number;
}

export default function LoanInformation({
  loanApplication,
  tokenSymbol,
  loanActive = false,
  loanAmount = 0,
  loanInterestRate = 0,
  loanRepaymentAmount = 0,
}: Props) {
  const statusStyle = getLoanStatusStyle(loanApplication?.status);

  const repaymentProgress = loanAmount > 0 ? (loanRepaymentAmount / loanAmount) * 100 : 0;

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
            <span className="ml-1">
              {loanApplication?.status === LoanApplicationStatus.DISBURSED
                ? 'ACTIVE'
                : loanApplication?.status.replace(/_/g, ' ') ?? 'loading...'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <Hash className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Loan id:</span>
          </div>
          <span className="break-all font-mono text-xs sm:text-sm">{loanApplication?.id}</span>
        </div>

        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Borrower address:</span>
          </div>
          <span className="break-all font-mono text-xs sm:text-sm">
            {loanApplication ? formatAddress(loanApplication.accountAddress as Address) : ''}
          </span>
        </div>
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Created At:</span>
          </div>
          <span className="text-sm">
            {loanApplication ? formatDateToUS(loanApplication.createdAt) : ''}
          </span>
        </div>
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Last Updated:</span>
          </div>
          <span className="text-sm">
            {loanApplication ? formatDateToUS(loanApplication.updatedAt) : ''}
          </span>
        </div>
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <PercentIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Interest Rate:</span>
          </div>
          <span className="text-sm">{(loanInterestRate / 100).toFixed(2)}%</span>
        </div>
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">
              {loanApplication?.status === LoanApplicationStatus.APPROVED ||
               loanApplication?.status === LoanApplicationStatus.DISBURSED ||
               loanApplication?.status === LoanApplicationStatus.REPAID
                ? 'Loan Amount:'
                : 'Requested Amount:'}
            </span>
          </div>
          <span className="text-sm">
            {(loanApplication?.status === LoanApplicationStatus.APPROVED ||
              loanApplication?.status === LoanApplicationStatus.DISBURSED ||
              loanApplication?.status === LoanApplicationStatus.REPAID
                ? loanAmount
                : loanApplication?.requestedAmount
                  ? Number(loanApplication.requestedAmount)
                  : loanAmount
            ).toLocaleString()}{' '}
            {tokenSymbol}
          </span>
        </div>
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Funds:</span>
          </div>
          {loanActive ? (
            <div className="rounded-md bg-green-200 px-2 py-1 text-sm text-green-800">issued</div>
          ) : repaymentProgress >= 100 ? (
            <div className="rounded-md bg-blue-200 px-2 py-1 text-sm text-blue-800">fully repaid</div>
          ) : (
            <div className="rounded-md bg-gray-200 px-2 py-1 text-sm text-gray-800">not issued</div>
          )}
        </div>
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Repayment Amount:</span>
          </div>
          <span className="text-sm">
            {loanRepaymentAmount} {tokenSymbol}
          </span>
        </div>
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0">
          <div className="flex flex-1 items-center space-x-2">
            <TrendingUpIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">Repayment Progress:</span>
          </div>
          <Progress className="flex-1 " value={repaymentProgress} />
        </div>
      </CardContent>
    </Card>
  );
}
