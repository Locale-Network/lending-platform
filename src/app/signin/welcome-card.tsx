'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import WalletConnectButton from '@/components/wallet-connect-button';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { ROLE_REDIRECTS } from '@/app/api/auth/auth-pages';

// TODO: add link to terms and privacy

export default function CardWithForm() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const { isConnected, address } = useAccount();

  React.useEffect(() => {
    if (status === 'authenticated' && isConnected && address) {
      (async function () {
        const role = session?.user.role;
        const redirectPath = ROLE_REDIRECTS[role];
        router.replace(redirectPath);
      })();
    }
  }, [status, isConnected, address, router, session?.user.role]);

  return (
    <Card className="w-[350px]">
      <CardHeader className="flex flex-col items-center">
        <div className="mb-4 h-24 w-24 overflow-hidden rounded-full">
          <Image
            src="https://images.squarespace-cdn.com/content/v1/66c4ab9d1cc12e32b4138e7e/f4e716cf-7a6e-44c5-a8cd-24b47dec43a1/favicon.ico?format=100w"
            alt="Project icon"
            width={96}
            height={96}
            className="object-cover"
          />
        </div>
        <CardTitle className="text-center">Locale Lending</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center text-sm text-muted-foreground">
          Empowering local communities through Decentralized Finance
        </p>
      </CardContent>
      <CardFooter className="flex flex-col items-center space-y-4">
        <WalletConnectButton label="Sign in with Ethereum" />

        <div className="text-xs text-muted-foreground">
          <Link href="#" className="hover:underline">
            Terms and Conditions
          </Link>
          {' • '}
          <Link href="#" className="hover:underline">
            Privacy Policy
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
