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
          isAdmin={isAdmin}
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
