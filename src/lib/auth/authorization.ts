import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/auth-options';
import { redirect } from 'next/navigation';
import {
  checkBorrowerSBT,
  checkInvestorSBT,
  isTestingMode,
} from '@/lib/nft/soulbound-checker';

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
 * Get current session or throw error
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (!session || !session.address) {
    redirect('/signin');
  }

  return session;
}

/**
 * Require specific role or redirect to unauthorized page
 */
export async function requireRole(role: Role) {
  const session = await requireAuth();

  if (!hasRole(session.user.role, role)) {
    redirect('/unauthorized');
  }

  return session;
}

/**
 * Require any of the specified roles
 */
export async function requireAnyRole(roles: Role[]) {
  const session = await requireAuth();

  if (!hasAnyRole(session.user.role, roles)) {
    redirect('/unauthorized');
  }

  return session;
}

/**
 * Get session without requiring auth (returns null if not authenticated)
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Check if current user can access admin routes
 */
export async function requireAdmin() {
  return await requireRole(Role.ADMIN);
}

/**
 * Check if current user can access approver routes
 */
export async function requireApprover() {
  return await requireAnyRole([Role.ADMIN, Role.APPROVER]);
}

/**
 * Check if current user can access investor routes
 *
 * NOTE: Investor routes are now open to all authenticated users.
 * This function is kept for backwards compatibility but only requires basic auth.
 * Actual staking actions require Investor SBT verification (see checkInvestorSBT below).
 */
export async function requireInvestor() {
  // Changed to only require basic authentication
  // All users can VIEW investor pages, but only those with Investor SBT can STAKE
  return await requireAuth();
}

/**
 * Check if current user can access borrower routes
 */
export async function requireBorrower() {
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
