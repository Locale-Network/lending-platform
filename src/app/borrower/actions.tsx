'use server';
import { authOptions } from '@/app/api/auth/auth-options';
import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { isAddress } from 'viem';
import { redirect } from 'next/navigation';
import { ROLE_REDIRECTS } from '@/app/api/auth/auth-pages';

export async function validateRequest(accountAddress: string) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/sign-in');
  }

  if (session?.user.role !== Role.BORROWER) {
    redirect(ROLE_REDIRECTS[session.user.role]);
  }

  if (session?.address !== accountAddress) {
    throw new Error('User address does not match chain account address');
  }

  if (!isAddress(accountAddress)) {
    throw new Error('Invalid chain account address');
  }
}
