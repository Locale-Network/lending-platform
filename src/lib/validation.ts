import { z } from 'zod';
import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

/**
 * Shared validation schemas and utilities
 *
 * Use these to validate API inputs consistently across endpoints.
 */

/**
 * Validate an Ethereum address using viem's isAddress
 * This properly validates checksummed addresses
 */
export function isValidEthereumAddress(address: unknown): address is `0x${string}` {
  if (typeof address !== 'string') {
    return false;
  }
  // Must be 42 characters (0x + 40 hex chars)
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return false;
  }
  return isAddress(address);
}

/**
 * Validate address is not the zero address
 */
export function isNonZeroAddress(address: string): boolean {
  return (
    isValidEthereumAddress(address) &&
    address.toLowerCase() !== '0x0000000000000000000000000000000000000000'
  );
}

// Common field schemas
export const addressSchema = z
  .string()
  .refine(isValidEthereumAddress, { message: 'Invalid Ethereum address' });

/**
 * Non-zero address schema - rejects the zero address
 */
export const nonZeroAddressSchema = z
  .string()
  .refine(isNonZeroAddress, { message: 'Invalid or zero Ethereum address' });

export const uuidSchema = z.string().cuid();

export const loanIdSchema = z.string().min(1, 'Loan ID is required');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// API-specific schemas
export const syncRequestSchema = z.object({
  force: z.boolean().optional().default(false),
});

export const repaymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  loanId: loanIdSchema,
});

export const stakeSchema = z.object({
  poolId: z.string().min(1, 'Pool ID is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
});

export const unstakeSchema = z.object({
  poolId: z.string().min(1, 'Pool ID is required'),
  shares: z.coerce.number().positive('Shares must be positive'),
});

/**
 * Validate request body against a schema
 *
 * @returns Parsed data or NextResponse with error
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Validation failed',
            details: result.error.flatten().fieldErrors,
          },
          { status: 400 }
        ),
      };
    }

    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate URL search params against a schema
 */
export function validateSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodType<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  const params = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(params);

  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate route params (like [id])
 */
export function validateRouteParams<T>(
  params: Record<string, string>,
  schema: z.ZodType<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(params);

  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Invalid route parameters',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}
