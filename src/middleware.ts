import { withAuth } from 'next-auth/middleware';
import { authPages, ROLE_REDIRECTS, ROLE_ACCESS } from '@/app/api/auth/auth-pages';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export default withAuth(
  // The middleware function will only be invoked if the authorized callback returns true.
  async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      return NextResponse.redirect(new URL('/signin', req.url));
    }

    const role = token.role || 'BORROWER';
    const pathRole = req.nextUrl.pathname.split('/')[1];

    if (!role) {
      return NextResponse.redirect(new URL('/signin', req.url));
    }

    const allowedPaths = ROLE_ACCESS[role as keyof typeof ROLE_ACCESS] || [];
    if (!allowedPaths.includes(pathRole.toLowerCase())) {
      return NextResponse.redirect(new URL(ROLE_REDIRECTS[role], req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: authPages,
  }
);

// routes that will invoke the middleware
export const config = {
  matcher: ['/borrower/:path*', '/approver/:path*', '/admin/:path*', '/'],
};
