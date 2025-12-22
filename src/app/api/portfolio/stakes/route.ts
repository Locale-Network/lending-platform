import { NextRequest, NextResponse } from 'next/server';
import { isValidEthereumAddress } from '@/lib/validation';

/**
 * Get user's staking portfolio from the blockchain via Alchemy
 * @route GET /api/portfolio/stakes?address=0x...
 *
 * This pulls data directly from on-chain - no local database needed.
 * The blockchain is the source of truth for all staking positions.
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
        stakes: [],
        summary: {
          totalInvested: 0,
          totalRewards: 0,
          totalValue: 0,
          activeInvestments: 0,
          avgReturn: 0,
        },
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

    // Calculate totals
    const totalStaked = (stakesData.result?.transfers || []).reduce(
      (sum: number, tx: any) => sum + parseAmount(tx),
      0
    );

    const totalUnstaked = (unstakesData.result?.transfers || []).reduce(
      (sum: number, tx: any) => sum + parseAmount(tx),
      0
    );

    const netStaked = totalStaked - totalUnstaked;

    // Transform stakes for display
    const stakes = (stakesData.result?.transfers || []).map((tx: any, index: number) => {
      const amount = parseAmount(tx);
      const timestamp = tx.metadata?.blockTimestamp || new Date().toISOString();
      const daysSinceStake = Math.floor(
        (new Date().getTime() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Estimate rewards at 12% APY (this is approximate - real rewards come from contract)
      const apy = 12;
      const dailyRate = apy / 365 / 100;
      const rewards = amount * dailyRate * daysSinceStake;

      return {
        id: `${tx.hash}-${index}`,
        amount,
        shares: amount, // Simplified - actual shares come from contract
        rewards: Math.round(rewards * 100) / 100,
        currentValue: amount + rewards,
        transaction_hash: tx.hash,
        createdAt: timestamp,
        pool: {
          id: 'staking-pool',
          name: 'Real Estate Bridge Lending',
          slug: 'real-estate-bridge',
          annualizedReturn: apy,
          poolType: 'BRIDGE',
          status: 'ACTIVE',
        }
      };
    });

    // Calculate summary
    const totalRewards = stakes.reduce((sum: number, s: any) => sum + s.rewards, 0);

    return NextResponse.json({
      stakes,
      summary: {
        totalInvested: Math.round(netStaked * 100) / 100,
        totalRewards: Math.round(totalRewards * 100) / 100,
        totalValue: Math.round((netStaked + totalRewards) * 100) / 100,
        activeInvestments: stakes.length,
        avgReturn: 12, // Pool APY
      },
      source: 'blockchain',
    });
  } catch (error) {
    console.error('Portfolio stakes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
