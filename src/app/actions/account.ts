'use server';

import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address').or(z.literal(''));

export type UpdateEmailResult = {
  success: boolean;
  message: string;
  email?: string | null;
};

export async function updateEmailAction(email: string): Promise<UpdateEmailResult> {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return { success: false, message: 'Unauthorized - please sign in' };
    }

    // Validate email format
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      return { success: false, message: validation.error.errors[0].message };
    }

    const normalizedEmail = email.trim().toLowerCase() || null;

    // Check if email is already in use by another account
    if (normalizedEmail) {
      const existingAccount = await prisma.account.findFirst({
        where: {
          email: normalizedEmail,
          NOT: { address: session.address },
        },
      });

      if (existingAccount) {
        return { success: false, message: 'This email is already associated with another account' };
      }
    }

    // Update the account email
    const updatedAccount = await prisma.account.update({
      where: { address: session.address },
      data: { email: normalizedEmail },
    });

    return {
      success: true,
      message: normalizedEmail ? 'Email updated successfully' : 'Email removed successfully',
      email: updatedAccount.email,
    };
  } catch (error) {
    console.error('Failed to update email:', error);
    return { success: false, message: 'Failed to update email. Please try again.' };
  }
}

export async function getAccountEmailAction(): Promise<string | null> {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return null;
    }

    const account = await prisma.account.findUnique({
      where: { address: session.address },
      select: { email: true },
    });

    return account?.email ?? null;
  } catch (error) {
    console.error('Failed to get account email:', error);
    return null;
  }
}
