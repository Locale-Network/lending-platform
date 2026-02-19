import { getSession } from '@/lib/auth/authorization';
import { redirect } from 'next/navigation';
import prisma from '@prisma/index';
import BusinessInformation from '@/app/borrower/loans/[id]/business-information';
import DscrVerificationCard from '@/app/borrower/loans/[id]/dscr-verification-card';
import AdminLoanInformation from './admin-loan-information';
import AdminTransactionsHistory from './admin-transactions-history';
import {
  getLoanActive,
  getLoanAmount,
  getLoanInterestRate,
  getLoanRepaymentAmount,
  getLoanInterestAmount,
} from '@/services/contracts/creditTreasuryPool';
import { getTokenDecimals, getTokenSymbol } from '@/services/contracts/token';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function AdminLoanDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  const session = await getSession();

  if (!session || !session.address) {
    redirect('/');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }

  // Fetch loan application with borrower info
  const loanApplication = await prisma.loanApplication.findUnique({
    where: { id },
    include: {
      account: true,
      outstandingLoans: true,
      debtService: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      creditScore: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      poolLoans: {
        include: {
          pool: {
            select: {
              id: true,
              name: true,
              slug: true,
              contractPoolId: true,
            },
          },
        },
      },
    },
  });

  if (!loanApplication) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Loan application not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const borrowerAddress = loanApplication.accountAddress;

  // Fetch token info and on-chain loan data with error handling
  let tokenDecimals = 6; // Default for USDC
  let tokenSymbol = 'USDC';
  let loanActive = false;
  let loanAmount = BigInt(0);
  let loanInterestRate = BigInt(0);
  let loanRepaymentAmount = BigInt(0);

  try {
    tokenDecimals = await getTokenDecimals();
    tokenSymbol = await getTokenSymbol();
  } catch (error) {
    console.error('[Admin Loan Page] Error fetching token info:', error);
  }

  let loanInterestAmount = BigInt(0);

  try {
    loanActive = await getLoanActive(id);
    loanAmount = await getLoanAmount(id);
    loanInterestRate = await getLoanInterestRate(id);
    loanRepaymentAmount = await getLoanRepaymentAmount(id);
    loanInterestAmount = await getLoanInterestAmount(id);
  } catch (error) {
    console.error('[Admin Loan Page] Error fetching on-chain loan data:', error);
    // Loan may not exist on-chain yet (not disbursed)
  }

  // Check if yield was already distributed for this loan
  const yieldDistributed = await prisma.yieldDistribution.findFirst({
    where: { loanApplicationId: id },
    select: { id: true, distributionTxHash: true },
  });

  return (
    <div className="space-y-6 p-8 pb-24">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/borrowers"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Borrowers
        </Link>
      </div>

      {/* Borrower Info Header */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Borrower Address</p>
            <p className="font-mono font-semibold">
              {borrowerAddress.slice(0, 6)}...{borrowerAddress.slice(-4)}
            </p>
          </div>
          {loanApplication.poolLoans.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground">Assigned Pool(s)</p>
              <div className="flex gap-2 mt-1">
                {loanApplication.poolLoans.map((pl) => (
                  <Link
                    key={pl.pool.id}
                    href={`/admin/pools/${pl.pool.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {pl.pool.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left Column - Business Info and Loan Info */}
        <div className="space-y-4">
          <BusinessInformation business={loanApplication} />
          <AdminLoanInformation
            loanApplication={loanApplication}
            tokenSymbol={tokenSymbol}
            loanAmount={Number(loanAmount) / 10 ** tokenDecimals}
            loanInterestRate={Number(loanInterestRate)}
            loanRepaymentAmount={
              // If loan is inactive but has an on-chain amount, it was fully repaid
              !loanActive && Number(loanAmount) > 0
                ? Number(loanAmount) / 10 ** tokenDecimals
                : Number(loanRepaymentAmount) / 10 ** tokenDecimals
            }
            loanActive={loanActive}
            adminAddress={session.address}
            interestAmount={Number(loanInterestAmount) / 10 ** tokenDecimals}
            yieldDistributed={!!yieldDistributed}
          />
        </div>
        {/* Right Column - Data Verification */}
        <DscrVerificationCard loanApplicationId={id} />
      </div>

      {/* Full Width - Transactions History (without Bank tab) */}
      <div className="mt-4">
        <AdminTransactionsHistory
          loanApplicationId={id}
          borrowerAddress={borrowerAddress}
        />
      </div>
    </div>
  );
}
