/**
 * EligibilityRegistry Contract Configuration
 * Used for investor whitelist management (Reg D 506(b) compliance)
 */

import { type Address } from 'viem';

export const ELIGIBILITY_REGISTRY_ADDRESS = process.env
  .NEXT_PUBLIC_ELIGIBILITY_REGISTRY_ADDRESS as Address;

// InvestorStatus enum values matching the Solidity contract
export const InvestorStatus = {
  INELIGIBLE: 0,
  ACCREDITED: 1,
  NON_ACCREDITED: 2,
} as const;

export type InvestorStatusValue = (typeof InvestorStatus)[keyof typeof InvestorStatus];

export const STATUS_LABELS: Record<number, string> = {
  0: 'Ineligible',
  1: 'Accredited',
  2: 'Non-Accredited',
};

export const eligibilityRegistryAbi = [
  // Write functions
  {
    type: 'function',
    name: 'setInvestorStatus',
    inputs: [
      { name: 'investor', type: 'address', internalType: 'address' },
      { name: 'status', type: 'uint8', internalType: 'enum IEligibilityRegistry.InvestorStatus' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Read functions
  {
    type: 'function',
    name: 'investorStatus',
    inputs: [{ name: 'investor', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint8', internalType: 'enum IEligibilityRegistry.InvestorStatus' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canInvest',
    inputs: [{ name: 'investor', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'canInvest', type: 'bool', internalType: 'bool' },
      { name: 'reason', type: 'string', internalType: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'investorHasInvested',
    inputs: [{ name: 'investor', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonAccreditedInvestorCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'maxNonAccreditedInvestors',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'InvestorStatusUpdated',
    inputs: [
      { name: 'investor', type: 'address', indexed: true, internalType: 'address' },
      { name: 'oldStatus', type: 'uint8', indexed: false, internalType: 'enum IEligibilityRegistry.InvestorStatus' },
      { name: 'newStatus', type: 'uint8', indexed: false, internalType: 'enum IEligibilityRegistry.InvestorStatus' },
    ],
  },
] as const;
