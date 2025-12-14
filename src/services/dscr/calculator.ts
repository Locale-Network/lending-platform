import prisma from '@prisma/index';
import { syncAndSubmitToCartesi } from '@/services/plaid/zkFetchWrapper';

export interface DSCRCalculationResult {
  submitted: number;
  failed: number;
  errors: Array<{
    loanId: string;
    error: string;
  }>;
}

/**
 * Trigger DSCR calculation for multiple loans
 *
 * This function:
 * 1. Fetches transactions for each loan (within rolling window)
 * 2. Prepares payload for Cartesi
 * 3. Submits to Cartesi InputBox for DSCR calculation
 * 4. Returns summary of submissions
 */
export async function triggerDSCRCalculation(
  loanIds: string[]
): Promise<DSCRCalculationResult> {
  const result: DSCRCalculationResult = {
    submitted: 0,
    failed: 0,
    errors: []
  };

  console.log(`[DSCR Calculator] Triggering calculations for ${loanIds.length} loans`);

  for (const loanId of loanIds) {
    try {
      await calculateAndSubmitDSCR(loanId);
      result.submitted++;
      console.log(`[DSCR Calculator] Successfully submitted loan ${loanId} to Cartesi`);
    } catch (error) {
      result.failed++;
      result.errors.push({
        loanId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error(`[DSCR Calculator] Failed to submit loan ${loanId}:`, error);
    }
  }

  return result;
}

/**
 * Calculate DSCR for a single loan and submit to Cartesi
 *
 * Uses the zkFetch wrapper to:
 * 1. Sync new transactions from Plaid (with zkFetch proof)
 * 2. Calculate DSCR based on all stored transactions
 * 3. Submit DSCR verification to Cartesi
 */
export async function calculateAndSubmitDSCR(loanId: string): Promise<void> {
  // Fetch loan details
  const loan = await prisma.loanApplication.findUnique({
    where: { id: loanId },
    select: {
      id: true,
      requestedAmount: true,
      transactionWindowMonths: true,
      plaidAccessToken: true,
      plaidTransactionsCursor: true,
      accountAddress: true
    }
  });

  if (!loan) {
    throw new Error(`Loan ${loanId} not found`);
  }

  if (!loan.plaidAccessToken) {
    throw new Error(`Loan ${loanId} has no Plaid access token`);
  }

  // Get loan amount for monthly debt service calculation
  const loanAmount = loan.requestedAmount ? Number(loan.requestedAmount) : 0;
  const termMonths = 24; // Default term

  // Calculate monthly debt service (at 10% APR)
  const annualRate = 0.10;
  const monthlyRate = annualRate / 12;
  const monthlyDebtService =
    loanAmount > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1)
      : 0;

  console.log(`[DSCR Calculator] Recalculating DSCR for loan ${loanId}: amount=$${loanAmount.toLocaleString()}, monthlyPayment=$${monthlyDebtService.toFixed(2)}`);

  // Use zkFetch wrapper to sync transactions and submit to Cartesi
  const result = await syncAndSubmitToCartesi({
    loanId: loan.id,
    accessToken: loan.plaidAccessToken,
    borrowerAddress: loan.accountAddress,
    cursor: loan.plaidTransactionsCursor || undefined,
    monthlyDebtService,
    loanAmount: loanAmount > 0 ? BigInt(loanAmount) : undefined
  });

  if (!result.success) {
    throw new Error(`DSCR submission failed: ${result.error}`);
  }

  console.log(`[DSCR Calculator] DSCR submitted for loan ${loanId}: ${result.transactionsAdded} new transactions, proofHash=${result.zkProofHash?.slice(0, 16)}...`);

  // Log submission
  await prisma.dSCRCalculationLog.create({
    data: {
      loanApplicationId: loanId,
      transactionCount: result.transactionsAdded,
      windowMonths: loan.transactionWindowMonths || 3,
      submittedAt: new Date(),
      status: 'SUBMITTED'
    }
  });
}

/**
 * Manual trigger for DSCR recalculation (for admin use)
 */
export async function manualDSCRRecalculation(loanId: string): Promise<void> {
  console.log(`[DSCR Calculator] Manual recalculation triggered for loan ${loanId}`);
  await calculateAndSubmitDSCR(loanId);
}
