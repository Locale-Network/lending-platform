'use client';

import { useState } from 'react';
import { LoanApplication, LoanApplicationStatus } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, PercentIcon, DollarSign, TrendingUpIcon } from 'lucide-react';
import { getLoanStatusStyle } from '@/utils/colour';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { RepaymentModal } from '@/components/repayment-modal';

interface Props {
  loanApplication: LoanApplication;
  tokenSymbol: string;
  loanActive: boolean;
  loanAmount: number;
  loanInterestRate: number;
  loanRepaymentAmount: number;
  onRepaymentSuccess?: () => void;
}

export default function LoanInformation({
  loanApplication,
  tokenSymbol,
  loanActive = false,
  loanAmount,
  loanInterestRate,
  loanRepaymentAmount,
  onRepaymentSuccess,
}: Props) {
  const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
  const statusStyle = getLoanStatusStyle(loanApplication.status);

  const repaymentProgress = loanAmount > 0 ? (loanRepaymentAmount / loanAmount) * 100 : 0;

  return (
    <>
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
          {/* Key Loan Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Loan Amount</span>
              </div>
              <p className="mt-1 text-xl font-bold">
                {loanAmount.toLocaleString()} {tokenSymbol}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PercentIcon className="h-4 w-4" />
                <span>Interest Rate</span>
              </div>
              <p className="mt-1 text-xl font-bold">{loanInterestRate / 100}%</p>
            </div>
          </div>

          {/* Funds Status */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Funds Status</span>
            </div>
            {loanActive ? (
              <div className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                Issued
              </div>
            ) : (
              <div className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                Not Issued
              </div>
            )}
          </div>

          {/* Repayment Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUpIcon className="h-4 w-4" />
                <span>Repayment Progress</span>
              </div>
              <span className="font-medium">
                {loanRepaymentAmount.toLocaleString()} / {loanAmount.toLocaleString()} {tokenSymbol}
              </span>
            </div>
            <Progress value={repaymentProgress} className="h-2" />
            <p className="text-right text-xs text-muted-foreground">
              {repaymentProgress.toFixed(1)}% complete
            </p>
          </div>

          {/* Make a Payment Button */}
          {loanActive && repaymentProgress < 100 && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => setRepaymentModalOpen(true)}
            >
              Make a Payment
            </Button>
          )}
        </CardContent>
      </Card>

      <RepaymentModal
        open={repaymentModalOpen}
        onOpenChange={setRepaymentModalOpen}
        loanId={loanApplication.id}
        loanAmount={loanAmount}
        interestRate={loanInterestRate}
        repaidAmount={loanRepaymentAmount}
        tokenSymbol={tokenSymbol}
        onSuccess={onRepaymentSuccess}
      />
    </>
  );
}
