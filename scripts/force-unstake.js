#!/usr/bin/env node
/**
 * Force Unstake Script
 *
 * Calls requestUnstake + completeUnstake for a given wallet.
 * Requires the staker's private key (as UNSTAKE_PRIVATE_KEY env var).
 *
 * Usage:
 *   UNSTAKE_PRIVATE_KEY=<hex> node scripts/force-unstake.js
 */

const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const STAKING_POOL_ADDRESS = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const PRIVATE_KEY = process.env.UNSTAKE_PRIVATE_KEY;
const POOL_SLUG = 'mini-scholars-learning-center';

if (!STAKING_POOL_ADDRESS || !RPC_URL || !PRIVATE_KEY) {
  console.error('Missing env vars. Need: NEXT_PUBLIC_STAKING_POOL_ADDRESS, NEXT_PUBLIC_RPC_URL, UNSTAKE_PRIVATE_KEY');
  process.exit(1);
}

// Hash pool slug to bytes32 (same as keccak256(toBytes(slug)) in viem)
const poolId = ethers.keccak256(ethers.toUtf8Bytes(POOL_SLUG));

// Minimal ABI for the calls we need
const abi = [
  'function getUserStake(bytes32 _poolId, address _user) view returns (uint256 principal, uint256 amount, uint256 shares, uint256 stakedAt, uint256 pendingUnstake, uint256 canWithdrawAt, uint256 claimedYield)',
  'function getPool(bytes32 _poolId) view returns (string name, uint256 minimumStake, uint256 totalStaked, uint256 totalShares, uint256 feeRate, uint256 poolCooldownPeriod, uint256 maturityDate, address eligibilityRegistry, bool active, bool cooldownWaived)',
  'function requestUnstake(bytes32 _poolId, uint256 _amount)',
  'function completeUnstake(bytes32 _poolId)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(STAKING_POOL_ADDRESS, abi, wallet);

  console.log('Wallet address:', wallet.address);
  console.log('Pool slug:', POOL_SLUG);
  console.log('Pool ID (bytes32):', poolId);
  console.log('Staking Pool:', STAKING_POOL_ADDRESS);
  console.log('---');

  // 1. Read pool state
  const pool = await contract.getPool(poolId);
  console.log('Pool name:', pool.name);
  console.log('Pool active:', pool.active);
  console.log('Cooldown waived:', pool.cooldownWaived);
  console.log('Total staked:', ethers.formatUnits(pool.totalStaked, 6), 'USDC');
  console.log('---');

  // 2. Read user stake
  const stake = await contract.getUserStake(poolId, wallet.address);
  const stakedAmount = stake.amount;
  const pendingUnstake = stake.pendingUnstake;

  console.log('User stake amount:', ethers.formatUnits(stakedAmount, 6), 'USDC');
  console.log('User shares:', ethers.formatUnits(stake.shares, 6));
  console.log('Pending unstake:', ethers.formatUnits(pendingUnstake, 6), 'USDC');
  console.log('Can withdraw at:', Number(stake.canWithdrawAt) > 0 ? new Date(Number(stake.canWithdrawAt) * 1000).toISOString() : 'N/A');
  console.log('---');

  if (stakedAmount === 0n && pendingUnstake === 0n) {
    console.log('No funds to unstake or withdraw. Exiting.');
    return;
  }

  // 3. If there's staked amount but no pending unstake, request unstake first
  if (stakedAmount > 0n && pendingUnstake === 0n) {
    console.log(`Requesting unstake of ${ethers.formatUnits(stakedAmount, 6)} USDC...`);
    const tx1 = await contract.requestUnstake(poolId, stakedAmount);
    console.log('requestUnstake tx:', tx1.hash);
    const receipt1 = await tx1.wait();
    console.log('requestUnstake confirmed in block:', receipt1.blockNumber);
    console.log('---');
  } else if (pendingUnstake > 0n) {
    console.log('Already has pending unstake, skipping requestUnstake.');
  }

  // 4. Complete unstake (withdraw funds)
  console.log('Completing unstake (withdrawing funds)...');
  const tx2 = await contract.completeUnstake(poolId);
  console.log('completeUnstake tx:', tx2.hash);
  const receipt2 = await tx2.wait();
  console.log('completeUnstake confirmed in block:', receipt2.blockNumber);
  console.log('---');

  // 5. Verify final state
  const finalStake = await contract.getUserStake(poolId, wallet.address);
  console.log('DONE! Final state:');
  console.log('  Staked amount:', ethers.formatUnits(finalStake.amount, 6), 'USDC');
  console.log('  Pending unstake:', ethers.formatUnits(finalStake.pendingUnstake, 6), 'USDC');
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
