/**
 * Composite Risk Calculations
 *
 * Pure calculation functions for portfolio-level risk assessment.
 * These functions have no database dependencies and can be easily tested.
 *
 * Research Sources:
 * - Federal Reserve Supervisory Stress Test Models
 * - DBRS North American CMBS Rating Methodology
 * - BlackRock Solutions CMBS Methodology
 *
 * SECURITY: Uses Decimal.js for precise financial calculations to avoid
 * floating point precision issues that could cause incorrect risk scores.
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ============================================
// Types & Interfaces
// ============================================

export interface PoolLoanData {
  loanId: string;
  principal: number;
  dscr: number | null;
  interestRate: number; // basis points
  lendScore: number | null;
  industry: string;
  verifiedOnChain: boolean;
}

export interface ComponentScore {
  weight: number;
  rawValue: number | null;
  score: number;
  contribution: number;
}

export interface CompositeRiskResult {
  compositeScore: number;
  riskTier: RiskTier;
  riskTierBadgeColor: string;
  weightedDscr: number;
  weightedRate: number;
  weightedRateFormatted: string;
  weightedLendScore: number | null;
  diversificationScore: number;
  hhiIndex: number;
  borrowerConcentration: ConcentrationLevel;
  componentScores: {
    dscr: ComponentScore;
    lendScore: ComponentScore;
    diversification: ComponentScore;
    rate: ComponentScore;
  };
  loanCount: number;
  calculatedAt: Date;
}

export type RiskTier =
  | 'Low Risk'
  | 'Moderate Risk'
  | 'Medium Risk'
  | 'High Risk'
  | 'Very High Risk';

export type ConcentrationLevel =
  | 'Well Diversified'
  | 'Moderately Concentrated'
  | 'Highly Concentrated';

// ============================================
// Constants - Component Weights
// ============================================

// NOTE: LendScore is currently unavailable (Plaid Credit API integration pending)
// Weights have been redistributed: DSCR 50%, Diversification 30%, Rate 20%
export const WEIGHTS = {
  DSCR: 0.5,          // 50% - Primary cash flow indicator (increased from 40%)
  LEND_SCORE: 0,      // 0% - Disabled until Plaid Credit API is available
  DIVERSIFICATION: 0.3, // 30% - Concentration risk (increased from 20%)
  RATE: 0.2,          // 20% - Risk-adjusted pricing signal (increased from 15%)
} as const;

// Risk tier thresholds
export const RISK_TIERS: { min: number; tier: RiskTier; color: string }[] = [
  { min: 80, tier: 'Low Risk', color: 'green' },
  { min: 60, tier: 'Moderate Risk', color: 'blue' },
  { min: 40, tier: 'Medium Risk', color: 'yellow' },
  { min: 20, tier: 'High Risk', color: 'orange' },
  { min: 0, tier: 'Very High Risk', color: 'red' },
];

// HHI concentration thresholds (DOJ/FTC standards adapted)
export const HHI_THRESHOLDS = {
  WELL_DIVERSIFIED: 0.15,      // HHI < 0.15 = well diversified
  MODERATELY_CONCENTRATED: 0.25, // 0.15 <= HHI < 0.25 = moderate
  // HHI >= 0.25 = highly concentrated
};

// ============================================
// Core Calculation Functions
// ============================================

/**
 * Calculate principal-weighted average DSCR
 * Standard CMBS methodology: Σ(DSCR_i × Principal_i) / Σ(Principal_i)
 * Uses Decimal.js for precise financial calculations
 */
export function calculateWeightedDscr(loans: PoolLoanData[]): number {
  const loansWithDscr = loans.filter(l => l.dscr !== null && l.dscr > 0);

  if (loansWithDscr.length === 0) {
    return 0;
  }

  const weightedSum = loansWithDscr.reduce(
    (sum, loan) => sum.plus(new Decimal(loan.dscr!).times(loan.principal)),
    new Decimal(0)
  );
  const totalPrincipal = loansWithDscr.reduce(
    (sum, loan) => sum.plus(loan.principal),
    new Decimal(0)
  );

  return totalPrincipal.gt(0)
    ? weightedSum.dividedBy(totalPrincipal).toNumber()
    : 0;
}

/**
 * Calculate principal-weighted average interest rate
 * Uses Decimal.js for precise financial calculations
 */
export function calculateWeightedRate(loans: PoolLoanData[]): number {
  const loansWithRate = loans.filter(l => l.interestRate > 0);

  if (loansWithRate.length === 0) {
    return 0;
  }

  const weightedSum = loansWithRate.reduce(
    (sum, loan) => sum.plus(new Decimal(loan.interestRate).times(loan.principal)),
    new Decimal(0)
  );
  const totalPrincipal = loansWithRate.reduce(
    (sum, loan) => sum.plus(loan.principal),
    new Decimal(0)
  );

  return totalPrincipal.gt(0)
    ? weightedSum.dividedBy(totalPrincipal).toNumber()
    : 0;
}

/**
 * Calculate principal-weighted average LendScore
 * Uses Decimal.js for precise financial calculations
 */
export function calculateWeightedLendScore(loans: PoolLoanData[]): number | null {
  const loansWithScore = loans.filter(l => l.lendScore !== null && l.lendScore > 0);

  if (loansWithScore.length === 0) {
    return null;
  }

  const weightedSum = loansWithScore.reduce(
    (sum, loan) => sum.plus(new Decimal(loan.lendScore!).times(loan.principal)),
    new Decimal(0)
  );
  const totalPrincipal = loansWithScore.reduce(
    (sum, loan) => sum.plus(loan.principal),
    new Decimal(0)
  );

  return totalPrincipal.gt(0)
    ? weightedSum.dividedBy(totalPrincipal).toNumber()
    : null;
}

/**
 * Calculate Herfindahl-Hirschman Index (HHI)
 * Measures market concentration: Σ(share_i²) where share_i = Principal_i / Total
 * Range: 1/n (perfect distribution) to 1 (single entity)
 * Uses Decimal.js for precise financial calculations
 */
export function calculateHHI(loans: PoolLoanData[]): number {
  if (loans.length === 0) {
    return 1; // Maximum concentration (no diversification)
  }

  if (loans.length === 1) {
    return 1; // Single loan = maximum concentration
  }

  const totalPrincipal = loans.reduce(
    (sum, loan) => sum.plus(loan.principal),
    new Decimal(0)
  );

  if (totalPrincipal.eq(0)) {
    return 1;
  }

  const hhi = loans.reduce((sum, loan) => {
    const share = new Decimal(loan.principal).dividedBy(totalPrincipal);
    return sum.plus(share.times(share));
  }, new Decimal(0));

  return hhi.toNumber();
}

/**
 * Convert HHI to diversification score (0-100)
 * Higher score = better diversified
 * Uses Decimal.js for precise financial calculations
 */
export function calculateDiversificationScore(hhi: number): number {
  return new Decimal(1).minus(hhi).times(100).toNumber();
}

/**
 * Get concentration level label based on HHI
 */
export function getConcentrationLevel(hhi: number): ConcentrationLevel {
  if (hhi < HHI_THRESHOLDS.WELL_DIVERSIFIED) {
    return 'Well Diversified';
  }
  if (hhi < HHI_THRESHOLDS.MODERATELY_CONCENTRATED) {
    return 'Moderately Concentrated';
  }
  return 'Highly Concentrated';
}

// ============================================
// Sub-Score Mapping Functions
// ============================================

/**
 * Convert weighted DSCR to 0-100 score
 * Mapping: 0.5 -> 0, 1.0 -> 33, 1.5 -> 67, 2.0+ -> 100
 * Uses Decimal.js for precise financial calculations
 */
export function dscrToScore(dscr: number): number {
  if (dscr <= 0.5) return 0;
  if (dscr >= 2.0) return 100;

  // Linear interpolation: (dscr - 0.5) * (200/3) for exact 66.666...
  const score = new Decimal(dscr).minus('0.5').times(new Decimal(200).dividedBy(3));
  return Math.min(100, Math.max(0, score.toNumber()));
}

/**
 * Convert weighted interest rate (basis points) to 0-100 score
 * Lower rates = higher score (better risk profile)
 * Mapping: 9% (900bp) -> 100, 12% (1200bp) -> 50, 15% (1500bp) -> 0
 * Uses Decimal.js for precise financial calculations
 */
export function rateToScore(rateBasisPoints: number): number {
  const ratePercent = new Decimal(rateBasisPoints).dividedBy(100);

  if (ratePercent.lte(9)) return 100;
  if (ratePercent.gte(15)) return 0;

  // Linear interpolation: 100 - ((rate - 9) * (100/6)) for exact mapping
  const score = new Decimal(100).minus(
    ratePercent.minus(9).times(new Decimal(100).dividedBy(6))
  );
  return Math.min(100, Math.max(0, score.toNumber()));
}

/**
 * Convert LendScore to component score
 * LendScore is already 1-99, we just use it directly
 */
export function lendScoreToScore(lendScore: number | null): number {
  if (lendScore === null) return 50; // Neutral default
  return Math.min(99, Math.max(0, lendScore));
}

// ============================================
// Risk Tier Mapping
// ============================================

/**
 * Map composite score (0-100) to risk tier
 */
export function mapToRiskTier(score: number): RiskTier {
  for (const tier of RISK_TIERS) {
    if (score >= tier.min) {
      return tier.tier;
    }
  }
  return 'Very High Risk';
}

/**
 * Get badge color for risk tier
 */
export function getRiskTierBadgeColor(tier: RiskTier): string {
  const found = RISK_TIERS.find(t => t.tier === tier);
  return found?.color || 'red';
}

// ============================================
// Composite Score Calculation
// ============================================

/**
 * Calculate the full composite risk score from pool loan data
 */
export function calculateCompositeScore(loans: PoolLoanData[]): {
  compositeScore: number;
  riskTier: RiskTier;
  riskTierBadgeColor: string;
  weightedDscr: number;
  weightedRate: number;
  weightedLendScore: number | null;
  diversificationScore: number;
  hhiIndex: number;
  borrowerConcentration: ConcentrationLevel;
  componentScores: {
    dscr: ComponentScore;
    lendScore: ComponentScore;
    diversification: ComponentScore;
    rate: ComponentScore;
  };
} {
  // Calculate weighted averages
  const weightedDscr = calculateWeightedDscr(loans);
  const weightedRate = calculateWeightedRate(loans);
  const weightedLendScore = calculateWeightedLendScore(loans);
  const hhiIndex = calculateHHI(loans);
  const diversificationScore = calculateDiversificationScore(hhiIndex);

  // Calculate component scores
  const dscrScore = dscrToScore(weightedDscr);
  const rateScore = rateToScore(weightedRate);
  // LendScore is disabled until Plaid Credit API is available
  const lendScoreScore = 0;

  // Calculate composite score (LendScore excluded - weight is 0)
  // Uses Decimal.js for precise weighted sum calculation
  const compositeScore = new Decimal(dscrScore).times(WEIGHTS.DSCR)
    .plus(new Decimal(diversificationScore).times(WEIGHTS.DIVERSIFICATION))
    .plus(new Decimal(rateScore).times(WEIGHTS.RATE))
    .toNumber();

  const riskTier = mapToRiskTier(compositeScore);

  return {
    compositeScore: Math.round(compositeScore * 100) / 100,
    riskTier,
    riskTierBadgeColor: getRiskTierBadgeColor(riskTier),
    weightedDscr: Math.round(weightedDscr * 10000) / 10000,
    weightedRate: Math.round(weightedRate),
    weightedLendScore: weightedLendScore
      ? Math.round(weightedLendScore)
      : null,
    diversificationScore: Math.round(diversificationScore * 100) / 100,
    hhiIndex: Math.round(hhiIndex * 10000) / 10000,
    borrowerConcentration: getConcentrationLevel(hhiIndex),
    componentScores: {
      dscr: {
        weight: WEIGHTS.DSCR,
        rawValue: weightedDscr,
        score: Math.round(dscrScore * 100) / 100,
        contribution: Math.round(dscrScore * WEIGHTS.DSCR * 100) / 100,
      },
      lendScore: {
        weight: WEIGHTS.LEND_SCORE,
        rawValue: weightedLendScore,
        score: Math.round(lendScoreScore * 100) / 100,
        contribution: Math.round(lendScoreScore * WEIGHTS.LEND_SCORE * 100) / 100,
      },
      diversification: {
        weight: WEIGHTS.DIVERSIFICATION,
        rawValue: hhiIndex,
        score: Math.round(diversificationScore * 100) / 100,
        contribution: Math.round(diversificationScore * WEIGHTS.DIVERSIFICATION * 100) / 100,
      },
      rate: {
        weight: WEIGHTS.RATE,
        rawValue: weightedRate,
        score: Math.round(rateScore * 100) / 100,
        contribution: Math.round(rateScore * WEIGHTS.RATE * 100) / 100,
      },
    },
  };
}
