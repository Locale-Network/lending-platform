import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';

/**
 * Get recent staking activity for a pool from the blockchain via Alchemy
 * @route GET /api/pools/[id]/activity
 *
 * This pulls data directly from on-chain events - no local database needed.
 * The blockchain is the source of truth for all staking transactions.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if id looks like a CUID (starts with 'c' followed by alphanumeric)
    const isCuid = /^c[a-z0-9]{20,}$/i.test(id);

    // Validate the pool exists (for slug lookup or CUID verification)
    if (!isCuid) {
      const pool = await prisma.loanPool.findUnique({
        where: { slug: id },
        select: { id: true }
      });

      if (!pool) {
        return NextResponse.json(
          { error: 'Pool not found' },
          { status: 404 }
        );
      }
    }

    // Get staking pool contract address
    const stakingPoolAddress = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

    if (!stakingPoolAddress || !apiKey) {
      return NextResponse.json({
        transactions: [],
        message: 'Blockchain configuration not available'
      });
    }

    // Fetch transfers TO the staking pool (stakes)
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
          toAddress: stakingPoolAddress,
          category: ['erc20'],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: '0x14', // 20 results
        }]
      })
    });

    // Fetch transfers FROM the staking pool (unstakes/withdrawals)
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
          category: ['erc20'],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: '0x14',
        }]
      })
    });

    const [stakesData, unstakesData] = await Promise.all([
      stakesResponse.json(),
      unstakesResponse.json()
    ]);

    // Transform stakes (transfers TO the pool)
    const stakes = (stakesData.result?.transfers || []).map((tx: any) => {
      // ERC20 values can be in 'value' or need to be parsed from rawContract
      let amount = tx.value || 0;
      if (amount === 0 && tx.rawContract?.value) {
        // Parse hex value and convert from token decimals (USDC = 6 decimals)
        const rawValue = parseInt(tx.rawContract.value, 16);
        const decimals = parseInt(tx.rawContract.decimal, 16) || 6;
        amount = rawValue / Math.pow(10, decimals);
      }
      return {
        id: `${tx.hash}-stake`, // Unique key: hash + type
        type: 'stake',
        amount,
        user_address: tx.from,
        transaction_hash: tx.hash,
        created_at: tx.metadata?.blockTimestamp || new Date().toISOString(),
      };
    });

    // Transform unstakes (transfers FROM the pool)
    const unstakes = (unstakesData.result?.transfers || []).map((tx: any) => {
      let amount = tx.value || 0;
      if (amount === 0 && tx.rawContract?.value) {
        const rawValue = parseInt(tx.rawContract.value, 16);
        const decimals = parseInt(tx.rawContract.decimal, 16) || 6;
        amount = rawValue / Math.pow(10, decimals);
      }
      return {
        id: `${tx.hash}-unstake`, // Unique key: hash + type
        type: 'unstake',
        amount,
        user_address: tx.to,
        transaction_hash: tx.hash,
        created_at: tx.metadata?.blockTimestamp || new Date().toISOString(),
      };
    });

    // Combine and sort by timestamp (newest first)
    const transactions = [...stakes, ...unstakes]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    return NextResponse.json({
      transactions,
      source: 'blockchain', // Indicate this is on-chain data
    });
  } catch (error) {
    console.error('Pool activity API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
