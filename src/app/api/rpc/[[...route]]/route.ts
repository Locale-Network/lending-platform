import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

// RPC rate limit: 200 requests per minute per IP
// More generous than API because RPC is needed for wallet operations
const RPC_RATE_LIMIT = { limit: 200, windowSeconds: 60 };

/**
 * API Route for Alchemy Account Kit RPC and Signer API calls
 *
 * This route proxies all requests from the client to Alchemy's infrastructure.
 * Required for SSR support to ensure consistent state between server and client.
 *
 * Handles:
 * - Standard RPC calls (eth_call, eth_sendTransaction, etc.)
 * - Signer API calls (signer-config, authentication, etc.)
 *
 * Rate limiting prevents a single user from exhausting Alchemy quota.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ route?: string[] }> }
) {
  // Rate limit by client IP
  const clientIp = await getClientIp();
  const rateLimitResult = await checkRateLimit(`rpc:${clientIp}`, RPC_RATE_LIMIT);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'RPC rate limit exceeded. Please wait before making more requests.' },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Alchemy API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { route: routeParam } = await params;
    const route = routeParam || [];

    // SECURITY: Validate route segments to prevent SSRF
    // Only allow alphanumeric, hyphens, and specific signer API paths
    const ALLOWED_ROUTE_PATTERN = /^[a-zA-Z0-9\-]+$/;
    for (const segment of route) {
      if (!ALLOWED_ROUTE_PATTERN.test(segment)) {
        return NextResponse.json(
          { error: 'Invalid route segment' },
          { status: 400 }
        );
      }
    }

    // Determine if this is a signer API call or RPC call
    const isSignerAPI = route.includes('signer');

    let alchemyUrl: string;

    if (isSignerAPI) {
      // SECURITY: Whitelist allowed signer API paths to prevent SSRF
      const allowedPrefixes = ['signer/v1/'];
      const path = route.join('/');
      const isAllowed = allowedPrefixes.some(prefix => path.startsWith(prefix));
      if (!isAllowed) {
        return NextResponse.json(
          { error: 'Invalid signer API path' },
          { status: 400 }
        );
      }
      alchemyUrl = `https://api.g.alchemy.com/${path}`;
    } else {
      // Standard RPC calls - no user input in URL
      const network = process.env.NODE_ENV === 'production' ? 'arb-mainnet' : 'arb-sepolia';
      alchemyUrl = `https://${network}.g.alchemy.com/v2/${apiKey}`;
    }

    // Forward the request to Alchemy
    const response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isSignerAPI && { 'Authorization': `Bearer ${apiKey}` }),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Return the response with appropriate status code
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Alchemy API request failed:', error);
    return NextResponse.json(
      { error: 'API request failed' },
      { status: 500 }
    );
  }
}

// Also handle GET requests for signer config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ route?: string[] }> }
) {
  // Rate limit by client IP
  const clientIp = await getClientIp();
  const rateLimitResult = await checkRateLimit(`rpc:${clientIp}`, RPC_RATE_LIMIT);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'RPC rate limit exceeded. Please wait before making more requests.' },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Alchemy API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { route: routeParam } = await params;
    const route = routeParam || [];

    // SECURITY: Validate route segments to prevent SSRF
    const ALLOWED_ROUTE_PATTERN = /^[a-zA-Z0-9\-]+$/;
    for (const segment of route) {
      if (!ALLOWED_ROUTE_PATTERN.test(segment)) {
        return NextResponse.json(
          { error: 'Invalid route segment' },
          { status: 400 }
        );
      }
    }

    // SECURITY: Whitelist allowed signer API paths to prevent SSRF
    const path = route.join('/');
    const allowedPrefixes = ['signer/v1/'];
    const isAllowed = allowedPrefixes.some(prefix => path.startsWith(prefix));
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Invalid signer API path' },
        { status: 400 }
      );
    }

    const alchemyUrl = `https://api.g.alchemy.com/${path}`;

    const response = await fetch(alchemyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Alchemy API request failed:', error);
    return NextResponse.json(
      { error: 'API request failed' },
      { status: 500 }
    );
  }
}
