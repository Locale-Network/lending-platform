import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    stripeCustomer: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const { mockStripeInstance, MockStripe } = vi.hoisted(() => {
  const mockStripeInstance = {
    customers: {
      create: vi.fn(),
    },
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
      cancel: vi.fn(),
    },
    paymentMethods: {
      create: vi.fn(),
      attach: vi.fn(),
    },
    tokens: {
      create: vi.fn(),
    },
    setupIntents: {
      create: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };

  // Create a proper constructor mock
  function MockStripe() {
    return mockStripeInstance;
  }
  MockStripe.errors = {
    StripeError: class StripeError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'StripeError';
      }
    },
  };

  return { mockStripeInstance, MockStripe };
});

vi.mock('server-only', () => ({}));

vi.mock('@prisma/index', () => ({
  default: mockPrisma,
}));

vi.mock('stripe', () => ({
  default: MockStripe,
}));

// Mock environment variables
vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_mock_key');
vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_secret');
vi.stubEnv('PLAID_CLIENT_ID', 'test_plaid_client_id');
vi.stubEnv('PLAID_SECRET', 'test_plaid_secret');
vi.stubEnv('NEXT_PUBLIC_PLAID_ENV', 'sandbox');

// Import after mocks
import {
  getOrCreateStripeCustomer,
  getStripeCustomer,
  initiateACHRepayment,
  getPaymentStatus,
  cancelPayment,
  verifyAndConstructWebhookEvent,
  centsToDollars,
  dollarsToCents,
  mapStripeStatusToPaymentStatus,
} from './achPayments';

describe('Stripe ACH Payments Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOrCreateStripeCustomer', () => {
    it('should return existing customer if found in database', async () => {
      const existingCustomer = {
        id: 'cuid-123',
        stripeCustomerId: 'cus_existing123',
        accountAddress: '0xabc123',
      };

      mockPrisma.stripeCustomer.findUnique.mockResolvedValueOnce(existingCustomer);

      const result = await getOrCreateStripeCustomer('0xABC123', 'test@example.com');

      expect(result.customerId).toBe('cus_existing123');
      expect(result.isNew).toBe(false);
      expect(mockStripeInstance.customers.create).not.toHaveBeenCalled();
    });

    it('should create new customer if not found', async () => {
      mockPrisma.stripeCustomer.findUnique.mockResolvedValueOnce(null);
      mockStripeInstance.customers.create.mockResolvedValueOnce({
        id: 'cus_new123',
        email: 'test@example.com',
      });
      mockPrisma.stripeCustomer.create.mockResolvedValueOnce({
        id: 'cuid-new',
        stripeCustomerId: 'cus_new123',
        accountAddress: '0xdef456',
      });

      const result = await getOrCreateStripeCustomer('0xDEF456', 'test@example.com');

      expect(result.customerId).toBe('cus_new123');
      expect(result.isNew).toBe(true);
      expect(mockStripeInstance.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: {
          accountAddress: '0xdef456',
          platform: 'locale-lending',
        },
      });
    });

    it('should normalize address to lowercase', async () => {
      mockPrisma.stripeCustomer.findUnique.mockResolvedValueOnce(null);
      mockStripeInstance.customers.create.mockResolvedValueOnce({ id: 'cus_test' });
      mockPrisma.stripeCustomer.create.mockResolvedValueOnce({});

      await getOrCreateStripeCustomer('0xABCDEF');

      expect(mockPrisma.stripeCustomer.findUnique).toHaveBeenCalledWith({
        where: { accountAddress: '0xabcdef' },
      });
    });
  });

  describe('getStripeCustomer', () => {
    it('should return customer ID if found', async () => {
      mockPrisma.stripeCustomer.findUnique.mockResolvedValueOnce({
        stripeCustomerId: 'cus_found123',
      });

      const result = await getStripeCustomer('0xABC');

      expect(result).toBe('cus_found123');
    });

    it('should return null if not found', async () => {
      mockPrisma.stripeCustomer.findUnique.mockResolvedValueOnce(null);

      const result = await getStripeCustomer('0xNOTFOUND');

      expect(result).toBeNull();
    });
  });

  describe('initiateACHRepayment', () => {
    it('should create PaymentIntent with correct parameters', async () => {
      mockStripeInstance.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_test123',
        status: 'processing',
        client_secret: 'pi_test123_secret',
      });

      const result = await initiateACHRepayment({
        loanId: 'loan-123',
        amount: 100.5, // $100.50
        customerId: 'cus_123',
        paymentMethodId: 'pm_123',
        borrowerAddress: '0xBorrower',
        customerIpAddress: '192.168.1.1',
        userAgent: 'test-agent',
      });

      expect(result.success).toBe(true);
      expect(result.paymentIntentId).toBe('pi_test123');
      expect(result.status).toBe('processing');

      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10050, // Converted to cents
          currency: 'usd',
          customer: 'cus_123',
          payment_method: 'pm_123',
          payment_method_types: ['us_bank_account'],
          confirm: true,
          metadata: expect.objectContaining({
            loanId: 'loan-123',
            borrowerAddress: '0xBorrower',
            platform: 'locale-lending',
          }),
        })
      );
    });

    it('should handle Stripe errors gracefully', async () => {
      const stripeError = new Error('Card declined');
      stripeError.name = 'StripeError';
      mockStripeInstance.paymentIntents.create.mockRejectedValueOnce(stripeError);

      const result = await initiateACHRepayment({
        loanId: 'loan-123',
        amount: 100,
        customerId: 'cus_123',
        paymentMethodId: 'pm_123',
        borrowerAddress: '0xBorrower',
        customerIpAddress: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Card declined');
    });

    it('should round amount to avoid floating point issues', async () => {
      mockStripeInstance.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_test',
        status: 'processing',
      });

      await initiateACHRepayment({
        loanId: 'loan-123',
        amount: 99.999, // Should round to 10000 cents
        customerId: 'cus_123',
        paymentMethodId: 'pm_123',
        borrowerAddress: '0xBorrower',
        customerIpAddress: '192.168.1.1',
      });

      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000, // Rounded
        })
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('should retrieve and format payment status', async () => {
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_test123',
        status: 'succeeded',
        amount: 10050,
        amount_received: 10050,
        currency: 'usd',
        created: 1704067200, // 2024-01-01 00:00:00 UTC
        metadata: { loanId: 'loan-123' },
      });

      const result = await getPaymentStatus('pi_test123');

      expect(result).toEqual({
        id: 'pi_test123',
        status: 'succeeded',
        amount: 10050,
        amountReceived: 10050,
        currency: 'usd',
        createdAt: new Date(1704067200 * 1000),
        metadata: { loanId: 'loan-123' },
      });
    });

    it('should return null on error', async () => {
      mockStripeInstance.paymentIntents.retrieve.mockRejectedValueOnce(new Error('Not found'));

      const result = await getPaymentStatus('pi_invalid');

      expect(result).toBeNull();
    });
  });

  describe('cancelPayment', () => {
    it('should cancel payment successfully', async () => {
      mockStripeInstance.paymentIntents.cancel.mockResolvedValueOnce({
        id: 'pi_test123',
        status: 'canceled',
      });

      const result = await cancelPayment('pi_test123');

      expect(result.success).toBe(true);
    });

    it('should handle cancellation errors', async () => {
      const stripeError = new Error('Cannot cancel payment');
      stripeError.name = 'StripeError';
      mockStripeInstance.paymentIntents.cancel.mockRejectedValueOnce(stripeError);

      const result = await cancelPayment('pi_test123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot cancel payment');
    });
  });

  describe('verifyAndConstructWebhookEvent', () => {
    it('should return event when signature is valid', () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      const result = verifyAndConstructWebhookEvent('raw_body', 'valid_signature');

      expect(result).toEqual(mockEvent);
    });

    it('should return null when signature is invalid', () => {
      mockStripeInstance.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });

      const result = verifyAndConstructWebhookEvent('raw_body', 'invalid_signature');

      expect(result).toBeNull();
    });
  });

  describe('utility functions', () => {
    describe('centsToDollars', () => {
      it('should convert cents to dollars correctly', () => {
        expect(centsToDollars(100)).toBe(1);
        expect(centsToDollars(10050)).toBe(100.5);
        expect(centsToDollars(1)).toBe(0.01);
        expect(centsToDollars(0)).toBe(0);
      });
    });

    describe('dollarsToCents', () => {
      it('should convert dollars to cents correctly', () => {
        expect(dollarsToCents(1)).toBe(100);
        expect(dollarsToCents(100.5)).toBe(10050);
        expect(dollarsToCents(0.01)).toBe(1);
        expect(dollarsToCents(0)).toBe(0);
      });

      it('should round to avoid floating point issues', () => {
        expect(dollarsToCents(99.999)).toBe(10000);
        expect(dollarsToCents(0.001)).toBe(0);
      });
    });

    describe('mapStripeStatusToPaymentStatus', () => {
      it('should map pending statuses correctly', () => {
        expect(mapStripeStatusToPaymentStatus('requires_payment_method')).toBe('PENDING');
        expect(mapStripeStatusToPaymentStatus('requires_confirmation')).toBe('PENDING');
        expect(mapStripeStatusToPaymentStatus('requires_action')).toBe('PENDING');
      });

      it('should map processing to CONFIRMED (ACH in transit)', () => {
        expect(mapStripeStatusToPaymentStatus('processing')).toBe('CONFIRMED');
      });

      it('should map succeeded to PAID', () => {
        expect(mapStripeStatusToPaymentStatus('succeeded')).toBe('PAID');
      });

      it('should map other statuses to FAILED', () => {
        expect(mapStripeStatusToPaymentStatus('canceled')).toBe('FAILED');
        expect(mapStripeStatusToPaymentStatus('requires_capture')).toBe('FAILED');
      });
    });
  });
});
