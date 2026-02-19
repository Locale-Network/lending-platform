/**
 * Risk Services
 *
 * Portfolio-level risk assessment for lending pools.
 */

export {
  // Core calculation functions
  calculateCompositeRisk,
  // Alias for clarity - calculates AND stores composite risk for a pool
  calculateCompositeRisk as calculateAndStorePoolRisk,
  calculateWeightedDscr,
  calculateWeightedRate,
  calculateWeightedLendScore,
  calculateHHI,
  calculateDiversificationScore,

  // Score mapping functions
  dscrToScore,
  rateToScore,
  lendScoreToScore,
  mapToRiskTier,
  getRiskTierBadgeColor,
  getConcentrationLevel,

  // Batch & trigger functions
  recalculateAllPools,
  triggerPoolRiskRecalculation,
  getCachedCompositeMetrics,

  // Types
  type PoolLoanData,
  type CompositeRiskResult,
  type ComponentScore,
  type RiskTier,
  type ConcentrationLevel,
} from './compositeRiskService';
