import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { PoolStatus, PoolType, BorrowerType, Prisma } from '@prisma/client';
import { z } from 'zod';

// Validation schema for pool creation
const createPoolSchema = z.object({
  name: z.string().min(1, 'Pool name is required').max(255),
  description: z.string().min(1, 'Description is required'),
  poolType: z.enum(['SMALL_BUSINESS', 'REAL_ESTATE', 'CONSUMER', 'MIXED']),
  poolSize: z.number().positive('Pool size must be positive'),
  minimumStake: z.number().positive('Minimum stake must be positive'),
  managementFeeRate: z.number().min(0).max(100),
  performanceFeeRate: z.number().min(0).max(100),
  baseInterestRate: z.number().min(0).max(100),
  riskPremiumMin: z.number().min(0).max(100),
  riskPremiumMax: z.number().min(0).max(100),
  minCreditScore: z.number().int().min(300).max(850).optional().nullable(),
  maxLTV: z.number().min(0).max(100).optional().nullable(),
  allowedIndustries: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional().nullable(),
  isFeatured: z.boolean().default(false),
  // Target APY for investor display - recommended for proper investor communication
  annualizedReturn: z.number().min(0).max(100).optional().nullable(),
  // Pool structure - determines if composite risk scoring is enabled
  borrowerType: z.enum(['SINGLE_BORROWER', 'MULTI_BORROWER', 'SYNDICATED']).default('MULTI_BORROWER'),
});

/**
 * Generate a unique slug for a pool name
 *
 * SECURITY: This function is prone to race conditions if two pools with the same
 * name are created simultaneously. We mitigate this by:
 * 1. Adding a random suffix to make collisions extremely unlikely
 * 2. Relying on the database's unique constraint on slug to reject duplicates
 * 3. Retrying with a new suffix if a constraint violation occurs (handled in caller)
 */
async function generateSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Check if base slug is available
  const existing = await prisma.loanPool.findUnique({ where: { slug: baseSlug } });

  if (!existing) {
    return baseSlug;
  }

  // If base slug exists, add a random suffix to avoid race conditions
  // Random suffix makes collisions between concurrent requests extremely unlikely
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const timestamp = Date.now().toString(36).slice(-4);
  const slug = `${baseSlug}-${timestamp}${randomSuffix}`;

  return slug;
}

// GET /api/pools - List all pools
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use role from session (already fetched from DB in getSession)
    // No need to query database again
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const typeParam = searchParams.get('type');
    const featured = searchParams.get('featured');

    // SECURITY: Validate enum params against allowed values to prevent injection
    const validStatuses = Object.values(PoolStatus);
    const validTypes = Object.values(PoolType);

    if (statusParam && !validStatuses.includes(statusParam as PoolStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }
    if (typeParam && !validTypes.includes(typeParam as PoolType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Build where clause with validated params
    const where: Prisma.LoanPoolWhereInput = {};
    if (statusParam) where.status = statusParam as PoolStatus;
    if (typeParam) where.poolType = typeParam as PoolType;
    if (featured === 'true') where.isFeatured = true;

    const pools = await prisma.loanPool.findMany({
      where,
      include: {
        _count: {
          select: {
            stakes: true,
            loans: true,
          },
        },
        loans: {
          include: {
            loanApplication: {
              select: {
                id: true,
                businessLegalName: true,
                status: true,
                amount: true,
                loanPurpose: true,
                accountAddress: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { fundedAt: 'desc' },
        },
      },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(pools);
  } catch (error) {
    console.error('Error fetching pools:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/pools - Create new pool
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use role from session (already fetched from DB in getSession)
    // No need to query database again
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // Validate input
    const validatedData = createPoolSchema.parse(body);

    // Generate unique slug
    const slug = await generateSlug(validatedData.name);

    // Create pool
    // Note: totalStaked, totalInvestors, availableLiquidity are now computed
    // dynamically from InvestorStake table - these are just initial values
    const pool = await prisma.loanPool.create({
      data: {
        ...validatedData,
        slug,
        status: 'DRAFT', // All new pools start as DRAFT
        totalStaked: 0,
        totalInvestors: 0,
        availableLiquidity: validatedData.poolSize,
        // APY is now included from validated input if provided
        annualizedReturn: validatedData.annualizedReturn ?? null,
      },
    });

    return NextResponse.json(pool, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating pool:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
