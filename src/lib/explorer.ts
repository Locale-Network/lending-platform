const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID);

function getExplorerBaseUrl(): string {
  switch (CHAIN_ID) {
    case 421614:
      return 'https://sepolia.arbiscan.io';
    case 42161:
      return 'https://arbiscan.io';
    default:
      throw new Error(`Unsupported chain ID for explorer: ${CHAIN_ID}`);
  }
}

export function getExplorerUrl(type: 'address' | 'tx' | 'token', hash: string): string {
  return `${getExplorerBaseUrl()}/${type}/${hash}`;
}
