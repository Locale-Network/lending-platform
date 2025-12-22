import { NextRequest, NextResponse } from 'next/server';
import { isValidEthereumAddress } from '@/lib/validation';

/**
 * Get user's staking transactions from the blockchain via Alchemy
 * @route GET /api/stake-transactions?address=0x...
 *
 * This pulls data directly from on-chain - no local database needed.
 * Shows the user's direct interactions with the staking pool contracts.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userAddress = searchParams.get('address');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    // Validate Ethereum address format
    if (!isValidEthereumAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    const stakingPoolAddress = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

    if (!stakingPoolAddress || !apiKey) {
      return NextResponse.json({
        transactions: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
        message: 'Blockchain configuration not available'
      });
    }

    // Fetch transfers FROM user TO staking pool (stakes)
    const stakesResponse = await fetch(`https://arb-sepolia.g.alchemy.com/v2/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock: '0x0',
          toBlock: 'latest',
          fromAddress: userAddress,
          toAddress: stakingPoolAddress,
          category: ['erc20'],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: '0x64', // 100 results
        }]
      })
    });

    // Fetch transfers FROM staking pool TO user (unstakes/withdrawals)
    const unstakesResponse = await fetch(`https://arb-sepolia.g.alchemy.com/v2/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock: '0x0',
          toBlock: 'latest',
          fromAddress: stakingPoolAddress,
          toAddress: userAddress,
          category: ['erc20'],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: '0x64',
        }]
      })
    });

    const [stakesData, unstakesData] = await Promise.all([
      stakesResponse.json(),
      unstakesResponse.json()
    ]);

    // Parse amount from transfer
    const parseAmount = (tx: any): number => {
      let amount = tx.value || 0;
      if (amount === 0 && tx.rawContract?.value) {
        const rawValue = parseInt(tx.rawContract.value, 16);
        const decimals = parseInt(tx.rawContract.decimal, 16) || 6;
        amount = rawValue / Math.pow(10, decimals);
      }
      return amount;
    };

    // Transform stakes (user -> pool)
    const stakes = (stakesData.result?.transfers || []).map((tx: any, index: number) => ({
      id: `${tx.hash}-stake-${index}`,
      type: 'stake',
      status: 'completed',
      amount: parseAmount(tx),
      transaction_hash: tx.hash,
      block_number: tx.blockNum,
      created_at: tx.metadata?.blockTimestamp || new Date().toISOString(),
      investor_address: tx.from,
      pool: {
        name: 'Real Estate Bridge Lending',
        slug: 'real-estate-bridge',
      }
    }));

    // Transform unstakes (pool -> user)
    const unstakes = (unstakesData.result?.transfers || []).map((tx: any, index: number) => ({
      id: `${tx.hash}-unstake-${index}`,
      type: 'unstake',
      status: 'completed',
      amount: parseAmount(tx),
      transaction_hash: tx.hash,
      block_number: tx.blockNum,
      created_at: tx.metadata?.blockTimestamp || new Date().toISOString(),
      investor_address: tx.to,
      pool: {
        name: 'Real Estate Bridge Lending',
        slug: 'real-estate-bridge',
      }
    }));

    // Combine and sort by timestamp (newest first)
    const transactions = [...stakes, ...unstakes]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      transactions,
      pagination: {
        page: 1,
        limit: transactions.length,
        total: transactions.length,
        totalPages: 1,
        hasMore: false,
      },
      source: 'blockchain',
    });
  } catch (error) {
    console.error('Stake transactions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
