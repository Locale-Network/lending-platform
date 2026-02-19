/**
 * Interest Rate Utilities
 *
 * Centralizes interest rate conversions and calculations.
 *
 * IMPORTANT: Rate format consistency across layers:
 * - Smart Contract: Basis points (1000 = 10%)
 * - Cartesi: Percentages (10.0 = 10%)
 * - Frontend Display: Divides basis points by 100 to show percentage
 *
 * Use these utilities to ensure consistent conversion.
 */

/**
 * Convert percentage to basis points
 * @param percent - Interest rate as percentage (e.g., 10.0 for 10%)
 * @returns Interest rate in basis points (e.g., 1000 for 10%)
 */
export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

/**
 * Convert basis points to percentage
 * @param basisPoints - Interest rate in basis points (e.g., 1000 for 10%)
 * @returns Interest rate as percentage (e.g., 10.0 for 10%)
 */
export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / 100;
}

/**
 * Calculate interest rate based on DSCR (Debt Service Coverage Ratio)
 *
 * Risk-based pricing:
 * - DSCR >= 2.0: 9% (low risk)
 * - DSCR >= 1.5: 10.5%
 * - DSCR >= 1.25: 12%
 * - DSCR >= 1.0: 13.5%
 * - DSCR < 1.0: 15% (high risk)
 *
 * @param dscr - Debt Service Coverage Ratio
 * @returns Interest rate in basis points
 */
export function calculateInterestRateFromDSCR(dscr: number): number {
  if (dscr >= 2.0) return 900;      // 9%
  if (dscr >= 1.5) return 1050;     // 10.5%
  if (dscr >= 1.25) return 1200;    // 12%
  if (dscr >= 1.0) return 1350;     // 13.5%
  return 1500;                       // 15%
}

/**
 * Calculate interest rate from DSCR and return as percentage
 *
 * @param dscr - Debt Service Coverage Ratio
 * @returns Interest rate as percentage
 */
export function calculateInterestRatePercentFromDSCR(dscr: number): number {
  return basisPointsToPercent(calculateInterestRateFromDSCR(dscr));
}

/**
 * Get risk tier label based on DSCR
 *
 * @param dscr - Debt Service Coverage Ratio
 * @returns Risk tier label
 */
export function getDSCRRiskTier(dscr: number): string {
  if (dscr >= 2.0) return 'Low Risk';
  if (dscr >= 1.5) return 'Moderate Risk';
  if (dscr >= 1.25) return 'Medium Risk';
  if (dscr >= 1.0) return 'High Risk';
  return 'Very High Risk';
}

/**
 * Default interest rate in basis points when DSCR is not available
 */
export const DEFAULT_INTEREST_RATE_BP = 1000; // 10%

/**
 * Default interest rate as percentage when DSCR is not available
 */
export const DEFAULT_INTEREST_RATE_PERCENT = 10.0;

/**
 * Calculate DSCR and derived interest rate from stored transaction data.
 * Used by disbursement and page rendering when DSCRCalculationLog.calculatedRate is null.
 *
 * @param transactions - Array of { amount: number | null, date: Date | null }
 * @param loanAmount - Loan amount in token units (e.g. 5000 for $5000)
 * @param termMonths - Loan term in months
 * @returns { dscrValue, interestRate } where interestRate is in basis points
 */
export function calculateDscrRateFromTransactions(
  transactions: Array<{ amount: number | null; date: Date | null }>,
  loanAmount: number,
  termMonths: number,
): { dscrValue: number; interestRate: number } {
  if (transactions.length === 0 || loanAmount <= 0) {
    return { dscrValue: 0, interestRate: DEFAULT_INTEREST_RATE_BP };
  }

  // Plaid sign convention: negative = income, positive = expenses
  const totalIncome = transactions
    .filter(tx => (tx.amount || 0) < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const totalExpenses = transactions
    .filter(tx => (tx.amount || 0) > 0)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Calculate months spanned by transactions
  const dates = transactions.map(tx => tx.date).filter(Boolean) as Date[];
  const monthCount = dates.length > 0
    ? Math.max(1, Math.ceil(
        (Math.max(...dates.map(d => d.getTime())) - Math.min(...dates.map(d => d.getTime())))
        / (30 * 24 * 60 * 60 * 1000)
      ))
    : 1;

  const monthlyNoi = (totalIncome - totalExpenses) / monthCount;

  // Standard amortization monthly payment
  const annualRate = DEFAULT_INTEREST_RATE_PERCENT / 100;
  const monthlyRate = annualRate / 12;
  const monthlyDebtService = loanAmount > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths))
      / (Math.pow(1 + monthlyRate, termMonths) - 1)
    : 0;

  const dscrValue = monthlyDebtService > 0 ? monthlyNoi / monthlyDebtService : 0;
  const interestRate = calculateInterestRateFromDSCR(dscrValue);

  return { dscrValue, interestRate };
}
