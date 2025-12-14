import { getLoanApplication } from './actions';
import { getSession } from '@/lib/auth/authorization';
import BusinessInformation from './business-information';
import LoanInformation from './loan-information';
import DscrVerificationCard from './dscr-verification-card';
import TransactionsHistory from './transactions-history';
import { LoanApplicationStatus } from '@prisma/client';
import DebtService from './debt-service';
import {
  getLoanActive,
  getLoanAmount,
  getLoanInterestRate,
  getLoanRepaymentAmount,
} from '@/services/contracts/simpleLoanPool';
import { getTokenDecimals, getTokenSymbol } from '@/services/contracts/token';

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
  const loanAmount = await getLoanAmount(id);
  const loanInterestRate = await getLoanInterestRate(id);
  const loanRepaymentAmount = await getLoanRepaymentAmount(id);

  return (
    <>
      {loanApplication.status !== LoanApplicationStatus.APPROVED &&
        loanApplication.status !== LoanApplicationStatus.REJECTED && (
          <div className="flex justify-end">
            <DebtService loanApplicationId={id} />
          </div>
        )}
      <div className="my-4" />
      <div className="grid grid-cols-1 gap-4 p-0 md:grid-cols-2">
        {/* Left Column - Business Info and Loan Info */}
        <div className="space-y-4">
          <BusinessInformation business={loanApplication} />
          <LoanInformation
            loanApplication={loanApplication}
            tokenSymbol={tokenSymbol}
            loanAmount={Number(loanAmount) / 10 ** tokenDecimals}
            loanInterestRate={Number(loanInterestRate)}
            loanRepaymentAmount={Number(loanRepaymentAmount) / 10 ** tokenDecimals}
            loanActive={loanActive}
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
