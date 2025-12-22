import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import {
  transferToLoanPool,
  getPoolBalancesSummary,
} from '@/services/contracts/poolBridge';

/**
 * Admin Pool Transfer API
 *
 * Allows administrators to transfer funds between StakingPool and SimpleLoanPool.
 *
 * GET - Get current pool balances
 * POST - Transfer funds from StakingPool to SimpleLoanPool
 */

// Validation schema for POST request
const transferSchema = z.object({
  amount: z.string().refine(
    (val) => {
      try {
        const parsed = BigInt(val);
        return parsed > BigInt(0);
      } catch {
        return false;
      }
    },
    { message: 'Amount must be a positive integer string (in smallest token units)' }
  ),
});

/**
 * GET /api/admin/pool-transfer
 *
 * Returns current pool balances and transfer history
 */
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
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get pool balances from blockchain
    const balances = await getPoolBalancesSummary();

    // Get recent transfers from database
    const recentTransfers = await prisma.poolTransfer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      balances,
      recentTransfers: recentTransfers.map((t) => ({
        id: t.id,
        fromPool: t.fromPool,
        toPool: t.toPool,
        amount: t.amount.toString(),
        transactionHash: t.transactionHash,
        initiatedBy: t.initiatedBy,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Admin Pool Transfer] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pool-transfer
 *
 * Transfer funds from StakingPool to SimpleLoanPool
 *
 * Body:
 * - amount: string (in smallest token units, e.g., "1000000" for 1 USDC)
 */
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
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = transferSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const amount = BigInt(validation.data.amount);

    console.log('[Admin Pool Transfer] Initiating transfer', {
      amount: amount.toString(),
      initiatedBy: session.address,
    });

    // Execute transfer
    const result = await transferToLoanPool(amount, session.address);

    if (!result.success) {
      console.error('[Admin Pool Transfer] Transfer failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    console.log('[Admin Pool Transfer] Transfer successful', {
      txHash: result.txHash,
      blockNumber: result.blockNumber,
    });

    // Get updated balances
    const balances = await getPoolBalancesSummary();

    return NextResponse.json({
      success: true,
      transfer: {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        amount: amount.toString(),
      },
      balances,
    });
  } catch (error) {
    console.error('[Admin Pool Transfer] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
