'use server';

import {
  getSubmittedLoanApplications as dbGetSubmittedLoanApplications,
  updateLoanApplication as dbUpdateLoanApplication,
  getLoanApplication,
} from '@/services/db/loan-applications/approver';
import { prisma } from '@/lib/prisma';
import {
  calculateInterestRateFromDSCR,
  calculateDscrRateFromTransactions,
  DEFAULT_INTEREST_RATE_BP,
} from '@/lib/interest-rate';
import { formatAddress } from '@/utils/string';
import { LoanApplicationsForTable } from './columns';
import { getSession } from '@/lib/auth/authorization';
import { ROLE_REDIRECTS } from '@/app/api/auth/auth-pages';
import { LoanApplicationStatus, Role } from '@prisma/client';
import { redirect } from 'next/navigation';
import { Address, isAddress } from 'viem';

// Valid loan status transitions (current -> allowed next states)
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['PENDING', 'APPROVED', 'REJECTED'],
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['DISBURSED', 'REJECTED'],
  DISBURSED: ['ACTIVE'],
  ACTIVE: ['REPAID', 'DEFAULTED'],
  REPAID: [],
  DEFAULTED: [],
  REJECTED: [],
};
import { revalidatePath } from 'next/cache';
import {
  activateLoan,
  createLoan,
  getLoanActive,
  getLoanAmount,
  getLoanPoolRemaining,
  getLoanRemainingMonths,
  getLoanRepaymentAmount,
  loanExistsOnChain,
} from '@/services/contracts/creditTreasuryPool';
import { getTokenDecimals, getTokenSymbol } from '@/services/contracts/token';
import { submitInput } from '@/services/cartesi';
import { calculateAndStorePoolRisk } from '@/services/risk';
import { FundingUrgencyToTermMonths, type FundingUrgencyType } from '@/app/borrower/loans/apply/form-schema';
import { subMonths } from 'date-fns';

export async function validateRequest(accountAddress: string) {
  const session = await getSession();

  if (!session) {
    redirect('/sign-in');
  }

  if (session.user.role !== Role.APPROVER && session.user.role !== Role.ADMIN) {
    redirect(ROLE_REDIRECTS[session.user.role]);
  }

  if (session?.address !== accountAddress) {
    throw new Error('User address does not match chain account address');
  }

  if (!isAddress(accountAddress)) {
    throw new Error('Invalid chain account address');
  }
}

interface GetSubmittedLoanApplicationsResponse {
  isError: boolean;
  errorMessage?: string;
  loanApplications?: LoanApplicationsForTable[];
}
export const getSubmittedLoanApplications = async (
  accountAddress: string
): Promise<GetSubmittedLoanApplicationsResponse> => {
  try {
    await validateRequest(accountAddress);

    const loanApplications = await dbGetSubmittedLoanApplications();

    const loanApplicationsForTable: LoanApplicationsForTable[] = loanApplications.map(loan => ({
      id: loan.id,
      creatorAddress: formatAddress(loan.account.address as Address),
      creditScoreEquifax: loan.creditScore?.[0]?.creditScoreEquifax ?? null,
      creditScoreTransUnion: loan.creditScore?.[0]?.creditScoreTransUnion ?? null,
      transactionCount: loan.debtService?.[0]?.transactionCount ?? null,
      status: loan.status,
      createdDate: loan.createdAt,
      updatedDate: loan.updatedAt,
    }));

    return {
      isError: false,
      loanApplications: loanApplicationsForTable,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: 'Failed to fetch loan applications',
    };
  }
};

interface UpdateLoanApplicationStatusResponse {
  isError: boolean;
  errorMessage?: string;
}

/**
 * Update loan application status (generic status update)
 * For APPROVED status, use approveLoan() instead
 * For disbursement, use disburseLoan() instead
 */
export const updateLoanApplicationStatus = async (args: {
  loanApplicationId: string;
  status: LoanApplicationStatus;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  try {
    const { loanApplicationId, status } = args;

    // For APPROVED status, use approveLoan() instead
    if (status === LoanApplicationStatus.APPROVED) {
      return approveLoan({ loanApplicationId });
    }

    // Validate status transition
    const loan = await prisma.loanApplication.findUnique({
      where: { id: loanApplicationId },
      select: { status: true },
    });

    if (!loan) {
      return { isError: true, errorMessage: 'Loan application not found' };
    }

    const allowedTransitions = VALID_TRANSITIONS[loan.status] || [];
    if (!allowedTransitions.includes(status)) {
      return {
        isError: true,
        errorMessage: `Cannot transition from ${loan.status} to ${status}`,
      };
    }

    await dbUpdateLoanApplication({ loanApplicationId, loanApplication: { status } });

    revalidatePath('/approver');

    return {
      isError: false,
    };
  } catch (error) {
    console.error('[Approver] Error updating loan status:', error);
    return {
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Failed to update loan application status',
    };
  }
};

/**
 * Approve a loan application
 *
 * This function:
 * 1. Updates database status to APPROVED
 * 2. Submits approve_loan action to Cartesi
 * 3. Does NOT disburse funds (use disburseLoan for that)
 */
export const approveLoan = async (args: {
  loanApplicationId: string;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  try {
    const { loanApplicationId } = args;

    // Fetch loan details to validate
    const loan = await getLoanApplication({ loanApplicationId });
    if (!loan) {
      throw new Error(`Loan application ${loanApplicationId} not found`);
    }

    // Only allow approval of SUBMITTED or PENDING loans
    if (loan.status !== 'SUBMITTED' && loan.status !== 'PENDING') {
      throw new Error(`Cannot approve loan with status: ${loan.status}`);
    }

    // Update database status to APPROVED
    await dbUpdateLoanApplication({
      loanApplicationId,
      loanApplication: { status: LoanApplicationStatus.APPROVED },
    });

    // Submit approve_loan action to Cartesi
    try {
      await submitInput({
        action: 'approve_loan',
        loan_id: loanApplicationId,
        approved_by: 'admin', // In future, get from session
        approved_at: Math.floor(Date.now() / 1000),
      });
      console.log(`[Approver] Loan ${loanApplicationId} approved in Cartesi`);
    } catch (cartesiError) {
      // Log but don't fail - Cartesi update is secondary
      console.warn(`[Approver] Failed to update Cartesi: ${cartesiError instanceof Error ? cartesiError.message : 'Unknown error'}`);
    }

    revalidatePath('/approver');
    revalidatePath(`/approver/loans/${loanApplicationId}`);

    return {
      isError: false,
    };
  } catch (error) {
    console.error('[Approver] Error approving loan:', error);
    return {
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Failed to approve loan',
    };
  }
};

interface DisburseLoanResponse {
  isError: boolean;
  errorMessage?: string;
  txHash?: string;
}

/**
 * Disburse funds for an approved loan (ADMIN ONLY)
 *
 * This function:
 * 1. Validates loan is in APPROVED status
 * 2. Calls SimpleLoanPool.createLoan() on-chain (stores borrower address)
 * 3. Calls SimpleLoanPool.activateLoan() on-chain (transfers funds to borrower)
 * 4. Updates database status to DISBURSED
 */
export const disburseLoan = async (args: {
  loanApplicationId: string;
  accountAddress: string;
}): Promise<DisburseLoanResponse> => {
  try {
    const { loanApplicationId, accountAddress } = args;

    // Validate admin role
    await validateRequest(accountAddress);
    const session = await getSession();
    if (session?.user.role !== Role.ADMIN) {
      throw new Error('Only ADMIN can disburse loans');
    }

    // Fetch loan details
    const loan = await getLoanApplication({ loanApplicationId });
    if (!loan) {
      throw new Error(`Loan application ${loanApplicationId} not found`);
    }

    // Only allow disbursement of APPROVED loans
    if (loan.status !== 'APPROVED') {
      throw new Error(`Cannot disburse loan with status: ${loan.status}. Loan must be APPROVED first.`);
    }

    // Get loan parameters
    const loanAmount = loan.requestedAmount ? Number(loan.requestedAmount) : 0;
    if (loanAmount <= 0) {
      throw new Error('Loan amount must be greater than 0');
    }

    const borrowerAddress = loan.accountAddress;
    if (!borrowerAddress || !isAddress(borrowerAddress)) {
      throw new Error('Invalid borrower address');
    }

    // Fetch the latest completed DSCR calculation to get the calculated interest rate
    const latestDscrCalculation = await prisma.dSCRCalculationLog.findFirst({
      where: {
        loanApplicationId: loanApplicationId,
        status: 'COMPLETED',
        calculatedRate: { not: null },
      },
      orderBy: { completedAt: 'desc' },
    });

    // Term months from borrower's funding urgency selection
    const termMonths = loan.fundingUrgency
      ? FundingUrgencyToTermMonths[loan.fundingUrgency as FundingUrgencyType] || 24
      : 24;

    // Use calculated rate from Cartesi if available
    let interestRate: number;
    if (latestDscrCalculation?.calculatedRate) {
      interestRate = Math.round(latestDscrCalculation.calculatedRate);
    } else {
      // Cartesi hasn't returned a rate yet — calculate from stored transactions
      const DSCR_WINDOW_MONTHS = 3;
      const windowStartDate = subMonths(new Date(), DSCR_WINDOW_MONTHS);
      const transactions = await prisma.transaction.findMany({
        where: {
          loanApplicationId,
          isDeleted: false,
          transactionId: { not: null },
          date: { gte: windowStartDate },
        },
        distinct: ['transactionId'],
        select: { amount: true, date: true },
      });

      const { interestRate: dscrRate } = calculateDscrRateFromTransactions(
        transactions,
        loanAmount,
        termMonths,
      );
      interestRate = dscrRate;
      console.log(`[Approver] No calculatedRate in DB, derived ${interestRate}bp from DSCR (${transactions.length} txns)`);
    }

    const tokenDecimals = await getTokenDecimals();
    const amountInTokenUnits = BigInt(loanAmount) * BigInt(10 ** tokenDecimals);

    console.log(`[Approver] Disbursing loan ${loanApplicationId}:`, {
      borrower: borrowerAddress,
      amount: loanAmount,
      amountInTokenUnits: amountInTokenUnits.toString(),
      interestRate,
      termMonths,
    });

    // Step 1: Check pool has sufficient funds for disbursement
    const poolBalance = await getLoanPoolRemaining();
    console.log(`[Approver] Pool balance: ${poolBalance.toString()}, Required: ${amountInTokenUnits.toString()}`);

    if (poolBalance < amountInTokenUnits) {
      throw new Error(
        `Insufficient pool funds. Available: ${poolBalance.toString()}, Required: ${amountInTokenUnits.toString()}. ` +
          `Transfer funds from StakingPool via Admin Pool Transfer before disbursing.`
      );
    }

    // Step 2: Check if loan already exists on-chain (idempotency check)
    const loanExists = await loanExistsOnChain(loanApplicationId);

    if (loanExists) {
      console.log(`[Approver] Loan ${loanApplicationId} already exists on-chain, skipping createLoan`);

      // Check if loan is already active
      const isActive = await getLoanActive(loanApplicationId);
      if (!isActive) {
        // Loan exists but not active - just activate it
        console.log(`[Approver] Loan exists but not active, activating...`);
        await activateLoan(loanApplicationId);
        console.log(`[Approver] Loan activated, funds transferred to ${borrowerAddress}`);
      } else {
        console.log(`[Approver] Loan already active, skipping activation`);
      }
    } else {
      // Step 3: Create loan on-chain (stores borrower address for fund transfer)
      console.log(`[Approver] Creating loan on SimpleLoanPool...`);
      await createLoan(
        loanApplicationId,
        borrowerAddress,
        Number(amountInTokenUnits),
        interestRate,
        termMonths
      );
      console.log(`[Approver] Loan created on-chain`);

      // Step 4: Activate loan (transfers funds to borrower)
      console.log(`[Approver] Activating loan (transferring funds)...`);
      await activateLoan(loanApplicationId);
      console.log(`[Approver] Loan activated, funds transferred to ${borrowerAddress}`);
    }

    // Step 5: Update database status to DISBURSED
    await dbUpdateLoanApplication({
      loanApplicationId,
      loanApplication: { status: LoanApplicationStatus.DISBURSED },
    });

    // Step 5b: Find the target pool (borrower's selection) or fallback to oldest active
    let activePool = loan.targetPoolId
      ? await prisma.loanPool.findFirst({ where: { id: loan.targetPoolId, status: 'ACTIVE' } })
      : null;

    if (!activePool) {
      // Fallback for legacy applications without targetPoolId
      activePool = await prisma.loanPool.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (activePool) {
      // Create PoolLoan record to track this loan in the pool
      await prisma.poolLoan.upsert({
        where: {
          poolId_loanApplicationId: {
            poolId: activePool.id,
            loanApplicationId: loanApplicationId,
          },
        },
        create: {
          poolId: activePool.id,
          loanApplicationId: loanApplicationId,
          principal: loanAmount,
          interestRate: interestRate / 100, // Convert basis points to percentage
          termMonths: termMonths,
          expectedReturn: loanAmount * (1 + (interestRate / 10000) * (termMonths / 12)),
        },
        update: {
          principal: loanAmount,
          interestRate: interestRate / 100,
          termMonths: termMonths,
          expectedReturn: loanAmount * (1 + (interestRate / 10000) * (termMonths / 12)),
        },
      });

      // Update pool's available liquidity (decrease by loan amount)
      await prisma.loanPool.update({
        where: { id: activePool.id },
        data: {
          availableLiquidity: {
            decrement: loanAmount,
          },
        },
      });

      console.log(`[Approver] PoolLoan record created for pool ${activePool.id}, liquidity updated`);

      // Trigger composite risk recalculation for the pool (non-blocking)
      calculateAndStorePoolRisk(activePool.id).catch((err: Error) => {
        console.error(`[Approver] Failed to recalculate composite risk for pool ${activePool.id}:`, err);
      });
    } else {
      console.warn(`[Approver] No active pool found for loan ${loanApplicationId}`);
    }

    // Step 6: Update Cartesi with disbursement status
    try {
      await submitInput({
        action: 'disburse_loan',
        loan_id: loanApplicationId,
        disbursed_at: Math.floor(Date.now() / 1000),
        amount: loanAmount.toString(),
        borrower_address: borrowerAddress,
      });
      console.log(`[Approver] Loan ${loanApplicationId} disbursement recorded in Cartesi`);
    } catch (cartesiError) {
      // Log but don't fail - Cartesi update is secondary
      console.warn(`[Approver] Failed to update Cartesi disbursement: ${cartesiError instanceof Error ? cartesiError.message : 'Unknown error'}`);
    }

    revalidatePath('/approver');
    revalidatePath(`/approver/loans/${loanApplicationId}`);
    revalidatePath('/admin');
    revalidatePath('/explore/pools'); // Revalidate pool pages to show updated metrics

    return {
      isError: false,
    };
  } catch (error) {
    console.error('[Approver] Error disbursing loan:', error);
    return {
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Failed to disburse loan',
    };
  }
};

export const getLoanAmountAction = async (loanId: string): Promise<number> => {
  const loanAmount = await getLoanAmount(loanId);
  const tokenDecimals = await getTokenDecimals();
  return Number(loanAmount) / 10 ** tokenDecimals;
};

export const getLoanRepaymentAmountAction = async (loanId: string): Promise<number> => {
  const loanRepaymentAmount = await getLoanRepaymentAmount(loanId);
  const tokenDecimals = await getTokenDecimals();
  return Number(loanRepaymentAmount) / 10 ** tokenDecimals;
};

export const getLoanRemainingMonthsAction = async (loanId: string): Promise<number> => {
  const loanRemainingMonths = await getLoanRemainingMonths(loanId);
  return Number(loanRemainingMonths);
};

export const getTokenSymbolAction = async (): Promise<string> => {
  return await getTokenSymbol();
};
