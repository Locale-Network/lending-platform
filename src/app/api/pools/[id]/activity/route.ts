import { NextRequest, NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, EventLog } from 'ethers';
import prisma from '@prisma/index';
import { stakingPoolAbi, hashPoolId } from '@/lib/contracts/stakingPool';
import { loanPoolAbi, hashLoanId } from '@/lib/contracts/loanPool';
import { USDC_DECIMALS, DEFAULT_BLOCK_LOOKBACK } from '@/lib/constants/business';

const TOKEN_DECIMALS = USDC_DECIMALS;

/**
 * Get recent staking activity for a specific pool from blockchain events
 * @route GET /api/pools/[id]/activity
 *
 * Queries Staked/Unstaked/UnstakeRequested events filtered by the pool's
 * contractPoolId (bytes32), so only events for THIS pool are returned.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if id looks like a CUID (starts with 'c' followed by alphanumeric)
    const isCuid = /^c[a-z0-9]{20,}$/i.test(id);

    // Look up the pool to get its slug and contractPoolId
    const pool = isCuid
      ? await prisma.loanPool.findUnique({ where: { id }, select: { id: true, slug: true, contractPoolId: true } })
      : await prisma.loanPool.findUnique({ where: { slug: id }, select: { id: true, slug: true, contractPoolId: true } });

    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      );
    }

    const stakingPoolAddress = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

    if (!stakingPoolAddress || !rpcUrl) {
      return NextResponse.json({
        transactions: [],
        message: 'Blockchain configuration not available'
      });
    }

    // Get the bytes32 poolId for event filtering
    const contractPoolId = pool.contractPoolId || hashPoolId(pool.slug);

    // Query contract events filtered by this pool's ID
    const provider = new JsonRpcProvider(rpcUrl);
    const contract = new Contract(stakingPoolAddress, stakingPoolAbi, provider);

    // Query the last ~5M blocks (~14 days on Arbitrum at ~0.25s/block)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - DEFAULT_BLOCK_LOOKBACK);

    const [stakedEvents, unstakeRequestedEvents, unstakedEvents] = await Promise.all([
      contract.queryFilter(contract.filters.Staked(contractPoolId), fromBlock, currentBlock),
      contract.queryFilter(contract.filters.UnstakeRequested(contractPoolId), fromBlock, currentBlock),
      contract.queryFilter(contract.filters.Unstaked(contractPoolId), fromBlock, currentBlock),
    ]);

    // Truncate addresses for privacy
    const truncateAddress = (addr: string): string =>
      addr && addr.length >= 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

    // Get block timestamps for all unique blocks
    const blockNumbers = new Set<number>();
    for (const e of [...stakedEvents, ...unstakeRequestedEvents, ...unstakedEvents]) {
      blockNumbers.add(e.blockNumber);
    }
    const blockTimestamps = new Map<number, string>();
    await Promise.all(
      Array.from(blockNumbers).map(async (bn) => {
        const block = await provider.getBlock(bn);
        if (block) {
          blockTimestamps.set(bn, new Date(block.timestamp * 1000).toISOString());
        }
      })
    );

    const formatAmount = (raw: bigint): number =>
      Number(raw) / Math.pow(10, TOKEN_DECIMALS);

    // Transform Staked events
    const stakes = stakedEvents
      .filter((e): e is EventLog => 'args' in e)
      .map((e) => ({
        id: `${e.transactionHash}-stake-${e.index}`,
        type: 'stake',
        amount: formatAmount(e.args[2]), // amount
        user_address: truncateAddress(e.args[1]), // user
        transaction_hash: e.transactionHash,
        created_at: blockTimestamps.get(e.blockNumber) || new Date().toISOString(),
      }));

    // Transform UnstakeRequested events
    const unstakeRequests = unstakeRequestedEvents
      .filter((e): e is EventLog => 'args' in e)
      .map((e) => ({
        id: `${e.transactionHash}-unstake_request-${e.index}`,
        type: 'unstake_request',
        amount: formatAmount(e.args[2]), // amount
        user_address: truncateAddress(e.args[1]), // user
        transaction_hash: e.transactionHash,
        created_at: blockTimestamps.get(e.blockNumber) || new Date().toISOString(),
      }));

    // Transform Unstaked events
    const unstakes = unstakedEvents
      .filter((e): e is EventLog => 'args' in e)
      .map((e) => ({
        id: `${e.transactionHash}-unstake-${e.index}`,
        type: 'unstake',
        amount: formatAmount(e.args[2]), // amount
        user_address: truncateAddress(e.args[1]), // user
        transaction_hash: e.transactionHash,
        created_at: blockTimestamps.get(e.blockNumber) || new Date().toISOString(),
      }));

    // Fetch loan disbursements from the database (PoolLoan records)
    let disbursements: any[] = [];
    let repayments: any[] = [];
    try {
      const poolLoans = await prisma.poolLoan.findMany({
        where: { poolId: pool.id },
        include: {
          loanApplication: {
            select: {
              id: true,
              businessPrimaryIndustry: true,
              accountAddress: true,
            },
          },
        },
        orderBy: { fundedAt: 'desc' },
        take: 10,
      });

      disbursements = poolLoans.map((loan) => ({
        id: `${loan.id}-disburse`,
        type: 'disbursement',
        amount: loan.principal,
        user_address: truncateAddress(loan.loanApplication.accountAddress),
        industry: loan.loanApplication.businessPrimaryIndustry,
        interest_rate: loan.interestRate,
        term_months: loan.termMonths,
        created_at: loan.fundedAt.toISOString(),
      }));

      // Fetch on-chain repayment events for this pool's loans
      if (poolLoans.length > 0) {
        const loanPoolAddress = process.env.NEXT_PUBLIC_LOAN_POOL_ADDRESS;
        if (loanPoolAddress) {
          const loanContract = new Contract(loanPoolAddress, loanPoolAbi, provider);
          const repaymentEvents = await loanContract.queryFilter(
            loanContract.filters.LoanRepaymentMade(),
            fromBlock,
            currentBlock
          );

          // Build a set of bytes32 loan IDs that belong to this pool
          const poolLoanIds = new Set<string>(
            poolLoans.map((loan) => hashLoanId(loan.loanApplication.id).toLowerCase())
          );

          // Get block timestamps for repayment events
          for (const e of repaymentEvents) {
            blockNumbers.add(e.blockNumber);
          }
          await Promise.all(
            Array.from(blockNumbers)
              .filter((bn) => !blockTimestamps.has(bn))
              .map(async (bn) => {
                const block = await provider.getBlock(bn);
                if (block) {
                  blockTimestamps.set(bn, new Date(block.timestamp * 1000).toISOString());
                }
              })
          );

          repayments = repaymentEvents
            .filter((e): e is EventLog => 'args' in e)
            .filter((e) => poolLoanIds.has((e.args[0] as string).toLowerCase()))
            .map((e) => ({
              id: `${e.transactionHash}-repayment-${e.index}`,
              type: 'repayment',
              amount: formatAmount(e.args[2]), // repaymentAmount
              interest_amount: formatAmount(e.args[3]), // interestAmount
              user_address: truncateAddress(e.args[1] as string), // borrower
              transaction_hash: e.transactionHash,
              created_at: blockTimestamps.get(e.blockNumber) || new Date().toISOString(),
            }));
        }
      }
    } catch (err) {
      console.error('Error fetching disbursements/repayments:', err);
    }

    // Combine and sort by timestamp (newest first)
    const transactions = [...stakes, ...unstakeRequests, ...unstakes, ...disbursements, ...repayments]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    return NextResponse.json({
      transactions,
      source: 'hybrid',
    });
  } catch (error) {
    console.error('Pool activity API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
