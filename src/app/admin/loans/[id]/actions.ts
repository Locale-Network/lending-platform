'use server';

import {
  validateRequest as validateApproverRequest,
  approveLoan as approverApproveLoan,
  disburseLoan as approverDisburseLoan,
} from '@/app/approver/actions';
import {
  getLoanApplication as dbGetLoanApplication,
  updateLoanApplication as dbUpdateLoanApplication,
} from '@/services/db/loan-applications/approver';
import {
  getLoanActive,
  getLoanAmount,
  getLoanInterestAmount,
  transferFundsFromPool,
  getLoanPoolRemaining,
} from '@/services/contracts/creditTreasuryPool';
import { distributeYield as poolBridgeDistributeYield, setPoolCooldownWaived } from '@/services/contracts/poolBridge';
import { LoanApplicationStatus, Role } from '@prisma/client';
import { getSession } from '@/lib/auth/authorization';
import { revalidatePath } from 'next/cache';
import prisma from '@prisma/index';

interface UpdateLoanApplicationStatusResponse {
  isError: boolean;
  errorMessage?: string;
}

/**
 * Update loan application status (for non-approval status changes)
 * For APPROVED status, this delegates to approveLoan()
 */
export const updateLoanApplicationStatus = async (args: {
  accountAddress: string;
  loanApplicationId: string;
  status: LoanApplicationStatus;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  try {
    const { accountAddress, loanApplicationId, status } = args;
    await validateApproverRequest(accountAddress);

    // For APPROVED status, use the proper approval flow
    if (status === LoanApplicationStatus.APPROVED) {
      return approverApproveLoan({ loanApplicationId });
    }

    // For other statuses, update database directly
    await dbUpdateLoanApplication({ loanApplicationId, loanApplication: { status } });

    revalidatePath(`/admin/loans/${loanApplicationId}`);

    return {
      isError: false,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Error updating loan application status',
    };
  }
};

/**
 * Disburse funds for an approved loan (ADMIN ONLY)
 */
export const disburseLoan = async (args: {
  accountAddress: string;
  loanApplicationId: string;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  return approverDisburseLoan({
    loanApplicationId: args.loanApplicationId,
    accountAddress: args.accountAddress,
  });
};

/**
 * Close a fully repaid loan (ADMIN ONLY)
 *
 * Verifies on-chain that the loan is no longer active (fully repaid),
 * then transitions the database status from DISBURSED to REPAID.
 */
export const closeLoan = async (args: {
  accountAddress: string;
  loanApplicationId: string;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  try {
    const { accountAddress, loanApplicationId } = args;
    await validateApproverRequest(accountAddress);

    const session = await getSession();
    if (session?.user.role !== Role.ADMIN) {
      throw new Error('Only ADMIN can close loans');
    }

    // Verify the loan is fully repaid on-chain
    const loanActive = await getLoanActive(loanApplicationId);
    const onChainAmount = await getLoanAmount(loanApplicationId);

    if (loanActive) {
      throw new Error('Loan is still active on-chain. It must be fully repaid before closing.');
    }

    if (Number(onChainAmount) === 0) {
      throw new Error('Loan does not exist on-chain.');
    }

    const loan = await dbGetLoanApplication({ loanApplicationId });
    if (!loan) {
      throw new Error(`Loan application ${loanApplicationId} not found`);
    }

    if (loan.status !== LoanApplicationStatus.DISBURSED) {
      throw new Error(`Cannot close loan with status: ${loan.status}. Only DISBURSED loans can be closed.`);
    }

    await dbUpdateLoanApplication({
      loanApplicationId,
      loanApplication: { status: LoanApplicationStatus.REPAID },
    });

    // Waive cooldown on the pool so investors can unstake immediately
    const poolLoan = await prisma.poolLoan.findFirst({
      where: { loanApplicationId },
      include: {
        pool: {
          select: { id: true, contractPoolId: true },
          // Check if pool has any other active loans
        },
      },
    });

    if (poolLoan?.pool.contractPoolId) {
      // Check if any other loans in this pool are still active (DISBURSED)
      const activeLoansInPool = await prisma.poolLoan.count({
        where: {
          poolId: poolLoan.pool.id,
          loanApplicationId: { not: loanApplicationId },
          loanApplication: { status: LoanApplicationStatus.DISBURSED },
        },
      });

      // Only waive cooldown if no other loans are active in the pool
      if (activeLoansInPool === 0) {
        const waiveResult = await setPoolCooldownWaived(poolLoan.pool.contractPoolId, true);
        if (!waiveResult.success) {
          console.error(`[closeLoan] Failed to waive cooldown for pool ${poolLoan.pool.id}:`, waiveResult.error);
          // Non-fatal — loan is still closed, cooldown waiver can be done manually
        }
      }
    }

    revalidatePath(`/admin/loans/${loanApplicationId}`);
    revalidatePath('/admin');
    revalidatePath('/admin/borrowers');

    return { isError: false };
  } catch (error) {
    return {
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Failed to close loan',
    };
  }
};

/**
 * Distribute yield from a repaid loan to pool investors (ADMIN ONLY)
 *
 * Flow:
 * 1. Extract interest amount from CreditTreasuryPool to admin wallet
 * 2. Approve StakingPool to spend tokens
 * 3. Call StakingPool.distributeYield() to increase share value for investors
 */
export const distributeYieldForLoan = async (args: {
  accountAddress: string;
  loanApplicationId: string;
}): Promise<UpdateLoanApplicationStatusResponse & { txHash?: string }> => {
  try {
    const { accountAddress, loanApplicationId } = args;
    await validateApproverRequest(accountAddress);

    const session = await getSession();
    if (session?.user.role !== Role.ADMIN) {
      throw new Error('Only ADMIN can distribute yield');
    }

    // Verify the loan is fully repaid on-chain
    const loanActive = await getLoanActive(loanApplicationId);
    if (loanActive) {
      throw new Error('Loan is still active. It must be fully repaid before distributing yield.');
    }

    // Get the interest amount collected for this loan
    const interestAmount = await getLoanInterestAmount(loanApplicationId);
    if (interestAmount <= BigInt(0)) {
      throw new Error('No interest amount found for this loan.');
    }

    // Find the pool associated with this loan
    const poolLoan = await prisma.poolLoan.findFirst({
      where: { loanApplicationId },
      include: { pool: true },
    });

    if (!poolLoan || !poolLoan.pool.contractPoolId) {
      throw new Error('No pool with on-chain contract found for this loan.');
    }

    // Check if yield was already distributed for this loan
    const existingDistribution = await prisma.yieldDistribution.findFirst({
      where: { loanApplicationId },
    });

    if (existingDistribution) {
      throw new Error(
        `Yield already distributed for this loan (tx: ${existingDistribution.distributionTxHash?.slice(0, 10)}...)`
      );
    }

    // Check LoanPool has enough balance
    const poolBalance = await getLoanPoolRemaining();
    if (poolBalance < interestAmount) {
      throw new Error(
        `Insufficient LoanPool balance. Need ${interestAmount.toString()} but pool has ${poolBalance.toString()}.`
      );
    }

    // Step 1: Transfer interest from CreditTreasuryPool to pool admin wallet
    const { getPoolAdminAddress } = await import('@/services/contracts/poolBridge');
    const adminWalletAddress = getPoolAdminAddress();

    const transferResult = await transferFundsFromPool(adminWalletAddress, interestAmount);
    if (!transferResult.success) {
      throw new Error(`Failed to extract funds from LoanPool: ${transferResult.error}`);
    }

    // Step 2 & 3: Approve + distribute yield to StakingPool
    const loanAmount = await getLoanAmount(loanApplicationId);
    const principalAmount = loanAmount > BigInt(0) ? loanAmount : BigInt(0);

    const distributeResult = await poolBridgeDistributeYield(
      poolLoan.pool.id,
      poolLoan.pool.contractPoolId,
      interestAmount,
      loanApplicationId,
      principalAmount,
      0
    );

    if (!distributeResult.success) {
      throw new Error(`Failed to distribute yield: ${distributeResult.error}`);
    }

    revalidatePath(`/admin/loans/${loanApplicationId}`);

    return { isError: false, txHash: distributeResult.txHash };
  } catch (error) {
    return {
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Failed to distribute yield',
    };
  }
};

/**
 * Request revision with a note explaining what additional info is needed
 */
export const requestRevision = async (args: {
  accountAddress: string;
  loanApplicationId: string;
  revisionNote: string;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  try {
    const { accountAddress, loanApplicationId, revisionNote } = args;
    await validateApproverRequest(accountAddress);

    // Update status and add revision note
    await dbUpdateLoanApplication({
      loanApplicationId,
      loanApplication: {
        status: LoanApplicationStatus.ADDITIONAL_INFO_NEEDED,
        revisionNote,
      },
    });

    revalidatePath(`/admin/loans/${loanApplicationId}`);

    return {
      isError: false,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Error requesting revision',
    };
  }
};
