import { PlaidWebhookCode, PlaidWebhookType } from '@/constants/webhook.enum';
import {
  updateStatusOfKycVerification as dbUpdateStatusOfKycVerification,
  incrementAttemptsCountOfKycVerification as dbIncrementAttemptsCountOfKycVerification,
  getKycVerification,
} from '@/services/db/plaid/kyc';
import { NextRequest, NextResponse } from 'next/server';
import plaidClient from '@/utils/plaid';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders } from '@/lib/rate-limit';
import { mintBorrowerCredential } from '@/services/nft/mintCredential';
import prisma from '@prisma/index';

interface WebhookData {
  environment: string;
  identity_verification_id: string;
  webhook_code: PlaidWebhookCode;
  webhook_type: PlaidWebhookType;
}

const handleRetriedWebhook = async (webhookData: WebhookData) => {
  await dbIncrementAttemptsCountOfKycVerification(webhookData.identity_verification_id);
};

const handleStatusUpdatedWebhook = async (webhookData: WebhookData) => {
  const identityVerificationResponse = await plaidClient.identityVerificationGet({
    identity_verification_id: webhookData.identity_verification_id,
  });

  const status = identityVerificationResponse.data.status;

  // Update the KYC status in the database
  await dbUpdateStatusOfKycVerification({
    identityVerificationId: webhookData.identity_verification_id,
    status,
  });

  // If KYC is successful, mint the BorrowerCredential NFT
  if (status === 'success') {
    try {
      // Get the KYC record to find the user's address
      const kycRecord = await getKycVerification({
        identityVerificationId: webhookData.identity_verification_id,
      });

      if (!kycRecord) {
        console.error('[KYC Webhook] KYC record not found for minting');
        return;
      }

      // Normalize address to lowercase (should already be lowercase from KYC creation)
      const normalizedAddress = kycRecord.accountAddress.toLowerCase();

      // Check if user already has a credential (idempotency)
      const account = await prisma.account.findUnique({
        where: { address: normalizedAddress },
      });

      if (account?.borrowerNFTTokenId) {
        console.log('[KYC Webhook] User already has BorrowerCredential, skipping mint');
        return;
      }

      // Mint the BorrowerCredential
      const mintResult = await mintBorrowerCredential({
        to: normalizedAddress,
        plaidVerificationId: webhookData.identity_verification_id,
      });

      if (mintResult.success && mintResult.tokenId) {
        // Store the token ID in the database
        await prisma.account.update({
          where: { address: normalizedAddress },
          data: { borrowerNFTTokenId: mintResult.tokenId },
        });

        console.log(
          `[KYC Webhook] BorrowerCredential minted: tokenId=${mintResult.tokenId}, address=${normalizedAddress}`
        );
      } else {
        console.error('[KYC Webhook] Failed to mint BorrowerCredential:', mintResult.error);
      }
    } catch (error) {
      // Log the error but don't fail the webhook
      // The KYC status has already been updated successfully
      console.error('[KYC Webhook] Error minting BorrowerCredential:', error);
    }
  }
};

export async function POST(req: NextRequest) {
  try {
    // Rate limiting for webhook endpoint
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(clientIp, rateLimits.webhook);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const webhookData: WebhookData = await req.json();

    switch (webhookData.webhook_code) {
      case PlaidWebhookCode.RETRIED:
        await handleRetriedWebhook(webhookData);
        break;
      case PlaidWebhookCode.STATUS_UPDATED:
        await handleStatusUpdatedWebhook(webhookData);
        break;
    }

    return NextResponse.json(
      {
        message: `Webhook ${webhookData.webhook_type}:${webhookData.webhook_code} processed successfully`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { message: `Webhook failed to process: ${error.message}` },
      { status: 500 }
    );
  }
}
