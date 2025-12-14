import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route for Alchemy Account Kit RPC and Signer API calls
 *
 * This route proxies all requests from the client to Alchemy's infrastructure.
 * Required for SSR support to ensure consistent state between server and client.
 *
 * Handles:
 * - Standard RPC calls (eth_call, eth_sendTransaction, etc.)
 * - Signer API calls (signer-config, authentication, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ route?: string[] }> }
) {
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

    // Determine if this is a signer API call or RPC call
    const isSignerAPI = route.includes('signer');

    let alchemyUrl: string;

    if (isSignerAPI) {
      // Signer API endpoints use a different base URL
      // Route comes in as ['signer', 'v1', 'signer-config'] so we join and use as-is
      const path = route.join('/');
      alchemyUrl = `https://api.g.alchemy.com/${path}`;
    } else {
      // Standard RPC calls
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
  _request: NextRequest,
  { params }: { params: Promise<{ route?: string[] }> }
) {
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
    const path = route.join('/');

    // Signer API GET endpoint - route already includes signer/v1
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
