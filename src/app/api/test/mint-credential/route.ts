import { NextRequest, NextResponse } from 'next/server';
import { mintBorrowerCredential } from '@/services/nft/mintCredential';
import prisma from '@prisma/index';

/**
 * TEST ENDPOINT - Only for development/testing
 * Directly tests the NFT minting flow without requiring Plaid webhook
 *
 * POST /api/test/mint-credential
 * Body: { address: "0x...", identityVerificationId: "idv_..." }
 */
export async function POST(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { address, identityVerificationId } = await req.json();

    if (!address) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // Check if user already has a credential
    const account = await prisma.account.findUnique({
      where: { address: normalizedAddress },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.borrowerNFTTokenId) {
      return NextResponse.json({
        success: true,
        message: 'User already has BorrowerCredential',
        tokenId: account.borrowerNFTTokenId,
      });
    }

    // Mint the BorrowerCredential
    console.log(`[Test Mint] Minting credential for ${normalizedAddress}`);

    const mintResult = await mintBorrowerCredential({
      to: normalizedAddress,
      plaidVerificationId: identityVerificationId || 'test-verification-id',
    });

    if (mintResult.success && mintResult.tokenId) {
      // Store the token ID in the database
      await prisma.account.update({
        where: { address: normalizedAddress },
        data: { borrowerNFTTokenId: mintResult.tokenId },
      });

      // Also update KYC status to success if we have an identityVerificationId
      if (identityVerificationId) {
        await prisma.kYCVerification.update({
          where: { identityVerificationId },
          data: { status: 'success' },
        });
      }

      console.log(`[Test Mint] Success! tokenId=${mintResult.tokenId}, txHash=${mintResult.txHash}`);

      return NextResponse.json({
        success: true,
        tokenId: mintResult.tokenId,
        txHash: mintResult.txHash,
        address: normalizedAddress,
      });
    } else {
      console.error('[Test Mint] Failed:', mintResult.error);
      return NextResponse.json(
        {
          success: false,
          error: mintResult.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Test Mint] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Minting failed',
      },
      { status: 500 }
    );
  }
}
