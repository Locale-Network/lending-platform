import { NextRequest, NextResponse } from 'next/server';
import { ROLE_REDIRECTS, ROLE_ACCESS } from '@/app/api/auth/auth-pages';

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Security headers for all responses
 */
function addSecurityHeaders(response: NextResponse, requestId: string): NextResponse {
  // Add request ID for tracing
  response.headers.set('X-Request-Id', requestId);
  // Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter in older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Strict Transport Security (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (disable unused browser features)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  return response;
}

/**
 * Middleware for Privy authentication and security headers
 *
 * This middleware performs lightweight checks on protected routes.
 * Full auth verification happens in the authorization.ts utilities.
 *
 * The Privy token cookie is checked for presence.
 * Role-based access control is handled server-side in page components.
 */
export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Generate request ID for tracing (reuse if already set)
  const requestId = req.headers.get('x-request-id') || generateRequestId();

  // Get Privy auth token from cookies
  const privyToken = req.cookies.get('privy-token')?.value;

  // If no Privy token, redirect to signin for protected routes
  if (!privyToken) {
    // Allow access to signin page (they need to log in)
    if (pathname === '/signin') {
      return addSecurityHeaders(NextResponse.next(), requestId);
    }

    // Allow access to API routes (they handle their own auth)
    if (pathname.startsWith('/api/')) {
      return addSecurityHeaders(NextResponse.next(), requestId);
    }

    // Redirect to signin for protected routes
    return addSecurityHeaders(NextResponse.redirect(new URL('/signin', req.url)), requestId);
  }

  // User has a token - they're authenticated via Privy
  // Note: Role-based redirect is handled client-side by PrivyWalletButton
  // The signin page will load and the client component will redirect based on role

  // If authenticated user is on signin page, let client handle role-based redirect
  // The PrivyWalletButton component will redirect to the appropriate dashboard
  if (pathname === '/signin') {
    // Let the page load - client-side will handle role-based navigation
    return addSecurityHeaders(NextResponse.next(), requestId);
  }

  // Handle root path - redirect to signin, client will redirect to role-appropriate page
  if (pathname === '/') {
    return addSecurityHeaders(NextResponse.redirect(new URL('/signin', req.url)), requestId);
  }

  // Allow the request to proceed - page-level auth will handle role checks
  return addSecurityHeaders(NextResponse.next(), requestId);
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
