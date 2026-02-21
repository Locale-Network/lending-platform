import { PlaidWebhookCode, PlaidWebhookType } from '@/constants/webhook.enum';
import {
  updateStatusOfKycVerification as dbUpdateStatusOfKycVerification,
  incrementAttemptsCountOfKycVerification as dbIncrementAttemptsCountOfKycVerification,
  getKycVerification,
} from '@/services/db/plaid/kyc';
import { NextRequest, NextResponse } from 'next/server';
import plaidClient from '@/utils/plaid';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders } from '@/lib/rate-limit';
import { mintBorrowerCredential, mintInvestorCredential, AccreditationLevel } from '@/services/nft/mintCredential';
import prisma from '@prisma/index';
import { verifyPlaidWebhook } from '@/lib/plaid-webhook-verify';
import { checkAndMarkWebhook } from '@/lib/webhook-dedup';

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

  // If KYC is successful, mint both BorrowerCredential and InvestorCredential NFTs
  if (status === 'success') {
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

    // Check existing credentials (idempotency)
    const account = await prisma.account.findUnique({
      where: { address: normalizedAddress },
    });

    // Mint BorrowerCredential if not already present
    // Use updateMany with WHERE condition as optimistic lock to prevent race conditions
    if (!account?.borrowerNFTTokenId) {
      try {
        const mintResult = await mintBorrowerCredential({
          to: normalizedAddress,
          plaidVerificationId: webhookData.identity_verification_id,
        });

        if (mintResult.success && mintResult.tokenId) {
          // Optimistic lock: only update if borrowerNFTTokenId is still null
          const updated = await prisma.account.updateMany({
            where: { address: normalizedAddress, borrowerNFTTokenId: null },
            data: { borrowerNFTTokenId: mintResult.tokenId },
          });

          if (updated.count > 0) {
            console.log(
              `[KYC Webhook] BorrowerCredential minted: tokenId=${mintResult.tokenId}, address=${normalizedAddress}`
            );
          } else {
            console.log('[KYC Webhook] BorrowerCredential already set by concurrent process, skipping DB update');
          }
        } else {
          console.error('[KYC Webhook] Failed to mint BorrowerCredential:', mintResult.error);
        }
      } catch (error) {
        console.error('[KYC Webhook] Error minting BorrowerCredential:', error);
      }
    } else {
      console.log('[KYC Webhook] User already has BorrowerCredential, skipping mint');
    }

    // Mint InvestorCredential if not already present
    if (!account?.investorNFTTokenId) {
      try {
        const investorMintResult = await mintInvestorCredential({
          to: normalizedAddress,
          accreditationLevel: AccreditationLevel.RETAIL,
          validityPeriod: 365 * 24 * 60 * 60, // 1 year
          investmentLimit: 0,
          plaidVerificationId: webhookData.identity_verification_id,
        });

        if (investorMintResult.success && investorMintResult.tokenId) {
          // Optimistic lock: only update if investorNFTTokenId is still null
          const updated = await prisma.account.updateMany({
            where: { address: normalizedAddress, investorNFTTokenId: null },
            data: { investorNFTTokenId: investorMintResult.tokenId },
          });

          if (updated.count > 0) {
            console.log(
              `[KYC Webhook] InvestorCredential minted: tokenId=${investorMintResult.tokenId}, address=${normalizedAddress}`
            );
          } else {
            console.log('[KYC Webhook] InvestorCredential already set by concurrent process, skipping DB update');
          }
        } else {
          console.error('[KYC Webhook] Failed to mint InvestorCredential:', investorMintResult.error);
        }
      } catch (investorError) {
        console.error('[KYC Webhook] Error minting InvestorCredential:', investorError);
      }
    } else {
      console.log('[KYC Webhook] User already has InvestorCredential, skipping mint');
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

    // Read raw body for signature verification
    const rawBody = await req.text();
    const verificationHeader = req.headers.get('plaid-verification');

    // SECURITY: Verify Plaid webhook JWT signature
    const isValid = await verifyPlaidWebhook(rawBody, verificationHeader);
    if (!isValid) {
      console.error('[KYC Webhook] Invalid webhook signature');
      return NextResponse.json(
        { message: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // SECURITY: Parse JSON with explicit error handling
    let webhookData: WebhookData;
    try {
      webhookData = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[KYC Webhook] Invalid JSON body:', parseError);
      return NextResponse.json(
        { message: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // SECURITY: Validate required webhook fields before processing
    if (!webhookData.webhook_code || !webhookData.webhook_type || !webhookData.identity_verification_id) {
      return NextResponse.json(
        { message: 'Invalid webhook payload - missing required fields' },
        { status: 400 }
      );
    }

    // Dedup: prevent duplicate processing (e.g., Plaid retries or rapid-fire webhooks)
    const dedupId = `${webhookData.webhook_code}:${webhookData.identity_verification_id}`;
    const { isNew } = await checkAndMarkWebhook(dedupId, 'plaid-kyc');
    if (!isNew) {
      console.log('[KYC Webhook] Duplicate webhook - already processed:', dedupId);
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
    }

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
        message: 'Webhook processed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    // SECURITY: Log full error internally, return generic message to client
    console.error('[KYC Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { message: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
