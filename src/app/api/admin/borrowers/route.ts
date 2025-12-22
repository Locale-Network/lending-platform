import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'admin-borrowers' });

// GET /api/admin/borrowers - List all borrowers with their loan applications
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const status = searchParams.get('status');

    // Get all accounts with BORROWER role or with loan applications
    const borrowers = await prisma.account.findMany({
      where: {
        OR: [
          { role: 'BORROWER' },
          { loanApplications: { some: {} } },
        ],
      },
      include: {
        loanApplications: {
          include: {
            poolLoans: {
              include: {
                pool: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        KYCVerification: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform data for frontend - filter out DRAFT applications
    const transformedBorrowers = borrowers.map((borrower) => {
      // Only count non-DRAFT applications
      const submittedApplications = borrower.loanApplications.filter(
        (loan) => loan.status !== 'DRAFT'
      );
      const totalLoans = submittedApplications.length;
      const activeLoans = submittedApplications.filter(
        (loan) => loan.status === 'ACTIVE' || loan.status === 'DISBURSED'
      ).length;
      const pendingLoans = submittedApplications.filter(
        (loan) => loan.status === 'PENDING' || loan.status === 'SUBMITTED'
      ).length;
      const totalBorrowed = submittedApplications
        .filter((loan) => loan.status === 'ACTIVE' || loan.status === 'DISBURSED' || loan.status === 'REPAID')
        .reduce((sum, loan) => sum + (loan.amount || 0), 0);

      // Get all pools this borrower has loans in
      const pools = new Set<string>();
      submittedApplications.forEach((loan) => {
        loan.poolLoans.forEach((poolLoan) => {
          pools.add(poolLoan.pool.name);
        });
      });

      return {
        id: borrower.address,
        address: borrower.address,
        shortAddress: `${borrower.address.slice(0, 6)}...${borrower.address.slice(-4)}`,
        email: borrower.email,
        role: borrower.role,
        kycStatus: borrower.KYCVerification?.status || 'not_started',
        isVerified: borrower.KYCVerification?.status === 'success',
        totalLoans,
        activeLoans,
        pendingLoans,
        totalBorrowed,
        pools: Array.from(pools),
        // Only return non-DRAFT applications
        loanApplications: submittedApplications.map((loan) => ({
          id: loan.id,
          businessName: loan.businessLegalName,
          status: loan.status,
          amount: loan.amount,
          requestedAmount: loan.requestedAmount ? Number(loan.requestedAmount) / 100 : null,
          loanPurpose: loan.loanPurpose,
          createdAt: loan.createdAt,
          updatedAt: loan.updatedAt,
          pools: loan.poolLoans.map((pl) => ({
            poolId: pl.pool.id,
            poolName: pl.pool.name,
            poolSlug: pl.pool.slug,
            principal: pl.principal,
            interestRate: pl.interestRate,
          })),
        })),
        joinedDate: borrower.createdAt,
      };
    });

    // Apply filters
    let filtered = transformedBorrowers;

    if (poolId) {
      filtered = filtered.filter((b) =>
        b.loanApplications.some((loan) =>
          loan.pools.some((p) => p.poolId === poolId)
        )
      );
    }

    if (status) {
      filtered = filtered.filter((b) =>
        b.loanApplications.some((loan) => loan.status === status)
      );
    }

    // Calculate summary stats
    const summary = {
      totalBorrowers: filtered.length,
      totalActiveLoans: filtered.reduce((sum, b) => sum + b.activeLoans, 0),
      totalPendingLoans: filtered.reduce((sum, b) => sum + b.pendingLoans, 0),
      totalBorrowed: filtered.reduce((sum, b) => sum + b.totalBorrowed, 0),
      verifiedCount: filtered.filter((b) => b.isVerified).length,
    };

    return NextResponse.json({
      borrowers: filtered,
      summary,
    });
  } catch (error) {
    log.error({ err: error }, 'Error fetching borrowers');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
