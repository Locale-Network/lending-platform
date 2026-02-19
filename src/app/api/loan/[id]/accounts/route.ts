import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import { getPlaidAccountForACH } from '@/services/stripe/achPayments';
import { paymentLogger } from '@/lib/logger';
import { decryptField } from '@/lib/encryption';
import { getSession } from '@/lib/auth/authorization';
import { Role } from '@prisma/client';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

const log = paymentLogger.child({ route: 'loan-accounts' });

/**
 * GET /api/loan/[id]/accounts
 *
 * Fetches available bank accounts from Plaid for ACH payment selection.
 *
 * Returns:
 * - accounts: Array of eligible checking/savings accounts
 * - Each account includes: accountId, name, type, subtype, mask
 */

interface PlaidAccount {
  account_id: string;
  name: string;
  type: string;
  subtype: string;
  mask: string;
  balances?: {
    available: number | null;
    current: number | null;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Require authentication
    const session = await getSession();
    if (!session?.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Rate limiting on bank account access
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      `loan-accounts:${session.address}`,
      { limit: 30, windowSeconds: 60 } // 30 requests per minute
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const { id: loanId } = await params;

    // Get loan application with Plaid token
    const loan = await prisma.loanApplication.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        accountAddress: true,
        plaidItemAccessToken: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    // SECURITY: Verify ownership - user must be the borrower OR an admin
    const isOwner = loan.accountAddress.toLowerCase() === session.address.toLowerCase();
    const isAdmin = session.user.role === Role.ADMIN;

    if (!isOwner && !isAdmin) {
      log.warn({ loanId, requestedBy: session.address, owner: loan.accountAddress }, 'Unauthorized loan account access attempt');
      return NextResponse.json(
        { error: 'Forbidden - You do not have access to this loan' },
        { status: 403 }
      );
    }

    const plaidToken = loan.plaidItemAccessToken[0];

    if (!plaidToken) {
      return NextResponse.json(
        { error: 'No linked bank account', accounts: [] },
        { status: 200 }
      );
    }

    // Decrypt the access token
    const accessToken = decryptField(plaidToken.accessToken);

    // Fetch accounts from Plaid
    const plaidClientId = process.env.PLAID_CLIENT_ID;
    const plaidSecret = process.env.PLAID_SECRET;
    const plaidEnv = process.env.NEXT_PUBLIC_PLAID_ENV;

    if (!plaidClientId || !plaidSecret || !plaidEnv) {
      log.error({ loanId }, 'Plaid credentials not configured');
      return NextResponse.json(
        { error: 'Payment service not configured - PLAID_ENV, PLAID_CLIENT_ID, and PLAID_SECRET are required' },
        { status: 500 }
      );
    }

    const PLAID_URLS: Record<string, string> = {
      production: 'https://production.plaid.com',
      development: 'https://development.plaid.com',
      sandbox: 'https://sandbox.plaid.com',
    };

    const plaidBaseUrl = PLAID_URLS[plaidEnv];
    if (!plaidBaseUrl) {
      log.error({ plaidEnv }, 'Invalid PLAID_ENV value');
      return NextResponse.json(
        { error: 'Payment service misconfigured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${plaidBaseUrl}/accounts/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: plaidClientId,
        secret: plaidSecret,
        access_token: accessToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      log.error({ loanId, error: data }, 'Failed to fetch Plaid accounts');
      return NextResponse.json(
        { error: 'Failed to fetch bank accounts' },
        { status: 500 }
      );
    }

    // Filter to only depository accounts (checking/savings) eligible for ACH
    const accounts = (data.accounts || [])
      .filter((acc: PlaidAccount) => acc.type === 'depository')
      .map((acc: PlaidAccount) => ({
        accountId: acc.account_id,
        name: acc.name,
        type: acc.type,
        subtype: acc.subtype, // 'checking' or 'savings'
        mask: acc.mask || '****',
        availableBalance: acc.balances?.available ?? null,
      }));

    log.info({ loanId, accountCount: accounts.length }, 'Fetched Plaid accounts');

    return NextResponse.json({ accounts });
  } catch (error) {
    log.error({ err: error }, 'Error fetching accounts');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
