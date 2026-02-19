import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    loanApplication: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('server-only', () => ({}));

vi.mock('@prisma/index', () => ({
  default: mockPrisma,
}));

vi.mock('@/utils/plaid', () => ({
  default: {},
}));

// Import after mocks
import {
  getLendScore,
  getLendScoreForLoan,
  getStoredLendScore,
  getLendScoreReasonDescriptions,
  adjustRateByLendScore,
  LENDSCORE_REASON_DESCRIPTIONS,
} from './lendScore';

describe('lendScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getLendScore', () => {
    it('should return unavailable status (LendScore not implemented)', async () => {
      const result = await getLendScore('test-access-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('LendScore not available');
      expect(result.score).toBeUndefined();
    });
  });

  describe('getLendScoreForLoan', () => {
    it('should return unavailable status without updating database', async () => {
      const result = await getLendScoreForLoan('loan-123', 'access-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('LendScore not available');

      // Should NOT call database update since LendScore is unavailable
      expect(mockPrisma.loanApplication.update).not.toHaveBeenCalled();
    });
  });

  describe('getStoredLendScore', () => {
    it('should return stored LendScore from database', async () => {
      const retrievedAt = new Date('2024-12-01');
      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce({
        lendScore: 82,
        lendScoreReasonCodes: ['CONSISTENT_INCOME', 'LOW_OVERDRAFT_FREQUENCY'],
        lendScoreRetrievedAt: retrievedAt,
      });

      const result = await getStoredLendScore('loan-123');

      expect(result).not.toBeNull();
      expect(result?.score).toBe(82);
      expect(result?.reasonCodes).toHaveLength(2);
      expect(result?.retrievedAt).toEqual(retrievedAt);
    });

    it('should return null when no LendScore stored', async () => {
      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce({
        lendScore: null,
        lendScoreReasonCodes: [],
        lendScoreRetrievedAt: null,
      });

      const result = await getStoredLendScore('loan-123');

      expect(result).toBeNull();
    });

    it('should return null when loan not found', async () => {
      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce(null);

      const result = await getStoredLendScore('non-existent');

      expect(result).toBeNull();
    });

    it('should return null when lendScoreRetrievedAt is missing', async () => {
      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce({
        lendScore: 75,
        lendScoreReasonCodes: ['TEST'],
        lendScoreRetrievedAt: null,
      });

      const result = await getStoredLendScore('loan-123');

      expect(result).toBeNull();
    });
  });

  describe('getLendScoreReasonDescriptions', () => {
    it('should return human-readable descriptions for known codes', () => {
      const codes = ['CONSISTENT_INCOME', 'LOW_OVERDRAFT_FREQUENCY'];

      const descriptions = getLendScoreReasonDescriptions(codes);

      expect(descriptions).toHaveLength(2);
      expect(descriptions[0]).toBe('Consistent income deposits detected');
      expect(descriptions[1]).toBe('Low frequency of overdraft events');
    });

    it('should handle unknown reason codes', () => {
      const codes = ['UNKNOWN_CODE'];

      const descriptions = getLendScoreReasonDescriptions(codes);

      expect(descriptions[0]).toBe('Unknown factor: UNKNOWN_CODE');
    });

    it('should handle mixed known and unknown codes', () => {
      const codes = ['HIGH_BALANCE_STABILITY', 'CUSTOM_FACTOR'];

      const descriptions = getLendScoreReasonDescriptions(codes);

      expect(descriptions[0]).toBe('Stable account balance maintained');
      expect(descriptions[1]).toBe('Unknown factor: CUSTOM_FACTOR');
    });

    it('should handle empty array', () => {
      const descriptions = getLendScoreReasonDescriptions([]);

      expect(descriptions).toEqual([]);
    });
  });

  describe('adjustRateByLendScore', () => {
    it('should apply -100bp discount for score >= 80', () => {
      expect(adjustRateByLendScore(80, 1000)).toBe(900);
      expect(adjustRateByLendScore(90, 1000)).toBe(900);
      expect(adjustRateByLendScore(99, 1000)).toBe(900);
    });

    it('should apply -50bp discount for score 60-79', () => {
      expect(adjustRateByLendScore(60, 1000)).toBe(950);
      expect(adjustRateByLendScore(70, 1000)).toBe(950);
      expect(adjustRateByLendScore(79, 1000)).toBe(950);
    });

    it('should apply no adjustment for score 40-59', () => {
      expect(adjustRateByLendScore(40, 1000)).toBe(1000);
      expect(adjustRateByLendScore(50, 1000)).toBe(1000);
      expect(adjustRateByLendScore(59, 1000)).toBe(1000);
    });

    it('should apply +50bp premium for score 20-39', () => {
      expect(adjustRateByLendScore(20, 1000)).toBe(1050);
      expect(adjustRateByLendScore(30, 1000)).toBe(1050);
      expect(adjustRateByLendScore(39, 1000)).toBe(1050);
    });

    it('should apply +100bp premium for score 1-19', () => {
      expect(adjustRateByLendScore(1, 1000)).toBe(1100);
      expect(adjustRateByLendScore(10, 1000)).toBe(1100);
      expect(adjustRateByLendScore(19, 1000)).toBe(1100);
    });

    it('should enforce minimum rate of 100bp (1%)', () => {
      expect(adjustRateByLendScore(99, 100)).toBe(100); // Would be 0, clamped to 100
      expect(adjustRateByLendScore(80, 150)).toBe(100); // Would be 50, clamped to 100
    });

    it('should handle boundary values correctly', () => {
      // Test boundary between tiers
      expect(adjustRateByLendScore(79, 500)).toBe(450); // 60-79 tier
      expect(adjustRateByLendScore(80, 500)).toBe(400); // 80+ tier

      expect(adjustRateByLendScore(59, 500)).toBe(500); // 40-59 tier
      expect(adjustRateByLendScore(60, 500)).toBe(450); // 60-79 tier

      expect(adjustRateByLendScore(39, 500)).toBe(550); // 20-39 tier
      expect(adjustRateByLendScore(40, 500)).toBe(500); // 40-59 tier

      expect(adjustRateByLendScore(19, 500)).toBe(600); // 1-19 tier
      expect(adjustRateByLendScore(20, 500)).toBe(550); // 20-39 tier
    });
  });

  describe('LENDSCORE_REASON_DESCRIPTIONS', () => {
    it('should have descriptions for common reason codes', () => {
      expect(LENDSCORE_REASON_DESCRIPTIONS['CONSISTENT_INCOME']).toBeDefined();
      expect(LENDSCORE_REASON_DESCRIPTIONS['HIGH_OVERDRAFT_FREQUENCY']).toBeDefined();
      expect(LENDSCORE_REASON_DESCRIPTIONS['LIMITED_HISTORY']).toBeDefined();
    });

    it('should have both positive and negative factor descriptions', () => {
      // Positive factors
      expect(LENDSCORE_REASON_DESCRIPTIONS['HIGH_BALANCE_STABILITY']).toContain(
        'Stable'
      );
      expect(LENDSCORE_REASON_DESCRIPTIONS['REGULAR_SAVINGS']).toContain('savings');

      // Negative factors
      expect(LENDSCORE_REASON_DESCRIPTIONS['DECLINING_BALANCE_TREND']).toContain(
        'declining'
      );
      expect(LENDSCORE_REASON_DESCRIPTIONS['HIGH_EXPENSE_RATIO']).toContain('High');
    });
  });
});
