// Token decimals
export const USDC_DECIMALS = 6;
export const SHARE_DECIMALS = 18;

/** 1 USDC in smallest unit (10^6) */
export const USDC_UNIT = BigInt(10 ** USDC_DECIMALS);

// Investor tier thresholds (USD value)
export const INVESTOR_TIERS = {
  PLATINUM: 500_000,
  GOLD: 100_000,
  SILVER: 25_000,
} as const;

export function getInvestorTier(totalInvested: number): string {
  if (totalInvested >= INVESTOR_TIERS.PLATINUM) return 'platinum';
  if (totalInvested >= INVESTOR_TIERS.GOLD) return 'gold';
  if (totalInvested >= INVESTOR_TIERS.SILVER) return 'silver';
  return 'bronze';
}

// DSCR (Debt Service Coverage Ratio)
/** DSCR is stored scaled by 1000 (e.g., 1250 = 1.25) */
export const DSCR_SCALE_FACTOR = 1000;
/** Minimum DSCR threshold (1.25 = 1250 scaled) */
export const DSCR_THRESHOLD = 1250;

/** Convert on-chain scaled DSCR to human-readable float */
export function scaledDscrToFloat(raw: number): number {
  return raw / DSCR_SCALE_FACTOR;
}

// Loan defaults
export const DEFAULT_LOAN_TERM_MONTHS = 24;
export const DEFAULT_COOLDOWN_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Block lookback for Arbitrum event queries (~14 days at ~0.25s/block)
export const DEFAULT_BLOCK_LOOKBACK = 5_000_000;

// Pagination
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
