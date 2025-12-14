import { NextRequest, NextResponse } from 'next/server';
import { ROLE_REDIRECTS, ROLE_ACCESS } from '@/app/api/auth/auth-pages';

/**
 * Middleware for Privy authentication
 *
 * This middleware performs lightweight checks on protected routes.
 * Full auth verification happens in the authorization.ts utilities.
 *
 * The Privy token cookie is checked for presence.
 * Role-based access control is handled server-side in page components.
 */
export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Get Privy auth token from cookies
  const privyToken = req.cookies.get('privy-token')?.value;

  // If no Privy token, redirect to signin for protected routes
  if (!privyToken) {
    // Allow access to signin page (they need to log in)
    if (pathname === '/signin') {
      return NextResponse.next();
    }

    // Allow access to API routes (they handle their own auth)
    if (pathname.startsWith('/api/')) {
      return NextResponse.next();
    }

    // Redirect to signin for protected routes
    return NextResponse.redirect(new URL('/signin', req.url));
  }

  // User has a token - they're authenticated via Privy
  // Note: Role-based redirect is handled client-side by PrivyWalletButton
  // The signin page will load and the client component will redirect based on role

  // If authenticated user is on signin page, let client handle role-based redirect
  // The PrivyWalletButton component will redirect to the appropriate dashboard
  if (pathname === '/signin') {
    // Let the page load - client-side will handle role-based navigation
    return NextResponse.next();
  }

  // Handle root path - redirect to signin, client will redirect to role-appropriate page
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/signin', req.url));
  }

  // Allow the request to proceed - page-level auth will handle role checks
  return NextResponse.next();
}

// Routes that will invoke the middleware
export const config = {
  matcher: [
    '/explore/:path*',
    '/borrower/:path*',
    '/approver/:path*',
    '/admin/:path*',
    '/signin',
    '/',
  ],
};
