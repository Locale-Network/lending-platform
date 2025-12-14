import LoanApplicationForm from './form';
import { getSession } from '@/lib/auth/authorization';
import { initialiseLoanApplication } from './actions';
import { getIdentityVerificationStatus } from '@/app/borrower/account/actions';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { createLinkTokenForTransactions } from './actions';

export default async function Page() {
  const session = await getSession();
  const accountAddress = session?.address;

  if (!accountAddress) {
    return null;
  }

  const { hasAttemptedKyc, identityVerificationData } =
    await getIdentityVerificationStatus(accountAddress);

  if (!hasAttemptedKyc || !identityVerificationData) {
    redirect('/borrower/account');
  }

  return (
    <Suspense
      fallback={
        <div>
          Preparing application... <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      }
    >
      <LoanApplication accountAddress={accountAddress} />
    </Suspense>
  );
}

async function LoanApplication({ accountAddress }: { accountAddress: string }) {
  const { isError, errorMessage, loanApplicationId } =
    await initialiseLoanApplication(accountAddress);

  if (isError || !loanApplicationId) {
    return <div>{errorMessage}</div>;
  }

  const {
    isError: isErrorLinkToken,
    errorMessage: errorMessageLinkToken,
    linkToken,
  } = await createLinkTokenForTransactions(accountAddress);

  if (isErrorLinkToken || !linkToken) {
    return <div>{errorMessageLinkToken}</div>;
  }

  return (
    <LoanApplicationForm
      loanApplicationId={loanApplicationId}
      accountAddress={accountAddress}
      linkToken={linkToken}
    />
  );
}
