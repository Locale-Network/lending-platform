import { getLoanApplication } from './actions';
import { getSession } from '@/lib/auth/authorization';
import BusinessInformation from './business-information';
import LoanInformation from './loan-information';
import DscrVerificationCard from './dscr-verification-card';
import TransactionsHistory from './transactions-history';
import {
  getLoanActive,
  getLoanAmount,
  getLoanInterestRate,
  getLoanRepaymentAmount,
} from '@/services/contracts/creditTreasuryPool';
import { getTokenDecimals, getTokenSymbol } from '@/services/contracts/token';
import { calculateDscrRateFromTransactions, DEFAULT_INTEREST_RATE_BP } from '@/lib/interest-rate';
import { FundingUrgencyToTermMonths, type FundingUrgencyType } from '@/app/borrower/loans/apply/form-schema';
import prisma from '@prisma/index';
import { subMonths } from 'date-fns';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  const session = await getSession();
  const accountAddress = session?.address;

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
  const onChainAmountNum = Number(onChainAmount) / 10 ** tokenDecimals;
  const dbRequestedAmount = loanApplication.requestedAmount
    ? Number(loanApplication.requestedAmount)
    : 0;
  const loanAmount = onChainAmountNum > 0 ? onChainAmountNum : dbRequestedAmount;

  // Interest rate: prefer DSCR-derived rate for consistency with Data Verification card
  // Fall back to on-chain rate, then default
  let loanInterestRate = DEFAULT_INTEREST_RATE_BP;

  // First check on-chain rate
  const onChainRate = Number(onChainInterestRate);
  if (onChainRate > 0 && onChainRate !== DEFAULT_INTEREST_RATE_BP) {
    // On-chain rate is set and is not the default fallback — use it
    loanInterestRate = onChainRate;
  } else {
    // On-chain rate is 0 or default — calculate from DSCR for consistency
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
        transactions,
        loanAmount,
        termMonths,
      );
      loanInterestRate = dscrRate;
    } else if (onChainRate > 0) {
      loanInterestRate = onChainRate;
    }
  }

  // If loan is inactive but has an on-chain amount, it was fully repaid
  // (the old contract set loanIdToActive=false on full repayment but
  //  loanIdToRepaymentAmount didn't exist, so slot reads as 0)
  const rawRepayment = Number(loanRepaymentAmount) / 10 ** tokenDecimals;
  const effectiveRepaymentAmount = (!loanActive && onChainAmountNum > 0)
    ? loanAmount
    : rawRepayment;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 p-0 md:grid-cols-2">
        {/* Left Column - Business Info and Loan Info */}
        <div className="space-y-4">
          <BusinessInformation business={loanApplication} />
          <LoanInformation
            loanApplication={loanApplication}
            tokenSymbol={tokenSymbol}
            loanAmount={loanAmount}
            loanInterestRate={loanInterestRate}
            loanRepaymentAmount={effectiveRepaymentAmount}
            loanActive={loanActive}
            hasBankLinked={loanApplication.hasBankLinked}
          />
        </div>
        {/* Right Column - Data Verification */}
        <DscrVerificationCard loanApplicationId={id} />
      </div>
      {/* Full Width - Transactions History */}
      <div className="mt-4">
        <TransactionsHistory
          loanApplicationId={id}
          borrowerAddress={accountAddress}
        />
      </div>
    </>
  );
}
