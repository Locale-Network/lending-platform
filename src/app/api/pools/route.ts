import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { PoolStatus, PoolType } from '@prisma/client';
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
});

// Helper function to generate unique slug
async function generateSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  let slug = baseSlug;
  let counter = 1;

  // Check if slug exists
  while (await prisma.loanPool.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

// GET /api/pools - List all pools
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.account.findUnique({
      where: { address: session.address },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as PoolStatus | null;
    const type = searchParams.get('type') as PoolType | null;
    const featured = searchParams.get('featured');

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
    if (type) where.poolType = type;
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

    // Check if user is admin
    const user = await prisma.account.findUnique({
      where: { address: session.address },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // Validate input
    const validatedData = createPoolSchema.parse(body);

    // Generate unique slug
    const slug = await generateSlug(validatedData.name);

    // Create pool
    const pool = await prisma.loanPool.create({
      data: {
        ...validatedData,
        slug,
        status: 'DRAFT', // All new pools start as DRAFT
        totalStaked: 0,
        totalInvestors: 0,
        availableLiquidity: validatedData.poolSize,
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
