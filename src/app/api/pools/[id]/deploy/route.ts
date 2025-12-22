import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { stakingPoolAbi, STAKING_POOL_ADDRESS, hashPoolId } from '@/lib/contracts/stakingPool';

/**
 * POST /api/pools/[id]/deploy
 *
 * Deploys a pool to the StakingPool smart contract on Arbitrum Sepolia.
 *
 * Requirements:
 * - Pool must be in DRAFT status
 * - Pool must not already be deployed on-chain
 * - User must be ADMIN
 * - POOL_ADMIN_PRIVATE_KEY must be set in environment
 *
 * Process:
 * 1. Validate pool is DRAFT and not already on-chain
 * 2. Compute contractPoolId = keccak256(slug)
 * 3. Call StakingPool.createPool(poolId, name, minimumStake, feeRate)
 * 4. Wait for transaction confirmation
 * 5. Update pool with contractPoolId, deployTxHash, status = ACTIVE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin session
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use role from session (already fetched from DB in getSession)
    // No need to query database again
    if (session.user.role !== 'ADMIN') {
      console.log('[Deploy] Access denied - user role:', session.user.role);
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Check environment configuration
    const adminPrivateKey = process.env.POOL_ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      return NextResponse.json(
        { error: 'Server configuration error: POOL_ADMIN_PRIVATE_KEY not set' },
        { status: 500 }
      );
    }

    if (!STAKING_POOL_ADDRESS) {
      return NextResponse.json(
        { error: 'Server configuration error: NEXT_PUBLIC_STAKING_POOL_ADDRESS not set' },
        { status: 500 }
      );
    }

    // Get pool from database
    const { id } = await params;
    const pool = await prisma.loanPool.findUnique({
      where: { id },
    });

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Validate pool status
    if (pool.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Cannot deploy pool with status ${pool.status}. Only DRAFT pools can be deployed.` },
        { status: 400 }
      );
    }

    if (pool.isOnChain || pool.contractPoolId) {
      return NextResponse.json(
        { error: 'Pool is already deployed on-chain' },
        { status: 400 }
      );
    }

    // Compute the contract pool ID from slug
    const contractPoolId = hashPoolId(pool.slug);

    // Set up viem clients for Arbitrum Sepolia
    const chain = arbitrumSepolia;
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const account = privateKeyToAccount(adminPrivateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

    // Prepare pool parameters for contract
    // minimumStake is in USD, convert to token units (6 decimals for USDC/lUSD)
    const minimumStakeWei = parseUnits(pool.minimumStake.toString(), 6);

    // feeRate is in basis points (managementFeeRate is in percentage, so multiply by 100)
    // e.g., 1% = 100 basis points
    const feeRateBasisPoints = BigInt(Math.round(pool.managementFeeRate * 100));

    console.log('[Deploy] Creating pool on-chain:', {
      poolId: contractPoolId,
      name: pool.name,
      minimumStake: minimumStakeWei.toString(),
      feeRate: feeRateBasisPoints.toString(),
      stakingPoolAddress: STAKING_POOL_ADDRESS,
    });

    // Check if pool already exists on contract
    try {
      const existingPool = await publicClient.readContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'getPool',
        args: [contractPoolId],
      });

      // If pool exists and has a non-empty name, it's already deployed
      if (existingPool && existingPool[0]) {
        return NextResponse.json(
          { error: 'Pool with this ID already exists on the smart contract' },
          { status: 400 }
        );
      }
    } catch {
      // Pool doesn't exist, which is what we want
    }

    // Deploy pool to smart contract
    const txHash = await walletClient.writeContract({
      address: STAKING_POOL_ADDRESS,
      abi: stakingPoolAbi,
      functionName: 'createPool',
      args: [contractPoolId, pool.name, minimumStakeWei, feeRateBasisPoints],
    });

    console.log('[Deploy] Transaction submitted:', txHash);

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    if (receipt.status !== 'success') {
      return NextResponse.json(
        { error: 'Transaction failed on-chain', txHash },
        { status: 500 }
      );
    }

    console.log('[Deploy] Transaction confirmed:', {
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    });

    // Update pool in database
    const updatedPool = await prisma.loanPool.update({
      where: { id },
      data: {
        contractPoolId,
        deployTxHash: txHash,
        deployedAtBlock: Number(receipt.blockNumber),
        isOnChain: true,
        status: 'ACTIVE',
        contractAddress: STAKING_POOL_ADDRESS, // Store the staking pool address for reference
      },
    });

    return NextResponse.json({
      success: true,
      pool: updatedPool,
      transaction: {
        hash: txHash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
      },
    });
  } catch (error) {
    console.error('[Deploy] Error deploying pool:', error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check for common contract errors
      if (error.message.includes('PoolAlreadyExists')) {
        return NextResponse.json(
          { error: 'Pool already exists on the smart contract' },
          { status: 400 }
        );
      }

      if (error.message.includes('InvalidFeeRate')) {
        return NextResponse.json(
          { error: 'Invalid fee rate - must be less than 10%' },
          { status: 400 }
        );
      }

      if (error.message.includes('insufficient funds')) {
        return NextResponse.json(
          { error: 'Insufficient ETH balance for gas fees' },
          { status: 500 }
        );
      }

      // Don't expose internal error details to clients
      console.error('[Deploy] Unhandled contract error:', error.message);
      return NextResponse.json(
        { error: 'Deployment failed - please check your configuration and try again' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pools/[id]/deploy
 *
 * Get the deployment status of a pool
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const pool = await prisma.loanPool.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        isOnChain: true,
        contractPoolId: true,
        deployTxHash: true,
        deployedAtBlock: true,
        contractAddress: true,
      },
    });

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // If deployed, fetch on-chain data
    let onChainData = null;
    if (pool.isOnChain && pool.contractPoolId && STAKING_POOL_ADDRESS) {
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
        const publicClient = createPublicClient({
          chain: arbitrumSepolia,
          transport: http(rpcUrl),
        });

        const poolData = await publicClient.readContract({
          address: STAKING_POOL_ADDRESS,
          abi: stakingPoolAbi,
          functionName: 'getPool',
          args: [pool.contractPoolId as `0x${string}`],
        });

        onChainData = {
          name: poolData[0],
          minimumStake: poolData[1].toString(),
          totalStaked: poolData[2].toString(),
          totalShares: poolData[3].toString(),
          feeRate: poolData[4].toString(),
          active: poolData[5],
        };
      } catch (error) {
        console.error('[Deploy] Error fetching on-chain data:', error);
      }
    }

    return NextResponse.json({
      pool,
      onChainData,
    });
  } catch (error) {
    console.error('[Deploy] Error getting deployment status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
