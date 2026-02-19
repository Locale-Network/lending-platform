import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import {
  mintInvestorCredential,
  hasValidInvestorCredential,
  getInvestorTokenId,
  AccreditationLevel,
} from '@/services/nft/mintCredential';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * POST /api/investor/verify
 *
 * Initiates or completes investor verification.
 *
 * For MVP: Issues investor credential directly (bypasses full KYC if DISABLE_SBT_CHECKS is set)
 * For Production: Would integrate with Plaid Identity Verification
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json(
        { error: 'Unauthorized - please connect your wallet' },
        { status: 401 }
      );
    }

    const address = session.address;
    const dbAddress = address.toLowerCase();

    // SECURITY: Rate limiting on NFT minting (expensive on-chain operation)
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      `investor-verify:${address}`,
      { limit: 3, windowSeconds: 86400 } // 3 mints per day (handles retries)
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again tomorrow.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    // Check if already verified
    const account = await prisma.account.findUnique({
      where: { address: dbAddress },
      include: {
        KYCVerification: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Check if already has a valid credential on-chain
    if (account.investorNFTTokenId) {
      const isValid = await hasValidInvestorCredential(address);
      if (isValid) {
        return NextResponse.json({
          success: true,
          message: 'Already verified',
          tokenId: account.investorNFTTokenId,
          alreadyVerified: true,
        });
      }
    }

    // For MVP: Check if SBT checks are disabled (bypass full KYC)
    // SECURITY: Block this bypass in production to prevent accidental deployment
    const disableSBTChecks =
      process.env.DISABLE_SBT_CHECKS === 'true' &&
      process.env.NODE_ENV !== 'production';

    if (process.env.DISABLE_SBT_CHECKS === 'true' && process.env.NODE_ENV === 'production') {
      console.warn(
        '[SECURITY] DISABLE_SBT_CHECKS=true is ignored in production. Remove this env var.'
      );
    }

    if (disableSBTChecks) {
      // MVP Mode: Issue credential without full KYC
      // Generate a verification ID for tracking
      const verificationId = `mvp-${Date.now()}-${address.slice(0, 8)}`;

      const result = await mintInvestorCredential({
        to: address,
        accreditationLevel: AccreditationLevel.RETAIL, // Default to retail for MVP
        validityPeriod: 365 * 24 * 60 * 60, // 1 year
        investmentLimit: 0, // Unlimited for MVP
        plaidVerificationId: verificationId,
      });

      if (result.success && result.tokenId) {
        // Update account with token ID
        await prisma.account.update({
          where: { address: dbAddress },
          data: { investorNFTTokenId: result.tokenId },
        });

        return NextResponse.json({
          success: true,
          message: 'Investor credential issued successfully',
          tokenId: result.tokenId,
          txHash: result.txHash,
        });
      } else {
        return NextResponse.json(
          { error: result.error || 'Failed to mint credential' },
          { status: 500 }
        );
      }
    }

    // Production Mode: Require Plaid KYC verification first
    // Check KYC status
    if (!account.KYCVerification || account.KYCVerification.status !== 'success') {
      return NextResponse.json({
        success: false,
        requiresKYC: true,
        message: 'Please complete identity verification first',
        kycStatus: account.KYCVerification?.status || null,
      });
    }

    // KYC is complete, issue credential
    const verificationId = account.KYCVerification.identityVerificationId;

    const result = await mintInvestorCredential({
      to: address,
      accreditationLevel: AccreditationLevel.RETAIL,
      validityPeriod: 365 * 24 * 60 * 60,
      investmentLimit: 0,
      plaidVerificationId: verificationId,
    });

    if (result.success && result.tokenId) {
      // Update account with token ID
      await prisma.account.update({
        where: { address: dbAddress },
        data: { investorNFTTokenId: result.tokenId },
      });

      return NextResponse.json({
        success: true,
        message: 'Investor credential issued successfully',
        tokenId: result.tokenId,
        txHash: result.txHash,
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to mint credential' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[/api/investor/verify] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/investor/verify
 *
 * Check investor verification status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const address = session.address;
    const dbAddress = address.toLowerCase();

    // SECURITY: Rate limiting on verification status checks
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      `investor-verify-status:${address}`,
      rateLimits.api // 100 requests per minute
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    // Get account info
    const account = await prisma.account.findUnique({
      where: { address: dbAddress },
      include: {
        KYCVerification: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Check on-chain status
    let isVerified = false;
    let tokenId: string | null = null;

    if (account.investorNFTTokenId) {
      isVerified = await hasValidInvestorCredential(address);
      tokenId = isVerified ? account.investorNFTTokenId : null;
    } else {
      // Check if credential exists on-chain but not in DB
      const onChainTokenId = await getInvestorTokenId(address);
      if (onChainTokenId !== '0') {
        isVerified = await hasValidInvestorCredential(address);
        tokenId = isVerified ? onChainTokenId : null;

        // Sync to database if found
        if (isVerified) {
          await prisma.account.update({
            where: { address: dbAddress },
            data: { investorNFTTokenId: onChainTokenId },
          });
        }
      }
    }

    return NextResponse.json({
      isVerified,
      tokenId,
      kycStatus: account.KYCVerification?.status || null,
      requiresKYC: !isVerified && !(process.env.DISABLE_SBT_CHECKS === 'true' && process.env.NODE_ENV !== 'production'),
    });
  } catch (error) {
    console.error('[/api/investor/verify GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
