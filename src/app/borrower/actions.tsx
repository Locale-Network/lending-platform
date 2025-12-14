'use server';
import { getSession } from '@/lib/auth/authorization';
import { Role } from '@prisma/client';
import { isAddress } from 'viem';
import { redirect } from 'next/navigation';

export async function validateRequest(accountAddress: string) {
  const session = await getSession();

  if (!session) {
    redirect('/sign-in');
  }

  // Allow BORROWER and ADMIN roles (matching the layout permissions)
  const allowedRoles: Role[] = [Role.BORROWER, Role.ADMIN];
  if (!allowedRoles.includes(session.user.role)) {
    redirect('/unauthorized');
  }

  if (session?.address !== accountAddress) {
    throw new Error('User address does not match chain account address');
  }

  if (!isAddress(accountAddress)) {
    throw new Error('Invalid chain account address');
  }
}
