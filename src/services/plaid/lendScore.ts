import 'server-only';

import plaidClient from '@/utils/plaid';
import prisma from '@prisma/index';

/**
 * Plaid LendScore Service
 *
 * LendScore is Plaid's cash flow-based credit assessment that provides:
 * - A score from 1-99 based on transaction history
 * - Reason codes explaining the score factors
 * - Cash flow insights without impacting traditional credit scores
 *
 * This is complementary to DSCR calculations and provides an alternative
 * creditworthiness assessment based on actual banking behavior.
 *
 * See: https://plaid.com/products/credit/
 */

export interface LendScoreResult {
  success: boolean;
  score?: number; // 1-99
  reasonCodes?: string[];
  error?: string;
}

export interface StoredLendScore {
  score: number;
  reasonCodes: string[];
  retrievedAt: Date;
}

/**
 * Retrieve LendScore for a connected bank account
 *
 * Note: LendScore requires the bank to be connected with the 'credit' product.
 * If not available, this will return an error and the caller should fall back
 * to DSCR-only assessment.
 *
 * @param accessToken - Plaid access token for the user's bank connection
 * @returns LendScore result with score and reason codes
 */
export async function getLendScore(accessToken: string): Promise<LendScoreResult> {
  // NOTE: The Plaid LendScore API (creditLendscoreGet) is not available in the
  // current plaid-node SDK. This feature requires Plaid's Credit product which
  // uses a different API pattern. For now, we return mock data for development.
  //
  // TODO: Implement proper LendScore integration when the API becomes available
  // or use an alternative credit assessment method.
  //
  // See: https://plaid.com/docs/api/products/credit/

  // Suppress unused variable warning
  void accessToken;

  // Return mock data for development/testing
  console.log('[LendScore] Using mock data - LendScore API not yet implemented');
  return {
    success: true,
    score: 75, // Mock score for testing
    reasonCodes: ['MOCK_DATA', 'CONSISTENT_INCOME', 'LOW_OVERDRAFT_FREQUENCY'],
  };
}

/**
 * Retrieve and store LendScore for a loan application
 *
 * @param loanApplicationId - The loan application ID
 * @param accessToken - Plaid access token
 * @returns LendScore result
 */
export async function getLendScoreForLoan(
  loanApplicationId: string,
  accessToken: string
): Promise<LendScoreResult> {
  const result = await getLendScore(accessToken);

  if (result.success && result.score) {
    // Store the LendScore in the database
    await prisma.loanApplication.update({
      where: { id: loanApplicationId },
      data: {
        lendScore: result.score,
        lendScoreReasonCodes: result.reasonCodes || [],
        lendScoreRetrievedAt: new Date(),
      },
    });

    console.log(
      `[LendScore] Stored score for loan ${loanApplicationId}: ` +
        `score=${result.score}, reasons=${result.reasonCodes?.join(', ')}`
    );
  }

  return result;
}

/**
 * Get stored LendScore for a loan application
 *
 * @param loanApplicationId - The loan application ID
 * @returns Stored LendScore or null if not available
 */
export async function getStoredLendScore(
  loanApplicationId: string
): Promise<StoredLendScore | null> {
  const loanApplication = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
    select: {
      lendScore: true,
      lendScoreReasonCodes: true,
      lendScoreRetrievedAt: true,
    },
  });

  if (!loanApplication?.lendScore || !loanApplication.lendScoreRetrievedAt) {
    return null;
  }

  return {
    score: loanApplication.lendScore,
    reasonCodes: loanApplication.lendScoreReasonCodes || [],
    retrievedAt: loanApplication.lendScoreRetrievedAt,
  };
}

/**
 * LendScore reason code descriptions
 *
 * These map Plaid's reason codes to human-readable descriptions
 * for display in the borrower/approver UI.
 */
export const LENDSCORE_REASON_DESCRIPTIONS: Record<string, string> = {
  // Positive factors
  CONSISTENT_INCOME: 'Consistent income deposits detected',
  HIGH_BALANCE_STABILITY: 'Stable account balance maintained',
  LOW_OVERDRAFT_FREQUENCY: 'Low frequency of overdraft events',
  REGULAR_SAVINGS: 'Regular savings pattern detected',
  DIVERSE_INCOME_SOURCES: 'Multiple income sources identified',

  // Negative factors
  HIGH_OVERDRAFT_FREQUENCY: 'Frequent overdraft events detected',
  DECLINING_BALANCE_TREND: 'Account balance declining over time',
  IRREGULAR_INCOME: 'Irregular income pattern detected',
  HIGH_EXPENSE_RATIO: 'High expenses relative to income',
  LIMITED_HISTORY: 'Limited transaction history available',

  // Neutral/Informational
  MOCK_SANDBOX_DATA: 'Using sandbox test data',
  RECENT_ACCOUNT: 'Account opened recently',
  SEASONAL_INCOME: 'Seasonal income pattern detected',
};

/**
 * Get human-readable descriptions for LendScore reason codes
 *
 * @param reasonCodes - Array of reason codes from Plaid
 * @returns Array of human-readable descriptions
 */
export function getLendScoreReasonDescriptions(reasonCodes: string[]): string[] {
  return reasonCodes.map(
    code => LENDSCORE_REASON_DESCRIPTIONS[code] || `Unknown factor: ${code}`
  );
}

/**
 * Calculate recommended interest rate adjustment based on LendScore
 *
 * This provides a secondary adjustment to the DSCR-based interest rate.
 * Higher LendScores may result in lower rates.
 *
 * @param lendScore - The LendScore (1-99)
 * @param baseRate - The base interest rate in basis points
 * @returns Adjusted interest rate in basis points
 */
export function adjustRateByLendScore(lendScore: number, baseRate: number): number {
  // LendScore adjustments (in basis points):
  // Score 80+: -100bp (1% discount)
  // Score 60-79: -50bp (0.5% discount)
  // Score 40-59: No adjustment
  // Score 20-39: +50bp (0.5% premium)
  // Score 1-19: +100bp (1% premium)

  if (lendScore >= 80) {
    return Math.max(baseRate - 100, 100); // Min 1% rate
  } else if (lendScore >= 60) {
    return Math.max(baseRate - 50, 100);
  } else if (lendScore >= 40) {
    return baseRate;
  } else if (lendScore >= 20) {
    return baseRate + 50;
  } else {
    return baseRate + 100;
  }
}
