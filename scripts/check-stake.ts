import { createPublicClient, http, keccak256, toBytes } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

// Config (Updated Dec 8, 2024 - commitment-based architecture deployment)
const STAKING_POOL_ADDRESS = '0x340913b62A0D7aA5591EE6EF9cB11C7A5ab3cC4a';
const USER_ADDRESS = '0x94802E7a5e8bf7871Db02888846D948C4d8CC093';

// ABI fragments
const stakingPoolAbi = [
  { name: 'getAllPoolIds', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32[]' }] },
  { name: 'getPool', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32', name: 'poolId' }], outputs: [{ type: 'string' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }] },
  { name: 'getUserStake', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32', name: 'poolId' }, { type: 'address', name: 'user' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] },
  { name: 'cooldownPeriod', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

function hashPoolId(poolId: string): `0x${string}` {
  return keccak256(toBytes(poolId));
}

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http('https://sepolia-rollup.arbitrum.io/rpc'),
});

async function main() {
  console.log('Checking staking pool state...\n');
  console.log('Staking Pool Address:', STAKING_POOL_ADDRESS);
  console.log('User Address:', USER_ADDRESS);
  console.log('');

  // Get cooldown period
  try {
    const cooldown = await publicClient.readContract({
      address: STAKING_POOL_ADDRESS as `0x${string}`,
      abi: stakingPoolAbi,
      functionName: 'cooldownPeriod',
    });
    const cooldownNum = Number(cooldown);
    console.log('Cooldown Period:', cooldownNum, 'seconds (', cooldownNum / 86400, 'days)');
  } catch (e) {
    console.log('Error getting cooldown:', e);
  }

  // Get all pool IDs
  console.log('\n--- All Pool IDs on-chain ---');
  let poolIds: `0x${string}`[] = [];
  try {
    poolIds = await publicClient.readContract({
      address: STAKING_POOL_ADDRESS as `0x${string}`,
      abi: stakingPoolAbi,
      functionName: 'getAllPoolIds',
    }) as `0x${string}`[];
    console.log('Pool IDs found:', poolIds.length);
    poolIds.forEach((id, i) => console.log('  ' + i + ': ' + id));
  } catch (e) {
    console.log('Error getting pool IDs:', e);
  }

  // Check known pool slugs
  const knownSlugs = [
    'small-business-growth',
    'real-estate',
    'commercial-real-estate',
    'real-estate-bridge',
  ];

  console.log('\n--- Hash lookup for known slugs ---');
  for (const slug of knownSlugs) {
    const hash = hashPoolId(slug);
    const exists = poolIds.includes(hash);
    console.log('"' + slug + '" -> ' + hash + ' (exists: ' + exists + ')');
  }

  // Get pool details for each on-chain pool
  console.log('\n--- Pool Details ---');
  for (const poolId of poolIds) {
    try {
      const pool = await publicClient.readContract({
        address: STAKING_POOL_ADDRESS as `0x${string}`,
        abi: stakingPoolAbi,
        functionName: 'getPool',
        args: [poolId],
      });
      console.log('Pool ' + poolId + ':');
      console.log('  Name: ' + pool[0]);
      console.log('  Min Stake: ' + pool[1] + ' (' + (Number(pool[1]) / 1e6) + ' USDC)');
      console.log('  Total Staked: ' + pool[2] + ' (' + (Number(pool[2]) / 1e6) + ' USDC)');
      console.log('  Total Shares: ' + pool[3]);
      console.log('  Fee Rate: ' + pool[4]);
      console.log('  Active: ' + pool[5]);
    } catch (e) {
      console.log('Error getting pool ' + poolId + ':', e);
    }
  }

  // Get user stake for each pool
  console.log('\n--- User Stakes ---');
  for (const poolId of poolIds) {
    try {
      const stake = await publicClient.readContract({
        address: STAKING_POOL_ADDRESS as `0x${string}`,
        abi: stakingPoolAbi,
        functionName: 'getUserStake',
        args: [poolId, USER_ADDRESS as `0x${string}`],
      });
      const stakeAmount = Number(stake[0]);
      const pendingUnstake = Number(stake[3]);
      const canWithdrawAt = Number(stake[4]);

      if (stakeAmount > 0 || pendingUnstake > 0) {
        console.log('User stake in pool ' + poolId + ':');
        console.log('  Amount: ' + stake[0] + ' (' + (stakeAmount / 1e6) + ' USDC)');
        console.log('  Shares: ' + stake[1]);
        console.log('  Staked At: ' + stake[2] + ' (' + new Date(Number(stake[2]) * 1000).toISOString() + ')');
        console.log('  Pending Unstake: ' + stake[3] + ' (' + (pendingUnstake / 1e6) + ' USDC)');
        console.log('  Can Withdraw At: ' + stake[4] + ' (' + (canWithdrawAt > 0 ? new Date(canWithdrawAt * 1000).toISOString() : 'N/A') + ')');
      } else {
        console.log('User has no stake in pool ' + poolId);
      }
    } catch (e) {
      console.log('Error getting user stake for pool ' + poolId + ':', e);
    }
  }
}

main().catch(console.error);
