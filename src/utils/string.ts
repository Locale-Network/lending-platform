import type { Address } from 'viem';

export function formatAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function snakeToSentenceCase(str: string): string {
  return (
    str
      // Split by underscore and join with space
      .split('_')
      .join(' ')
      // Capitalize first letter
      .replace(/^\w/, c => c.toUpperCase())
  );
}
