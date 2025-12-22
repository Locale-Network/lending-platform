'use server';
import { validateRequest as validateBorrowerRequest } from '@/app/borrower/actions';
import plaidClient from '@/utils/plaid';
import {
  CountryCode,
  IdentityVerificationGetResponse,
  IdentityVerificationRetryResponse,
  Products,
  Strategy,
} from 'plaid';
import {
  getKycVerification as dbGetKycVerification,
  createKycVerification as dbCreateKycVerification,
} from '@/services/db/plaid/kyc';
import { revalidatePath } from 'next/cache';

interface GetKycStatusResponse {
  isError: boolean;
  errorMessage?: string;
  hasAttemptedKyc: boolean;
  identityVerificationData?: IdentityVerificationGetResponse;
}

export async function getIdentityVerificationStatus(
  accountAddress: string
): Promise<GetKycStatusResponse> {
  try {
    await validateBorrowerRequest(accountAddress);
    const kycVerification = await dbGetKycVerification({ accountAddress });

    if (!kycVerification) {
      // No KYC record - user hasn't started verification
      return { isError: false, hasAttemptedKyc: false };
    }

    try {
      // Try to get current status from Plaid
      const identityVerificationResponse = await plaidClient.identityVerificationGet({
        identity_verification_id: kycVerification.identityVerificationId,
      });

      return {
        isError: false,
        hasAttemptedKyc: true,
        identityVerificationData: identityVerificationResponse.data,
      };
    } catch (plaidError) {
      // Plaid API failed - treat as if no KYC so user can restart
      console.error('Plaid identity verification get failed:', plaidError);
      return { isError: false, hasAttemptedKyc: false };
    }
  } catch (error: any) {
    // Re-throw Next.js redirects - they're not actual errors
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    // Only return error for auth failures
    console.error('Error in getIdentityVerificationStatus:', error);
    return {
      isError: true,
      hasAttemptedKyc: false,
      errorMessage: 'Authentication error - please sign in again',
    };
  }
}

interface CreateLinkTokenResponse {
  isError: boolean;
  errorMessage?: string;
  linkToken?: string;
}
export async function createLinkTokenForIdentityVerification(
  accountAddress: string
): Promise<CreateLinkTokenResponse> {
  try {
    await validateBorrowerRequest(accountAddress);

    // Use provided template ID with fallback
    const templateId = process.env.TEMPLATE_ID || 'idvtmp_bY4ArB8RemRoue';

    const response = await plaidClient.linkTokenCreate({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      user: { client_user_id: accountAddress },
      products: [Products.IdentityVerification],
      identity_verification: {
        template_id: templateId,
      },
      country_codes: [CountryCode.Us],
      client_name: 'Locale Lending',
      language: 'en',
    });

    return {
      isError: false,
      linkToken: response.data.link_token,
    };
  } catch (error: any) {
    // Re-throw Next.js redirects - they're not actual errors
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error creating link token:', error);
    return {
      isError: true,
      errorMessage: 'Error creating link token - check Plaid credentials',
    };
  }
}

interface RetryIdentityVerificationResponse {
  isError: boolean;
  errorMessage?: string;
  retryIdentityVerificationData?: IdentityVerificationRetryResponse;
}
export async function retryIdentityVerification(
  accountAddress: string
): Promise<RetryIdentityVerificationResponse> {
  try {
    await validateBorrowerRequest(accountAddress);

    // Use provided template ID with fallback
    const templateId = process.env.TEMPLATE_ID || 'idvtmp_bY4ArB8RemRoue';

    const response = await plaidClient.identityVerificationRetry({
      client_user_id: accountAddress,
      template_id: templateId,
      strategy: Strategy.Reset,
      secret: process.env.PLAID_SECRET,
    });

    return {
      isError: false,
      retryIdentityVerificationData: response.data,
    };
  } catch (error: any) {
    // Re-throw Next.js redirects - they're not actual errors
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error retrying KYC:', error);
    return {
      isError: true,
      errorMessage: 'Error retrying KYC',
    };
  }
}

export const createKycVerificationRecord = async (
  accountAddress: string,
  identityVerificationId: string
) => {
  await dbCreateKycVerification({
    accountAddress,
    identityVerificationId,
  });

  revalidatePath('/borrower/loans/apply');
};

import prisma from '@prisma/index';

interface GetBorrowerNFTResponse {
  isError: boolean;
  errorMessage?: string;
  tokenId?: string | null;
}

export async function getBorrowerNFTTokenId(
  accountAddress: string
): Promise<GetBorrowerNFTResponse> {
  try {
    await validateBorrowerRequest(accountAddress);

    const account = await prisma.account.findUnique({
      where: { address: accountAddress.toLowerCase() },
      select: { borrowerNFTTokenId: true },
    });

    return {
      isError: false,
      tokenId: account?.borrowerNFTTokenId ?? null,
    };
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error getting borrower NFT token ID:', error);
    return {
      isError: true,
      errorMessage: 'Error fetching borrower credential',
    };
  }
}
