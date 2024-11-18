'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import useKycVerification from '@/hooks/use-kyc-verification';
import { KYCVerificationStatus } from '@prisma/client';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAccount } from 'wagmi';

// TODO: decide if KYC is complete

export default function ApplyLoanCard() {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();

  const { address: chainAccountAddress } = useAccount();
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const { startKYCFlow, kycStatus, retryKycVerification } = useKycVerification(chainAccountAddress);

  const handleClick = async () => {
    if (!chainAccountAddress) {
      openConnectModal?.();
      return;
    }

    if (kycStatus === KYCVerificationStatus.success) {
      router.push('/borrower/loans/apply');
    } else if (kycStatus === KYCVerificationStatus.failed) {
      const data = await retryKycVerification();
      if (data?.shareable_url) {
        setRedirectUrl(data.shareable_url);
      }
    } else {
      await startKYCFlow();
    }
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg"
      onClick={handleClick}
    >
      <CardHeader className="space-y-4">
        <div className="h-14 w-14 rounded-xl bg-blue-100 p-4">
          <Pencil className="h-6 w-6 text-blue-600" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold">Apply for loan</CardTitle>
          <CardDescription className="text-base leading-relaxed text-muted-foreground">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}
