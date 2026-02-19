/**
 * Composite Risk Service Tests
 *
 * Tests for portfolio-level risk calculations using industry-standard methodologies.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateWeightedDscr,
  calculateWeightedRate,
  calculateWeightedLendScore,
  calculateHHI,
  calculateDiversificationScore,
  dscrToScore,
  rateToScore,
  lendScoreToScore,
  mapToRiskTier,
  getRiskTierBadgeColor,
  getConcentrationLevel,
  type PoolLoanData,
} from './calculations';

// ============================================
// Test Data Fixtures
// ============================================

const createLoan = (overrides: Partial<PoolLoanData> = {}): PoolLoanData => ({
  loanId: 'loan-1',
  principal: 100000,
  dscr: 1.5,
  interestRate: 1000, // 10%
  lendScore: 70,
  industry: 'Technology',
  verifiedOnChain: true,
  ...overrides,
});

// ============================================
// calculateWeightedDscr Tests
// ============================================

describe('calculateWeightedDscr', () => {
  it('should calculate weighted DSCR correctly with unequal principals', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 100000, dscr: 2.0 }),  // 10% weight
      createLoan({ loanId: '2', principal: 900000, dscr: 1.5 }),  // 90% weight
    ];
    // Expected: (100K * 2.0 + 900K * 1.5) / 1M = (200K + 1.35M) / 1M = 1.55
    const result = calculateWeightedDscr(loans);
    expect(result).toBeCloseTo(1.55, 4);
  });

  it('should return exact DSCR for single loan', () => {
    const loans: PoolLoanData[] = [
      createLoan({ principal: 500000, dscr: 1.75 }),
    ];
    expect(calculateWeightedDscr(loans)).toBe(1.75);
  });

  it('should weight equally for equal principals', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 100000, dscr: 2.0 }),
      createLoan({ loanId: '2', principal: 100000, dscr: 1.0 }),
    ];
    // Expected: (2.0 + 1.0) / 2 = 1.5
    expect(calculateWeightedDscr(loans)).toBe(1.5);
  });

  it('should exclude loans with null DSCR', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 100000, dscr: 2.0 }),
      createLoan({ loanId: '2', principal: 100000, dscr: null }),
    ];
    // Only first loan counted
    expect(calculateWeightedDscr(loans)).toBe(2.0);
  });

  it('should exclude loans with zero DSCR', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 100000, dscr: 1.8 }),
      createLoan({ loanId: '2', principal: 100000, dscr: 0 }),
    ];
    expect(calculateWeightedDscr(loans)).toBe(1.8);
  });

  it('should return 0 for empty array', () => {
    expect(calculateWeightedDscr([])).toBe(0);
  });

  it('should return 0 when all loans have null DSCR', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', dscr: null }),
      createLoan({ loanId: '2', dscr: null }),
    ];
    expect(calculateWeightedDscr(loans)).toBe(0);
  });

  it('should handle large loan counts accurately', () => {
    // 10 equal loans with DSCR values from 1.0 to 1.9
    const loans: PoolLoanData[] = Array.from({ length: 10 }, (_, i) =>
      createLoan({ loanId: `loan-${i}`, principal: 100000, dscr: 1.0 + i * 0.1 })
    );
    // Average of 1.0, 1.1, 1.2, ..., 1.9 = 1.45
    expect(calculateWeightedDscr(loans)).toBeCloseTo(1.45, 4);
  });
});

// ============================================
// calculateWeightedRate Tests
// ============================================

describe('calculateWeightedRate', () => {
  it('should calculate weighted rate correctly', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 200000, interestRate: 900 }),  // 9%
      createLoan({ loanId: '2', principal: 800000, interestRate: 1200 }), // 12%
    ];
    // Expected: (200K * 900 + 800K * 1200) / 1M = (180M + 960M) / 1M = 1140bp
    expect(calculateWeightedRate(loans)).toBeCloseTo(1140, 0);
  });

  it('should return 0 for empty array', () => {
    expect(calculateWeightedRate([])).toBe(0);
  });
});

// ============================================
// calculateWeightedLendScore Tests
// ============================================

describe('calculateWeightedLendScore', () => {
  it('should calculate weighted LendScore correctly', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 300000, lendScore: 80 }),
      createLoan({ loanId: '2', principal: 700000, lendScore: 60 }),
    ];
    // Expected: (300K * 80 + 700K * 60) / 1M = (24M + 42M) / 1M = 66
    expect(calculateWeightedLendScore(loans)).toBeCloseTo(66, 0);
  });

  it('should return null when all loans have null LendScore', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', lendScore: null }),
      createLoan({ loanId: '2', lendScore: null }),
    ];
    expect(calculateWeightedLendScore(loans)).toBeNull();
  });

  it('should exclude loans with null LendScore from calculation', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 100000, lendScore: 80 }),
      createLoan({ loanId: '2', principal: 100000, lendScore: null }),
    ];
    expect(calculateWeightedLendScore(loans)).toBe(80);
  });
});

// ============================================
// calculateHHI Tests (Herfindahl-Hirschman Index)
// ============================================

describe('calculateHHI', () => {
  it('should return 1.0 for single loan (maximum concentration)', () => {
    const loans: PoolLoanData[] = [
      createLoan({ principal: 500000 }),
    ];
    expect(calculateHHI(loans)).toBe(1);
  });

  it('should return ~0.5 for two equal loans', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 100000 }),
      createLoan({ loanId: '2', principal: 100000 }),
    ];
    // HHI = 0.5^2 + 0.5^2 = 0.25 + 0.25 = 0.5
    expect(calculateHHI(loans)).toBe(0.5);
  });

  it('should return ~0.1 for 10 equal loans', () => {
    const loans: PoolLoanData[] = Array.from({ length: 10 }, (_, i) =>
      createLoan({ loanId: `loan-${i}`, principal: 100000 })
    );
    // HHI = 10 * (0.1^2) = 10 * 0.01 = 0.1
    expect(calculateHHI(loans)).toBeCloseTo(0.1, 4);
  });

  it('should return ~0.04 for 25 equal loans', () => {
    const loans: PoolLoanData[] = Array.from({ length: 25 }, (_, i) =>
      createLoan({ loanId: `loan-${i}`, principal: 100000 })
    );
    // HHI = 25 * (0.04^2) = 25 * 0.0016 = 0.04
    expect(calculateHHI(loans)).toBeCloseTo(0.04, 4);
  });

  it('should handle unequal distribution', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 900000 }), // 90% share
      createLoan({ loanId: '2', principal: 100000 }), // 10% share
    ];
    // HHI = 0.9^2 + 0.1^2 = 0.81 + 0.01 = 0.82
    expect(calculateHHI(loans)).toBeCloseTo(0.82, 2);
  });

  it('should return 1 for empty array', () => {
    expect(calculateHHI([])).toBe(1);
  });

  it('should return 1 when total principal is 0', () => {
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 0 }),
      createLoan({ loanId: '2', principal: 0 }),
    ];
    expect(calculateHHI(loans)).toBe(1);
  });
});

// ============================================
// calculateDiversificationScore Tests
// ============================================

describe('calculateDiversificationScore', () => {
  it('should return 0 for HHI = 1 (no diversification)', () => {
    expect(calculateDiversificationScore(1)).toBe(0);
  });

  it('should return 50 for HHI = 0.5', () => {
    expect(calculateDiversificationScore(0.5)).toBe(50);
  });

  it('should return 90 for HHI = 0.1', () => {
    expect(calculateDiversificationScore(0.1)).toBe(90);
  });

  it('should return 100 for HHI = 0 (perfect diversification)', () => {
    expect(calculateDiversificationScore(0)).toBe(100);
  });
});

// ============================================
// Score Mapping Tests
// ============================================

describe('dscrToScore', () => {
  it('should return 0 for DSCR <= 0.5', () => {
    expect(dscrToScore(0.5)).toBe(0);
    expect(dscrToScore(0.3)).toBe(0);
    expect(dscrToScore(0)).toBe(0);
  });

  it('should return 100 for DSCR >= 2.0', () => {
    expect(dscrToScore(2.0)).toBe(100);
    expect(dscrToScore(2.5)).toBe(100);
    expect(dscrToScore(3.0)).toBe(100);
  });

  it('should return ~33 for DSCR = 1.0', () => {
    // (1.0 - 0.5) * 66.67 = 0.5 * 66.67 = 33.335
    expect(dscrToScore(1.0)).toBeCloseTo(33.33, 0);
  });

  it('should return ~67 for DSCR = 1.5', () => {
    // (1.5 - 0.5) * 66.67 = 1.0 * 66.67 = 66.67
    expect(dscrToScore(1.5)).toBeCloseTo(66.67, 0);
  });

  it('should interpolate linearly between thresholds', () => {
    const score1 = dscrToScore(1.25);
    const score2 = dscrToScore(1.75);
    expect(score1).toBeLessThan(score2);
    expect(score1).toBeGreaterThan(33);
    expect(score2).toBeLessThan(100);
  });
});

describe('rateToScore', () => {
  it('should return 100 for rate <= 9% (900bp)', () => {
    expect(rateToScore(900)).toBe(100);
    expect(rateToScore(800)).toBe(100);
  });

  it('should return 0 for rate >= 15% (1500bp)', () => {
    expect(rateToScore(1500)).toBe(0);
    expect(rateToScore(1800)).toBe(0);
  });

  it('should return ~50 for rate = 12% (1200bp)', () => {
    // 100 - ((12 - 9) * 16.67) = 100 - 50 = 50
    expect(rateToScore(1200)).toBeCloseTo(50, 0);
  });

  it('should interpolate inversely (lower rate = higher score)', () => {
    const lowRateScore = rateToScore(1000);  // 10%
    const highRateScore = rateToScore(1400); // 14%
    expect(lowRateScore).toBeGreaterThan(highRateScore);
  });
});

describe('lendScoreToScore', () => {
  it('should return score directly for valid LendScore', () => {
    expect(lendScoreToScore(80)).toBe(80);
    expect(lendScoreToScore(50)).toBe(50);
  });

  it('should return 50 (neutral) for null LendScore', () => {
    expect(lendScoreToScore(null)).toBe(50);
  });

  it('should cap at 99', () => {
    expect(lendScoreToScore(150)).toBe(99);
  });

  it('should floor at 0', () => {
    expect(lendScoreToScore(-10)).toBe(0);
  });
});

// ============================================
// Risk Tier Mapping Tests
// ============================================

describe('mapToRiskTier', () => {
  it('should map 85 to Low Risk', () => {
    expect(mapToRiskTier(85)).toBe('Low Risk');
  });

  it('should map 80 to Low Risk (boundary)', () => {
    expect(mapToRiskTier(80)).toBe('Low Risk');
  });

  it('should map 79 to Moderate Risk (boundary)', () => {
    expect(mapToRiskTier(79)).toBe('Moderate Risk');
  });

  it('should map 65 to Moderate Risk', () => {
    expect(mapToRiskTier(65)).toBe('Moderate Risk');
  });

  it('should map 60 to Moderate Risk (boundary)', () => {
    expect(mapToRiskTier(60)).toBe('Moderate Risk');
  });

  it('should map 45 to Medium Risk', () => {
    expect(mapToRiskTier(45)).toBe('Medium Risk');
  });

  it('should map 30 to High Risk', () => {
    expect(mapToRiskTier(30)).toBe('High Risk');
  });

  it('should map 10 to Very High Risk', () => {
    expect(mapToRiskTier(10)).toBe('Very High Risk');
  });

  it('should map 0 to Very High Risk', () => {
    expect(mapToRiskTier(0)).toBe('Very High Risk');
  });

  it('should map 100 to Low Risk', () => {
    expect(mapToRiskTier(100)).toBe('Low Risk');
  });
});

describe('getRiskTierBadgeColor', () => {
  it('should return green for Low Risk', () => {
    expect(getRiskTierBadgeColor('Low Risk')).toBe('green');
  });

  it('should return blue for Moderate Risk', () => {
    expect(getRiskTierBadgeColor('Moderate Risk')).toBe('blue');
  });

  it('should return yellow for Medium Risk', () => {
    expect(getRiskTierBadgeColor('Medium Risk')).toBe('yellow');
  });

  it('should return orange for High Risk', () => {
    expect(getRiskTierBadgeColor('High Risk')).toBe('orange');
  });

  it('should return red for Very High Risk', () => {
    expect(getRiskTierBadgeColor('Very High Risk')).toBe('red');
  });
});

// ============================================
// Concentration Level Tests
// ============================================

describe('getConcentrationLevel', () => {
  it('should return Well Diversified for HHI < 0.15', () => {
    expect(getConcentrationLevel(0.1)).toBe('Well Diversified');
    expect(getConcentrationLevel(0.05)).toBe('Well Diversified');
  });

  it('should return Moderately Concentrated for 0.15 <= HHI < 0.25', () => {
    expect(getConcentrationLevel(0.15)).toBe('Moderately Concentrated');
    expect(getConcentrationLevel(0.2)).toBe('Moderately Concentrated');
    expect(getConcentrationLevel(0.24)).toBe('Moderately Concentrated');
  });

  it('should return Highly Concentrated for HHI >= 0.25', () => {
    expect(getConcentrationLevel(0.25)).toBe('Highly Concentrated');
    expect(getConcentrationLevel(0.5)).toBe('Highly Concentrated');
    expect(getConcentrationLevel(1.0)).toBe('Highly Concentrated');
  });
});

// ============================================
// Integration-Style Tests
// ============================================

describe('Full Portfolio Calculation', () => {
  it('should calculate correct composite for a diversified portfolio', () => {
    // 5 equal loans with varying metrics
    const loans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 200000, dscr: 2.0, interestRate: 900, lendScore: 85 }),
      createLoan({ loanId: '2', principal: 200000, dscr: 1.8, interestRate: 950, lendScore: 80 }),
      createLoan({ loanId: '3', principal: 200000, dscr: 1.5, interestRate: 1050, lendScore: 70 }),
      createLoan({ loanId: '4', principal: 200000, dscr: 1.3, interestRate: 1150, lendScore: 65 }),
      createLoan({ loanId: '5', principal: 200000, dscr: 1.2, interestRate: 1200, lendScore: 60 }),
    ];

    const weightedDscr = calculateWeightedDscr(loans);
    const weightedRate = calculateWeightedRate(loans);
    const weightedLendScore = calculateWeightedLendScore(loans);
    const hhi = calculateHHI(loans);

    // All equal weights so simple average
    expect(weightedDscr).toBeCloseTo(1.56, 1);       // (2.0+1.8+1.5+1.3+1.2)/5
    expect(weightedRate).toBeCloseTo(1050, 0);       // (900+950+1050+1150+1200)/5
    expect(weightedLendScore).toBeCloseTo(72, 0);    // (85+80+70+65+60)/5
    expect(hhi).toBeCloseTo(0.2, 2);                 // 5 * 0.2^2 = 0.2

    // Verify diversification is good
    expect(getConcentrationLevel(hhi)).toBe('Moderately Concentrated');
  });

  it('should penalize concentrated portfolios', () => {
    // One dominant loan
    const concentratedLoans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 900000, dscr: 2.0, interestRate: 900, lendScore: 90 }),
      createLoan({ loanId: '2', principal: 100000, dscr: 2.0, interestRate: 900, lendScore: 90 }),
    ];

    // Equal loans
    const diversifiedLoans: PoolLoanData[] = [
      createLoan({ loanId: '1', principal: 500000, dscr: 2.0, interestRate: 900, lendScore: 90 }),
      createLoan({ loanId: '2', principal: 500000, dscr: 2.0, interestRate: 900, lendScore: 90 }),
    ];

    const concentratedHHI = calculateHHI(concentratedLoans);
    const diversifiedHHI = calculateHHI(diversifiedLoans);

    // Concentrated has higher HHI (worse)
    expect(concentratedHHI).toBeGreaterThan(diversifiedHHI);
    expect(concentratedHHI).toBeCloseTo(0.82, 1);
    expect(diversifiedHHI).toBe(0.5);

    // Diversification score is lower for concentrated
    const concentratedDiv = calculateDiversificationScore(concentratedHHI);
    const diversifiedDiv = calculateDiversificationScore(diversifiedHHI);
    expect(concentratedDiv).toBeLessThan(diversifiedDiv);
  });
});
