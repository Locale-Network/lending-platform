'use client';

import * as React from 'react';
import Table from '@/components/custom/data-table';
import PlaidLink from './plaid-link';
import { LoanApplication, LoanApplicationStatus } from '@prisma/client';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateToUS } from '@/utils/date';
import { getLoanStatusStyle } from '@/utils/colour';

interface Props {
  linkToken: string;
  loanApplications: LoanApplication[];
  accountAddress: string;
}

export default function Loans({ loanApplications, linkToken, accountAddress }: Props) {
  const [loanApplicationId, setLoanApplicationId] = React.useState<string | null>(null);

  return (
    <>
      {!loanApplicationId && (
        <>
          <p>Select a loan application</p>
          <div className="my-4" />
          <div className="grid grid-cols-1 gap-4">
            {loanApplications.map(loanApplication => (
              <InfoCard
                key={loanApplication.id}
                onSelectLoan={setLoanApplicationId}
                id={loanApplication.id}
                createdAt={loanApplication.createdAt}
                status={loanApplication.status}
              />
            ))}
          </div>
        </>
      )}

      {loanApplicationId && (
        <PlaidLink
          linkToken={linkToken}
          loanApplicationId={loanApplicationId}
          accountAddress={accountAddress}
        />
      )}
    </>
  );
}

interface InfoCardProps {
  onSelectLoan: (id: string) => void;
  id: string;
  createdAt: Date;
  status: LoanApplicationStatus;
}

function InfoCard({ onSelectLoan, id, createdAt, status }: InfoCardProps) {
  const statusStyles = getLoanStatusStyle(status);

  return (
    <Card
      onClick={() => onSelectLoan(id)}
      className="w-full max-w-md cursor-pointer transition-colors hover:bg-accent"
    >
      <CardContent className="flex items-center justify-between p-6">
        <div className="space-y-2">
          <p className="max-w-[250px] truncate text-sm font-medium text-muted-foreground">
            ID: {id}
          </p>
          <p className="text-sm text-muted-foreground">Created: {formatDateToUS(createdAt)}</p>
          <div
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles}`}
          >
            {status}
          </div>
        </div>
        <ChevronRight className="h-6 w-6 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
