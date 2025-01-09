import { Role } from '@prisma/client';
import { PagesOptions } from 'next-auth';

export const authPages: Partial<PagesOptions> = {
  signIn: '/signin',
  signOut: '/signin',
};

export const ROLE_REDIRECTS: Record<Role, string> = {
  BORROWER: '/borrower',
  APPROVER: '/approver',
  ADMIN: '/admin',
} as const;

export const ROLE_ACCESS: Record<Role, string[]> = {
  ADMIN: ['admin', 'approver'], // Admin can access admin and approver routes
  APPROVER: ['approver'], // Approver can only access approver routes
  BORROWER: ['borrower'], // Borrower can only access borrower routes
} as const;
