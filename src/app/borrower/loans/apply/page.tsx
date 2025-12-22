import LoanApplicationForm from './form';
import { getSession } from '@/lib/auth/authorization';
import {
  initialiseLoanApplication,
  getExistingLoanApplication,
  createLinkTokenForTransactions,
  ExistingLoanData,
} from './actions';
import { getIdentityVerificationStatus } from '@/app/borrower/account/actions';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import prisma from '@prisma/index';

// Pool type for the form
export interface AvailablePool {
  id: string;
  name: string;
  slug: string;
  poolType: string;
  baseInterestRate: number;
  riskPremiumMin: number;
  riskPremiumMax: number;
  minimumStake: number;
  poolSize: number;
  availableLiquidity: number;
}

// Re-export for use in other components
export type { ExistingLoanData };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ applicationId?: string }>;
}) {
  const params = await searchParams;
  const { applicationId } = params;

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
      <LoanApplication accountAddress={accountAddress} existingApplicationId={applicationId} />
    </Suspense>
  );
}

async function LoanApplication({
  accountAddress,
  existingApplicationId,
}: {
  accountAddress: string;
  existingApplicationId?: string;
}) {
  let loanApplicationId: string;
  let existingLoanData: ExistingLoanData | undefined;

  // If editing an existing application, fetch its data
  if (existingApplicationId) {
    const { isError, errorMessage, loanData } = await getExistingLoanApplication({
      accountAddress,
      loanApplicationId: existingApplicationId,
    });

    if (isError || !loanData) {
      return <div>{errorMessage || 'Failed to load existing application'}</div>;
    }

    loanApplicationId = existingApplicationId;
    existingLoanData = loanData;
  } else {
    // Creating a new application
    const { isError, errorMessage, loanApplicationId: newId } =
      await initialiseLoanApplication(accountAddress);

    if (isError || !newId) {
      return <div>{errorMessage}</div>;
    }

    loanApplicationId = newId;
  }

  const {
    isError: isErrorLinkToken,
    errorMessage: errorMessageLinkToken,
    linkToken,
  } = await createLinkTokenForTransactions(accountAddress);

  if (isErrorLinkToken || !linkToken) {
    return <div>{errorMessageLinkToken}</div>;
  }

  // Fetch available pools (ACTIVE pools with available liquidity)
  const pools = await prisma.loanPool.findMany({
    where: {
      status: 'ACTIVE',
      availableLiquidity: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      poolType: true,
      baseInterestRate: true,
      riskPremiumMin: true,
      riskPremiumMax: true,
      minimumStake: true,
      poolSize: true,
      availableLiquidity: true,
    },
    orderBy: { name: 'asc' },
  });

  // Convert Decimal types to numbers for the client component
  const availablePools: AvailablePool[] = pools.map(pool => ({
    id: pool.id,
    name: pool.name,
    slug: pool.slug,
    poolType: pool.poolType,
    baseInterestRate: Number(pool.baseInterestRate),
    riskPremiumMin: Number(pool.riskPremiumMin),
    riskPremiumMax: Number(pool.riskPremiumMax),
    minimumStake: Number(pool.minimumStake),
    poolSize: Number(pool.poolSize),
    availableLiquidity: Number(pool.availableLiquidity),
  }));

  return (
    <LoanApplicationForm
      loanApplicationId={loanApplicationId}
      accountAddress={accountAddress}
      linkToken={linkToken}
      availablePools={availablePools}
      existingLoanData={existingLoanData}
    />
  );
}
