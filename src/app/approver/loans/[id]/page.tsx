import { getLoanApplication } from './actions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/auth-options';
import BusinessInformation from './business-information';
import CreditScoreInformation from './credit-score-information';
import DebtServiceInformation from './debt-service-information';
import LoanInformation from './loan-information';
import OutstandingLoans from './outstanding-loans';
import LoanStatus from './loan-status';
import { getTokenSymbol } from '@/services/contracts/token';
import {
  getLoanAmount,
  getLoanActive,
  getLoanInterestRate,
  getLoanRepaymentAmount,
} from '@/services/contracts/simpleLoanPool';
import { getTokenDecimals } from '@/services/contracts/token';

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params;

  const session = await getServerSession(authOptions);
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
      <div className="flex justify-end p-4">
        <LoanStatus
          approverAddress={accountAddress}
          loanId={id}
          currentStatus={loanApplication.status}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <LoanInformation
          loanApplication={loanApplication}
          tokenSymbol={tokenSymbol}
          loanAmount={Number(loanAmount) / 10 ** tokenDecimals}
          loanInterestRate={Number(loanInterestRate)}
          loanRepaymentAmount={Number(loanRepaymentAmount) / 10 ** tokenDecimals}
          loanActive={loanActive}
        />
        <BusinessInformation business={loanApplication} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CreditScoreInformation creditScore={loanApplication.creditScore?.[0] ?? null} />
          <DebtServiceInformation debtService={loanApplication.debtService?.[0] ?? null} />
        </div>
        <OutstandingLoans loans={loanApplication.outstandingLoans} />
      </div>
    </>
  );
}
