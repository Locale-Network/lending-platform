import { NextRequest, NextResponse } from 'next/server';
import { checkInvestorSBT } from '@/lib/nft/soulbound-checker';
import { isValidEthereumAddress } from '@/lib/validation';

/**
 * GET /api/investor/kyc-check?address=0x...
 *
 * Checks whether an investor has completed KYC (owns the Investor SBT credential).
 * Used by the staking flow to enforce KYC before allowing investments.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address parameter required' }, { status: 400 });
  }

  if (!isValidEthereumAddress(address)) {
    return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
  }

  const hasCredential = await checkInvestorSBT(address);

  return NextResponse.json({ hasCredential });
}
