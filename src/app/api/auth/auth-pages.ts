import { Role } from '@prisma/client';

/**
 * Auth pages configuration
 */
export const authPages = {
  signIn: '/signin',
  signOut: '/signin',
} as const;

/**
 * Role-based redirects after authentication
 */
export const ROLE_REDIRECTS: Record<Role, string> = {
  INVESTOR: '/explore',
  BORROWER: '/borrower',
  APPROVER: '/approver',
  ADMIN: '/admin',
} as const;

/**
 * Role-based access control for routes
 * Maps each role to the route prefixes they can access
 */
export const ROLE_ACCESS: Record<Role, string[]> = {
  ADMIN: ['admin', 'approver'], // Admin can access admin and approver routes
  APPROVER: ['approver'], // Approver can only access approver routes
  INVESTOR: ['explore'], // Investor can only access explore routes (staking pools)
  BORROWER: ['borrower'], // Borrower can only access borrower routes
} as const;
