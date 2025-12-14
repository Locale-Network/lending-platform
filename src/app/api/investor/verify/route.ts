import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import {
  mintInvestorCredential,
  hasValidInvestorCredential,
  getInvestorTokenId,
  AccreditationLevel,
} from '@/services/nft/mintCredential';

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

    // Check if already verified
    const account = await prisma.account.findUnique({
      where: { address },
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
    const disableSBTChecks = process.env.DISABLE_SBT_CHECKS === 'true';

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
          where: { address },
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
        where: { address },
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

    // Get account info
    const account = await prisma.account.findUnique({
      where: { address },
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
            where: { address },
            data: { investorNFTTokenId: onChainTokenId },
          });
        }
      }
    }

    return NextResponse.json({
      isVerified,
      tokenId,
      kycStatus: account.KYCVerification?.status || null,
      requiresKYC: !isVerified && process.env.DISABLE_SBT_CHECKS !== 'true',
    });
  } catch (error) {
    console.error('[/api/investor/verify GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
