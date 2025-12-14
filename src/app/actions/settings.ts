'use server';

import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { z } from 'zod';

// Schema for notification preferences
const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean(),
  investmentUpdates: z.boolean(),
  earningsAlerts: z.boolean(),
  poolUpdates: z.boolean(),
  marketingEmails: z.boolean(),
  // securityAlerts is always true, not user-configurable
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

export type NotificationPreferences = {
  emailNotifications: boolean;
  investmentUpdates: boolean;
  earningsAlerts: boolean;
  poolUpdates: boolean;
  marketingEmails: boolean;
  securityAlerts: boolean;
};

export type UpdateNotificationPreferencesResult = {
  success: boolean;
  message: string;
  preferences?: NotificationPreferences;
};

/**
 * Get notification preferences for the current user
 * Creates default preferences if none exist
 */
export async function getNotificationPreferencesAction(): Promise<NotificationPreferences | null> {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return null;
    }

    // Try to find existing preferences
    let preferences = await prisma.notificationPreferences.findUnique({
      where: { accountAddress: session.address },
    });

    // If no preferences exist, create defaults
    if (!preferences) {
      // Check if account exists first
      const account = await prisma.account.findUnique({
        where: { address: session.address },
      });

      if (!account) {
        return null;
      }

      preferences = await prisma.notificationPreferences.create({
        data: {
          accountAddress: session.address,
          emailNotifications: true,
          investmentUpdates: true,
          earningsAlerts: true,
          poolUpdates: false,
          marketingEmails: false,
          securityAlerts: true,
        },
      });
    }

    return {
      emailNotifications: preferences.emailNotifications,
      investmentUpdates: preferences.investmentUpdates,
      earningsAlerts: preferences.earningsAlerts,
      poolUpdates: preferences.poolUpdates,
      marketingEmails: preferences.marketingEmails,
      securityAlerts: preferences.securityAlerts,
    };
  } catch (error) {
    console.error('Failed to get notification preferences:', error);
    return null;
  }
}

/**
 * Update notification preferences for the current user
 */
export async function updateNotificationPreferencesAction(
  input: NotificationPreferencesInput
): Promise<UpdateNotificationPreferencesResult> {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return { success: false, message: 'Unauthorized - please sign in' };
    }

    // Validate input
    const validation = notificationPreferencesSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, message: 'Invalid preferences data' };
    }

    const validatedData = validation.data;

    // Upsert preferences (create if not exists, update if exists)
    const preferences = await prisma.notificationPreferences.upsert({
      where: { accountAddress: session.address },
      create: {
        accountAddress: session.address,
        ...validatedData,
        securityAlerts: true, // Always true
      },
      update: {
        ...validatedData,
        securityAlerts: true, // Always true, cannot be disabled
      },
    });

    return {
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: {
        emailNotifications: preferences.emailNotifications,
        investmentUpdates: preferences.investmentUpdates,
        earningsAlerts: preferences.earningsAlerts,
        poolUpdates: preferences.poolUpdates,
        marketingEmails: preferences.marketingEmails,
        securityAlerts: preferences.securityAlerts,
      },
    };
  } catch (error) {
    console.error('Failed to update notification preferences:', error);
    return { success: false, message: 'Failed to update preferences. Please try again.' };
  }
}

/**
 * Get investor verification status
 */
export async function getInvestorVerificationStatusAction(): Promise<{
  isVerified: boolean;
  tokenId: string | null;
  kycStatus: string | null;
}> {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return { isVerified: false, tokenId: null, kycStatus: null };
    }

    const account = await prisma.account.findUnique({
      where: { address: session.address },
      select: {
        investorNFTTokenId: true,
        KYCVerification: {
          select: {
            status: true,
          },
        },
      },
    });

    return {
      isVerified: !!account?.investorNFTTokenId,
      tokenId: account?.investorNFTTokenId || null,
      kycStatus: account?.KYCVerification?.status || null,
    };
  } catch (error) {
    console.error('Failed to get investor verification status:', error);
    return { isVerified: false, tokenId: null, kycStatus: null };
  }
}
