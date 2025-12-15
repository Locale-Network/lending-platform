import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import { Role } from '@prisma/client';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * Auth Sync Endpoint
 *
 * Syncs authentication data from Privy to the database.
 * This endpoint is called after successful Privy authentication.
 *
 * Flow:
 * 1. User authenticates via Privy (email/social/passkey/wallet)
 * 2. Client gets wallet address and Privy user ID
 * 3. Client calls this endpoint with auth data
 * 4. Server syncs data to accounts table via Prisma
 *
 * Security:
 * - Uses Prisma (direct PostgreSQL, bypasses Supabase RLS)
 * - Rate limited to prevent abuse
 */

interface SyncRequest {
  address: string;
  privyUserId: string;
  email?: string;
  authProvider: 'email' | 'google' | 'apple' | 'passkey' | 'wallet';
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for auth sync endpoint (more permissive than login/signup)
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(clientIp, rateLimits.authSync);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const body: SyncRequest = await request.json();
    const { address, privyUserId, email, authProvider } = body;

    // Validate required fields
    if (!address || !privyUserId || !authProvider) {
      return NextResponse.json(
        { error: 'Missing required fields: address, privyUserId, authProvider' },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();

    // Check for existing account by BOTH address AND Privy user ID
    // This prevents unique constraint violations when a user connects with a different wallet
    const [existingByAddress, existingByPrivyId] = await Promise.all([
      prisma.account.findUnique({
        where: { address: normalizedAddress },
      }),
      prisma.account.findUnique({
        where: { privyUserId: privyUserId },
      }),
    ]);

    // Case 1: Account exists with this address
    if (existingByAddress) {
      console.log('[AuthSync] Found existing account by address:', {
        address: existingByAddress.address,
        existingRole: existingByAddress.role,
        existingPrivyId: existingByAddress.privyUserId,
        incomingPrivyId: privyUserId,
      });

      // Check if this account is already linked to a DIFFERENT Privy user
      // If so, reject the sync - this wallet belongs to another Privy account
      if (existingByAddress.privyUserId && existingByAddress.privyUserId !== privyUserId) {
        console.log('[AuthSync] Wallet already linked to different Privy account');
        return NextResponse.json(
          {
            error: 'This wallet is already linked to a different account',
            message: 'This wallet address is registered to another user. Please use a different wallet or contact support.',
          },
          { status: 409 }
        );
      }

      // Safe to update - either no existing Privy ID or same Privy ID
      const updatedAccount = await prisma.account.update({
        where: { address: normalizedAddress },
        data: {
          privyUserId: privyUserId,
          email: email || existingByAddress.email,
          authProvider: authProvider,
        },
        select: {
          address: true,
          role: true,
          email: true,
          privyUserId: true,
        },
      });

      console.log('[AuthSync] Updated account - returning role:', {
        address: updatedAccount.address,
        role: updatedAccount.role,
        rawRecord: JSON.stringify(updatedAccount),
      });

      return NextResponse.json({
        success: true,
        account: {
          address: updatedAccount.address,
          role: updatedAccount.role,
          privyUserId,
        },
      });
    }

    // Case 2: Account exists with this Privy ID but different address
    // This happens when user connects with a new wallet
    if (existingByPrivyId) {
      return NextResponse.json(
        {
          error: 'Account already exists with a different wallet address',
          existingAddress: existingByPrivyId.address,
          message: 'Please connect with your original wallet, or contact support to merge accounts',
        },
        { status: 409 } // Conflict
      );
    }

    // Case 3: Brand new user - create account with INVESTOR role
    const newAccount = await prisma.account.create({
      data: {
        address: normalizedAddress,
        privyUserId: privyUserId,
        email: email || null,
        authProvider: authProvider,
        role: Role.INVESTOR, // Default role for new users
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        address: newAccount.address,
        role: newAccount.role,
        privyUserId,
      },
      isNewUser: true,
    });
  } catch (error) {
    console.error('Auth sync error:', error);

    // Provide more detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'Error';

    // Check for specific Prisma errors
    if (errorName === 'PrismaClientKnownRequestError') {
      const prismaError = error as { code?: string; meta?: Record<string, unknown> };
      console.error('Prisma error details:', { code: prismaError.code, meta: prismaError.meta });

      if (prismaError.code === 'P2002') {
        // Unique constraint violation
        return NextResponse.json(
          {
            error: 'Account already exists',
            details: 'A unique constraint was violated',
            code: prismaError.code
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        errorType: process.env.NODE_ENV === 'development' ? errorName : undefined
      },
      { status: 500 }
    );
  }
}
