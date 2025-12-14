import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to fetch blockchain transfers using Alchemy Transfers API
 * This provides blockchain-verified transaction history for user addresses
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const category = searchParams.get('category') || 'external'; // external, internal, erc20, erc721, erc1155
    const contractAddress = searchParams.get('contractAddress'); // Optional contract address filter
    const pageKey = searchParams.get('pageKey'); // For pagination

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    if (!apiKey) {
      console.error('Alchemy API key not configured');
      return NextResponse.json(
        { error: 'Alchemy API not configured' },
        { status: 500 }
      );
    }

    // Build Alchemy API URL - Using Arbitrum Sepolia testnet
    const baseUrl = `https://arb-sepolia.g.alchemy.com/v2/${apiKey}`;

    // Build request body for asset transfers
    // We need to query both sent (fromAddress) and received (toAddress) transfers
    const requestBody: any = {
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromBlock: '0x0',
          toBlock: 'latest',
          fromAddress: address,
          category: [category],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: '0x14', // 20 results per page
        },
      ],
    };

    // Add contract address filter if provided (for staking pool transactions)
    if (contractAddress) {
      requestBody.params[0].contractAddresses = [contractAddress];
    }

    // Add pagination if provided
    if (pageKey) {
      requestBody.params[0].pageKey = pageKey;
    }

    // Fetch from Alchemy
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      console.error('Alchemy API error:', data.error);
      return NextResponse.json(
        { error: data.error.message || 'Failed to fetch transfers' },
        { status: 500 }
      );
    }

    // Transform the response to our format
    const transfers = data.result.transfers.map((transfer: any) => ({
      hash: transfer.hash,
      blockNum: transfer.blockNum,
      from: transfer.from,
      to: transfer.to,
      value: transfer.value,
      asset: transfer.asset,
      category: transfer.category,
      rawContract: transfer.rawContract,
      metadata: {
        blockTimestamp: transfer.metadata?.blockTimestamp,
      },
    }));

    return NextResponse.json({
      transfers,
      pageKey: data.result.pageKey,
      hasMore: !!data.result.pageKey,
    });
  } catch (error) {
    console.error('Alchemy transfers API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch blockchain transfers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
