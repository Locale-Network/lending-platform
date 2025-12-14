import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { updateLoanInterestRate } from '@/services/contracts/simpleLoanPool';

/**
 * Admin API: Manage Pending Rate Changes
 *
 * GET: List all pending rate changes
 * POST: Approve or reject a pending rate change
 */

// GET /api/admin/rate-approvals - List pending rate changes
export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    const session = await getSession();
    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.account.findUnique({
      where: { address: session.address },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'APPROVER')) {
      return NextResponse.json({ error: 'Forbidden - Admin or Approver access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';

    const pendingChanges = await prisma.pendingRateChange.findMany({
      where: {
        status: status as any
      },
      include: {
        loanApplication: {
          select: {
            id: true,
            businessLegalName: true,
            accountAddress: true,
            amount: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      count: pendingChanges.length,
      changes: pendingChanges
    });

  } catch (error) {
    console.error('[Rate Approvals API] Error fetching pending changes:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/admin/rate-approvals - Approve or reject rate change
export async function POST(req: NextRequest) {
  try {
    // Check admin authentication
    const session = await getSession();
    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.account.findUnique({
      where: { address: session.address },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'APPROVER')) {
      return NextResponse.json({ error: 'Forbidden - Admin or Approver access required' }, { status: 403 });
    }

    const body = await req.json();
    const { changeId, action, adminAddress, rejectionReason } = body;

    if (!changeId || !action || !adminAddress) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: changeId, action, adminAddress'
      }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Must be "approve" or "reject"'
      }, { status: 400 });
    }

    // Fetch pending change
    const pendingChange = await prisma.pendingRateChange.findUnique({
      where: { id: changeId },
      include: {
        loanApplication: true
      }
    });

    if (!pendingChange) {
      return NextResponse.json({
        success: false,
        error: 'Pending rate change not found'
      }, { status: 404 });
    }

    if (pendingChange.status !== 'PENDING') {
      return NextResponse.json({
        success: false,
        error: `Rate change is not pending. Current status: ${pendingChange.status}`
      }, { status: 400 });
    }

    // Handle rejection
    if (action === 'reject') {
      await prisma.pendingRateChange.update({
        where: { id: changeId },
        data: {
          status: 'REJECTED',
          approvedBy: adminAddress,
          approvedAt: new Date(),
          rejectionReason: rejectionReason || 'No reason provided'
        }
      });

      console.log(`[Rate Approvals API] Rejected rate change ${changeId} by ${adminAddress}`);

      return NextResponse.json({
        success: true,
        message: 'Rate change rejected',
        changeId,
        action: 'rejected'
      });
    }

    // Handle approval - execute rate change on smart contract
    if (action === 'approve') {
      // Mark as approved
      await prisma.pendingRateChange.update({
        where: { id: changeId },
        data: {
          status: 'APPROVED',
          approvedBy: adminAddress,
          approvedAt: new Date()
        }
      });

      console.log(`[Rate Approvals API] Approved rate change ${changeId} by ${adminAddress}`);
      console.log(`[Rate Approvals API] Executing rate update: ${pendingChange.currentRate} -> ${pendingChange.proposedRate}`);

      // Execute on smart contract
      try {
        const result = await updateLoanInterestRate(
          pendingChange.loanApplicationId,
          BigInt(Math.floor(pendingChange.proposedRate))
        );

        if (!result.success) {
          // Mark as failed
          await prisma.pendingRateChange.update({
            where: { id: changeId },
            data: {
              status: 'FAILED',
              failureReason: result.error || 'Smart contract update failed'
            }
          });

          return NextResponse.json({
            success: false,
            error: result.error || 'Failed to update smart contract'
          }, { status: 500 });
        }

        // Mark as executed with transaction hash
        await prisma.pendingRateChange.update({
          where: { id: changeId },
          data: {
            status: 'EXECUTED',
            executedAt: new Date(),
            txHash: result.txHash || null
          }
        });

        console.log(`[Rate Approvals API] Successfully executed rate change ${changeId}, txHash: ${result.txHash}`);

        return NextResponse.json({
          success: true,
          message: 'Rate change approved and executed',
          changeId,
          action: 'approved',
          oldRate: pendingChange.currentRate,
          newRate: pendingChange.proposedRate,
          txHash: result.txHash
        });

      } catch (error) {
        // Mark as failed
        await prisma.pendingRateChange.update({
          where: { id: changeId },
          data: {
            status: 'FAILED',
            failureReason: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        console.error(`[Rate Approvals API] Error executing rate change:`, error);

        return NextResponse.json({
          success: false,
          error: `Approval succeeded but execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('[Rate Approvals API] Error processing request:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
