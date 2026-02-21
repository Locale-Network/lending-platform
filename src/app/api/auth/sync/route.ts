import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import { Role } from '@prisma/client';
import { PrivyClient } from '@privy-io/server-auth';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders } from '@/lib/rate-limit';
import { isValidEthereumAddress } from '@/lib/validation';
import { authLogger } from '@/lib/logger';
import { auditLog, getAuditContext } from '@/lib/audit-logger';

const log = authLogger.child({ endpoint: 'auth-sync' });

/**
 * Auth Sync Endpoint
 *
 * Syncs authentication data from Privy to the database.
 * This endpoint is called after successful Privy authentication.
 *
 * Flow:
 * 1. User authenticates via Privy (email/social/passkey/wallet)
 * 2. Client sends Privy token (from cookies or header)
 * 3. Server verifies token with Privy SDK
 * 4. Server syncs verified data to accounts table via Prisma
 *
 * Security:
 * - Privy token is verified server-side (not just trusted from client)
 * - Uses Prisma (direct PostgreSQL, bypasses Supabase RLS)
 * - Rate limited to prevent abuse
 * - Input validation for addresses
 * - Audit logging for security events
 */

// Initialize Privy client for server-side verification
let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient | null {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    log.warn('Privy credentials not configured');
    return null;
  }

  if (!privyClient) {
    privyClient = new PrivyClient(appId, appSecret);
  }
  return privyClient;
}

export async function POST(request: NextRequest) {
  const auditContext = getAuditContext(request);

  try {
    // Rate limiting for auth sync endpoint
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(clientIp, rateLimits.authSync);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    // Get Privy token from Authorization header or cookies
    const authHeader = request.headers.get('authorization');
    const privyToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : request.cookies.get('privy-token')?.value;

    if (!privyToken) {
      log.warn('No Privy token provided');
      await auditLog.authEvent({
        action: 'LOGIN_FAILURE',
        outcome: 'denied',
        reason: 'No authentication token',
        ...auditContext,
      });
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify token with Privy server SDK
    const client = getPrivyClient();
    if (!client) {
      log.error('Privy client not configured');
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      );
    }

    let verifiedClaims;
    try {
      verifiedClaims = await client.verifyAuthToken(privyToken);
    } catch (verifyError) {
      log.warn({ err: verifyError }, 'Token verification failed');
      await auditLog.authEvent({
        action: 'LOGIN_FAILURE',
        outcome: 'denied',
        reason: 'Invalid token',
        ...auditContext,
      });
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user data from Privy to verify wallet address
    const privyUser = await client.getUser(verifiedClaims.userId);
    const walletAccount = privyUser.linkedAccounts.find(
      (account) => account.type === 'wallet'
    );
    const emailAccount = privyUser.linkedAccounts.find(
      (account) => account.type === 'email'
    );

    // Extract verified data from Privy (NOT from client request body)
    const verifiedAddress = walletAccount?.address;
    const verifiedEmail = emailAccount?.address;
    const verifiedPrivyUserId = verifiedClaims.userId;

    if (!verifiedAddress) {
      log.warn({ userId: verifiedPrivyUserId }, 'No wallet linked to Privy account');
      return NextResponse.json(
        { error: 'No wallet address linked to your account' },
        { status: 400 }
      );
    }

    // Validate the verified address format
    if (!isValidEthereumAddress(verifiedAddress)) {
      log.error({ address: verifiedAddress }, 'Invalid address format from Privy');
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Parse request body for optional fields only (auth provider preference)
    let authProvider: 'email' | 'google' | 'apple' | 'passkey' | 'wallet' = 'wallet';
    try {
      const body = await request.json();
      if (body.authProvider && ['email', 'google', 'apple', 'passkey', 'wallet'].includes(body.authProvider)) {
        authProvider = body.authProvider;
      }
    } catch {
      // Body is optional - default to 'wallet' auth provider
    }

    const normalizedAddress = verifiedAddress.toLowerCase();

    // Check for existing account by BOTH address AND Privy user ID
    const [existingByAddress, existingByPrivyId] = await Promise.all([
      prisma.account.findUnique({
        where: { address: normalizedAddress },
      }),
      prisma.account.findUnique({
        where: { privyUserId: verifiedPrivyUserId },
      }),
    ]);

    // Case 1: Account exists with this address
    if (existingByAddress) {
      log.info({
        address: existingByAddress.address,
        existingRole: existingByAddress.role,
      }, 'Found existing account by address');

      // Check if this account is already linked to a DIFFERENT Privy user
      if (existingByAddress.privyUserId && existingByAddress.privyUserId !== verifiedPrivyUserId) {
        log.warn('Wallet already linked to different Privy account');

        // Track conflict rate limit
        const conflictRateLimitResult = await checkRateLimit(
          `${clientIp}:conflict`,
          rateLimits.authSyncConflict
        );

        if (!conflictRateLimitResult.success) {
          log.warn('Conflict rate limit exceeded - forcing re-auth');
          return NextResponse.json(
            {
              error: 'Too many wallet conflicts',
              code: 'FORCE_REAUTH',
              message: 'Please sign out and sign in again with a fresh session.',
            },
            { status: 429, headers: rateLimitHeaders(conflictRateLimitResult) }
          );
        }

        return NextResponse.json(
          {
            error: 'This wallet is already linked to a different account',
            message: 'This wallet address is registered to another user. Please use a different wallet or contact support.',
            conflictsRemaining: conflictRateLimitResult.remaining,
          },
          { status: 409 }
        );
      }

      // Safe to update
      const updatedAccount = await prisma.account.update({
        where: { address: normalizedAddress },
        data: {
          privyUserId: verifiedPrivyUserId,
          email: verifiedEmail || existingByAddress.email,
          authProvider: authProvider,
        },
        select: {
          address: true,
          role: true,
          email: true,
          privyUserId: true,
        },
      });

      log.info({ address: updatedAccount.address, role: updatedAccount.role }, 'Updated account');

      await auditLog.authEvent({
        action: 'LOGIN_SUCCESS',
        outcome: 'success',
        userId: normalizedAddress,
        ...auditContext,
      });

      return NextResponse.json({
        success: true,
        account: {
          address: updatedAccount.address,
          role: updatedAccount.role,
          privyUserId: verifiedPrivyUserId,
        },
      });
    }

    // Case 2: Account exists with this Privy ID but different address
    if (existingByPrivyId) {
      return NextResponse.json(
        {
          error: 'Account already exists with a different wallet address',
          message: 'Please connect with your original wallet, or contact support to merge accounts',
        },
        { status: 409 }
      );
    }

    // Case 3: Brand new user - create account with INVESTOR role
    const newAccount = await prisma.account.create({
      data: {
        address: normalizedAddress,
        privyUserId: verifiedPrivyUserId,
        email: verifiedEmail || null,
        authProvider: authProvider,
        role: Role.INVESTOR,
      },
    });

    log.info({ address: newAccount.address, role: newAccount.role }, 'Created new account');

    await auditLog.authEvent({
      action: 'LOGIN_SUCCESS',
      outcome: 'success',
      userId: normalizedAddress,
      metadata: { isNewUser: true },
      ...auditContext,
    });

    return NextResponse.json({
      success: true,
      account: {
        address: newAccount.address,
        role: newAccount.role,
        privyUserId: verifiedPrivyUserId,
      },
      isNewUser: true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'Error';

    log.error({
      err: error,
      errorName,
      errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, 'Auth sync error');

    // Check for specific Prisma errors
    if (errorName === 'PrismaClientKnownRequestError') {
      const prismaError = error as { code?: string; meta?: unknown };

      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          { error: 'Account already exists' },
          { status: 409 }
        );
      }

      // P2022: Column does not exist (schema mismatch)
      if (prismaError.code === 'P2022') {
        log.error({ meta: prismaError.meta }, 'Database schema mismatch - column missing');
        return NextResponse.json(
          { error: 'Database configuration error', details: 'Schema mismatch' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
