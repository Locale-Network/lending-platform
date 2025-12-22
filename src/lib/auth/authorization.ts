import { Role } from '@prisma/client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PrivyClient } from '@privy-io/server-auth';
import prisma from '@prisma/index';
import {
  checkBorrowerSBT,
  checkInvestorSBT,
  isTestingMode,
} from '@/lib/nft/soulbound-checker';

// Initialize Privy server client
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;

let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient | null {
  if (!privyAppId || !privyAppSecret) {
    console.warn('Privy credentials not configured');
    return null;
  }
  if (!privyClient) {
    privyClient = new PrivyClient(privyAppId, privyAppSecret);
  }
  return privyClient;
}

/**
 * Session type for Privy-based authentication
 */
export interface PrivySession {
  address: string;
  privyUserId: string;
  email?: string;
  user: {
    role: Role;
    name?: string;
  };
}

/**
 * Role hierarchy - higher roles inherit permissions from lower roles
 */
const roleHierarchy: Record<Role, Role[]> = {
  [Role.ADMIN]: [Role.ADMIN, Role.APPROVER, Role.BORROWER, Role.INVESTOR],
  [Role.APPROVER]: [Role.APPROVER, Role.BORROWER],
  [Role.INVESTOR]: [Role.INVESTOR],
  [Role.BORROWER]: [Role.BORROWER],
};

/**
 * Check if user has required role (considering hierarchy)
 */
export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return roleHierarchy[userRole]?.includes(requiredRole) ?? false;
}

/**
 * Check if user has any of the required roles
 */
export function hasAnyRole(userRole: Role, requiredRoles: Role[]): boolean {
  return requiredRoles.some((role) => hasRole(userRole, role));
}

/**
 * Get the Privy auth token from cookies
 */
async function getPrivyAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  // Privy stores the auth token in privy-token cookie
  const privyToken = cookieStore.get('privy-token')?.value;
  return privyToken || null;
}

/**
 * Verify Privy token and get user data
 */
async function verifyPrivyToken(token: string): Promise<{ userId: string; walletAddress?: string } | null> {
  const client = getPrivyClient();
  if (!client) return null;

  try {
    const verifiedClaims = await client.verifyAuthToken(token);
    return {
      userId: verifiedClaims.userId,
      walletAddress: undefined, // Will be fetched from user data
    };
  } catch (error) {
    console.error('Failed to verify Privy token:', error);
    return null;
  }
}

/**
 * Get user data from Privy
 */
async function getPrivyUser(userId: string): Promise<{ address?: string; email?: string } | null> {
  const client = getPrivyClient();
  if (!client) return null;

  try {
    const user = await client.getUser(userId);

    // Get wallet address from linked accounts
    const walletAccount = user.linkedAccounts.find(
      (account) => account.type === 'wallet'
    );

    // Get email from linked accounts
    const emailAccount = user.linkedAccounts.find(
      (account) => account.type === 'email'
    );

    return {
      address: walletAccount?.address,
      email: emailAccount?.address,
    };
  } catch (error) {
    console.error('Failed to get Privy user:', error);
    return null;
  }
}

/**
 * Get account from database by address using Prisma
 * Uses case-insensitive matching since EVM addresses are case-insensitive
 */
async function getAccountByAddress(address: string): Promise<{ role: Role; email?: string } | null> {
  try {
    // Normalize address to lowercase for consistent matching
    const normalizedAddress = address.toLowerCase();

    // Use Prisma for consistent database access (same as auth/sync endpoint)
    const account = await prisma.account.findUnique({
      where: { address: normalizedAddress },
      select: { role: true, email: true, address: true },
    });

    if (!account) {
      return null;
    }

    return {
      role: account.role,
      email: account.email || undefined,
    };
  } catch (error) {
    console.error('[getAccountByAddress] Prisma query error:', error);
    return null;
  }
}

/**
 * Get current session from Privy token
 * Returns null if not authenticated
 */
export async function getSession(): Promise<PrivySession | null> {
  try {
    const token = await getPrivyAuthToken();
    if (!token) {
      console.log('[getSession] No Privy token found');
      return null;
    }

    const verifiedClaims = await verifyPrivyToken(token);
    if (!verifiedClaims) {
      console.log('[getSession] Failed to verify Privy token');
      return null;
    }

    const privyUser = await getPrivyUser(verifiedClaims.userId);
    if (!privyUser?.address) {
      console.log('[getSession] No wallet address from Privy user');
      return null;
    }

    const account = await getAccountByAddress(privyUser.address);

    return {
      address: privyUser.address,
      privyUserId: verifiedClaims.userId,
      email: privyUser.email,
      user: {
        role: account?.role || Role.INVESTOR,
        name: privyUser.address,
      },
    };
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * Get current session or redirect to signin
 */
export async function requireAuth(): Promise<PrivySession> {
  const session = await getSession();

  if (!session || !session.address) {
    redirect('/signin');
  }

  return session;
}

/**
 * Require specific role or redirect to unauthorized page
 */
export async function requireRole(role: Role): Promise<PrivySession> {
  const session = await requireAuth();

  if (!hasRole(session.user.role, role)) {
    redirect('/unauthorized');
  }

  return session;
}

/**
 * Require any of the specified roles
 */
export async function requireAnyRole(roles: Role[]): Promise<PrivySession> {
  const session = await requireAuth();

  if (!hasAnyRole(session.user.role, roles)) {
    redirect('/unauthorized');
  }

  return session;
}

/**
 * Check if current user can access admin routes
 */
export async function requireAdmin(): Promise<PrivySession> {
  return await requireRole(Role.ADMIN);
}

/**
 * Check if current user can access approver routes
 */
export async function requireApprover(): Promise<PrivySession> {
  return await requireAnyRole([Role.ADMIN, Role.APPROVER]);
}

/**
 * Check if current user can access investor routes
 *
 * NOTE: Investor routes are now open to all authenticated users.
 * This function is kept for backwards compatibility but only requires basic auth.
 * Actual staking actions require Investor SBT verification (see checkInvestorSBT below).
 */
export async function requireInvestor(): Promise<PrivySession> {
  // Changed to only require basic authentication
  // All users can VIEW investor pages, but only those with Investor SBT can STAKE
  return await requireAuth();
}

/**
 * Check if current user can access borrower routes
 */
export async function requireBorrower(): Promise<PrivySession> {
  return await requireAnyRole([Role.ADMIN, Role.BORROWER]);
}

// ============================================
// SOULBOUND NFT (SBT) VERIFICATION
// ============================================

/**
 * Verify user owns Investor Soulbound NFT
 *
 * This check is used for STAKING ACTIONS only, not route access.
 * All authenticated users can VIEW investor pages, but only those
 * with an Investor SBT (issued after KYC/AML) can stake funds.
 *
 * @param address - Wallet address to verify
 * @returns Object with verification status and optional error message
 */
export async function verifyInvestorSBT(address: string): Promise<{
  hasAccess: boolean;
  message?: string;
}> {
  // Check if testing mode is enabled
  if (isTestingMode()) {
    return {
      hasAccess: true,
      message: '🚧 Testing mode: Investor SBT check bypassed',
    };
  }

  // Check for Investor SBT ownership
  const hasInvestorSBT = await checkInvestorSBT(address);

  if (!hasInvestorSBT) {
    return {
      hasAccess: false,
      message:
        'You need to complete KYC/AML verification to stake funds. Visit your profile to get started.',
    };
  }

  return { hasAccess: true };
}

/**
 * Verify user owns Borrower Soulbound NFT
 *
 * This check is used for LOAN APPLICATION ACTIONS only, not route access.
 * All authenticated users can VIEW borrower pages, but only those
 * with a Borrower SBT (issued after KYC/AML) can submit loan applications.
 *
 * @param address - Wallet address to verify
 * @returns Object with verification status and optional error message
 */
export async function verifyBorrowerSBT(address: string): Promise<{
  hasAccess: boolean;
  message?: string;
}> {
  // Check if testing mode is enabled
  if (isTestingMode()) {
    return {
      hasAccess: true,
      message: '🚧 Testing mode: Borrower SBT check bypassed',
    };
  }

  // Check for Borrower SBT ownership
  const hasBorrowerSBT = await checkBorrowerSBT(address);

  if (!hasBorrowerSBT) {
    return {
      hasAccess: false,
      message:
        'You need to complete KYC/AML verification to apply for loans. Visit your profile to get started.',
    };
  }

  return { hasAccess: true };
}
