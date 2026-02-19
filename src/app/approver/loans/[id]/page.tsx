import { getLoanApplication } from './actions';
import { getSession } from '@/lib/auth/authorization';
import BusinessInformation from './business-information';
import LoanInformation from './loan-information';
import OutstandingLoans from './outstanding-loans';
import DscrVerificationCard from './dscr-verification-card';
import LoanStatus from './loan-status';
import { getTokenSymbol } from '@/services/contracts/token';
import {
  getLoanAmount,
  getLoanActive,
  getLoanInterestRate,
  getLoanRepaymentAmount,
} from '@/services/contracts/creditTreasuryPool';
import { getTokenDecimals } from '@/services/contracts/token';
import { calculateDscrRateFromTransactions, DEFAULT_INTEREST_RATE_BP } from '@/lib/interest-rate';
import { FundingUrgencyToTermMonths, type FundingUrgencyType } from '@/app/borrower/loans/apply/form-schema';
import prisma from '@prisma/index';
import { subMonths } from 'date-fns';
import { Suspense } from 'react';
import { Role } from '@prisma/client';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <>
          <div className="flex justify-end p-4"> </div>
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            <LoanInformation />
            <BusinessInformation />
          </div>
        </>
      }
    >
      <AsyncPage params={props.params} />
    </Suspense>
  );
}

async function AsyncPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  const session = await getSession();
  const accountAddress = session?.address;
  const isAdmin = session?.user.role === Role.ADMIN;

  if (!accountAddress) {
    return <>No account address found</>;
  }

  const { loanApplication, isError, errorMessage } = await getLoanApplication({
    accountAddress: accountAddress,
    loanApplicationId: id,
  });

  if (isError) {
    return <>Error: {errorMessage}</>;
  }

  if (!loanApplication) {
    return <>loan with id {id} not found</>;
  }

  const tokenDecimals = await getTokenDecimals();
  const tokenSymbol = await getTokenSymbol();
  const loanActive = await getLoanActive(id);
  const onChainAmount = await getLoanAmount(id);
  const onChainInterestRate = await getLoanInterestRate(id);
  const loanRepaymentAmount = await getLoanRepaymentAmount(id);

  // Use on-chain values if available, otherwise fall back to database values
  // On-chain data is 0 before disbursement (loan hasn't been created on-chain yet)
  const onChainAmountNum = Number(onChainAmount) / 10 ** tokenDecimals;
  const dbRequestedAmount = loanApplication.requestedAmount
    ? Number(loanApplication.requestedAmount)
    : 0;
  const loanAmount = onChainAmountNum > 0 ? onChainAmountNum : dbRequestedAmount;

  // Interest rate: prefer on-chain non-default rate, then DSCR-derived rate
  let loanInterestRate = DEFAULT_INTEREST_RATE_BP;
  const onChainRate = Number(onChainInterestRate);
  if (onChainRate > 0 && onChainRate !== DEFAULT_INTEREST_RATE_BP) {
    loanInterestRate = onChainRate;
  } else {
    const DSCR_WINDOW_MONTHS = 3;
    const windowStartDate = subMonths(new Date(), DSCR_WINDOW_MONTHS);
    const transactions = await prisma.transaction.findMany({
      where: {
        loanApplicationId: id,
        isDeleted: false,
        transactionId: { not: null },
        date: { gte: windowStartDate },
      },
      distinct: ['transactionId'],
      select: { amount: true, date: true },
    });
    if (transactions.length > 0) {
      const termMonths = loanApplication.fundingUrgency
        ? FundingUrgencyToTermMonths[loanApplication.fundingUrgency as FundingUrgencyType] || 24
        : 24;
      const { interestRate: dscrRate } = calculateDscrRateFromTransactions(
        transactions, loanAmount, termMonths,
      );
      loanInterestRate = dscrRate;
    } else if (onChainRate > 0) {
      loanInterestRate = onChainRate;
    }
  }

  // If loan is inactive but has an on-chain amount, it was fully repaid
  const rawRepayment = Number(loanRepaymentAmount) / 10 ** tokenDecimals;
  const effectiveRepaymentAmount = (!loanActive && onChainAmountNum > 0)
    ? loanAmount
    : rawRepayment;

  return (
    <>
      <div className="flex justify-end p-4">
        <LoanStatus
          approverAddress={accountAddress}
          loanId={id}
          currentStatus={loanApplication.status}
          isAdmin={isAdmin}
          loanAmount={loanAmount}
          tokenSymbol={tokenSymbol}
          borrowerAddress={loanApplication.accountAddress}
          interestRate={loanInterestRate}
          loanActive={loanActive}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <LoanInformation
          loanApplication={loanApplication}
          tokenSymbol={tokenSymbol}
          loanAmount={loanAmount}
          loanInterestRate={loanInterestRate}
          loanRepaymentAmount={effectiveRepaymentAmount}
          loanActive={loanActive}
        />
        <DscrVerificationCard
          loanApplicationId={id}
          borrowerAddress={loanApplication.accountAddress}
        />
        <BusinessInformation business={loanApplication} />
        <OutstandingLoans loans={loanApplication.outstandingLoans} />
      </div>
    </>
  );
}
