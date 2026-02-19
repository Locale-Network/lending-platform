import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'admin-pools' });

// Validation schema for pool updates
const updatePoolSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED']).optional(),
  managementFeeRate: z.number().min(0).max(100).optional(),
  performanceFeeRate: z.number().min(0).max(100).optional(),
  baseInterestRate: z.number().min(0).max(100).optional(),
  riskPremiumMin: z.number().min(0).max(100).optional(),
  riskPremiumMax: z.number().min(0).max(100).optional(),
  minCreditScore: z.number().int().min(300).max(850).optional().nullable(),
  maxLTV: z.number().min(0).max(100).optional().nullable(),
  allowedIndustries: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional().nullable(),
  isFeatured: z.boolean().optional(),
  isComingSoon: z.boolean().optional(),
});

// GET /api/pools/[id] - Get single pool
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (session.user.role is already populated by getSession)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const pool = await prisma.loanPool.findUnique({
      where: { id },
      include: {
        stakes: {
          where: { status: 'ACTIVE' },
          include: {
            investor: {
              select: {
                address: true,
                email: true,
                createdAt: true,
              },
            },
          },
        },
        loans: {
          include: {
            loanApplication: {
              select: {
                id: true,
                businessLegalName: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            stakes: true,
            loans: true,
          },
        },
      },
    });

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    return NextResponse.json(pool);
  } catch (error) {
    log.error({ err: error }, 'Error fetching pool');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/pools/[id] - Update pool
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (session.user.role is already populated by getSession)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    // Check if pool exists
    const existingPool = await prisma.loanPool.findUnique({
      where: { id },
      include: {
        _count: {
          select: { stakes: true },
        },
      },
    });

    if (!existingPool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate input
    const validatedData = updatePoolSchema.parse(body);

    // Prevent certain changes if pool is ACTIVE and has stakes
    if (existingPool.status === 'ACTIVE' && existingPool._count.stakes > 0) {
      // Cannot change these fields after pool is active with stakes
      const restrictedFields = ['poolSize', 'poolType', 'minimumStake'];
      const attemptedChanges = Object.keys(validatedData);

      const hasRestrictedChanges = restrictedFields.some(field =>
        attemptedChanges.includes(field)
      );

      if (hasRestrictedChanges) {
        return NextResponse.json(
          {
            error: 'Cannot modify pool size, type, or minimum stake for active pools with investors',
          },
          { status: 400 }
        );
      }
    }

    // Coming Soon validation: only DRAFT pools can be marked as Coming Soon
    if (validatedData.isComingSoon === true && existingPool.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only DRAFT pools can be marked as Coming Soon' },
        { status: 400 }
      );
    }

    // Auto-clear isComingSoon when activating a pool
    if (validatedData.status === 'ACTIVE' && existingPool.isComingSoon) {
      validatedData.isComingSoon = false;
      log.info({ poolId: id }, 'Auto-clearing isComingSoon on pool activation');
    }

    // Update pool
    const updatedPool = await prisma.loanPool.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(updatedPool);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    log.error({ err: error }, 'Error updating pool');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/pools/[id] - Delete pool
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (session.user.role is already populated by getSession)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    // Check if pool exists
    const existingPool = await prisma.loanPool.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stakes: true,
            loans: true,
          },
        },
      },
    });

    if (!existingPool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Only allow deletion of DRAFT pools with no stakes or loans
    if (existingPool.status !== 'DRAFT') {
      return NextResponse.json(
        {
          error: 'Can only delete DRAFT pools. Please set status to CLOSED instead.',
        },
        { status: 400 }
      );
    }

    if (existingPool._count.stakes > 0 || existingPool._count.loans > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete pool with existing stakes or loans',
        },
        { status: 400 }
      );
    }

    // Delete pool
    await prisma.loanPool.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Pool deleted successfully' });
  } catch (error) {
    log.error({ err: error }, 'Error deleting pool');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
