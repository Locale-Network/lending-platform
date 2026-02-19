'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import WalletButton from '@/components/wallet-button';

// TODO: add link to terms and privacy

export default function CardWithForm() {

  return (
    <Card className="w-[350px]">
      <CardHeader className="flex flex-col items-center pb-3">
        <div className="mb-2 h-32 w-32 overflow-hidden rounded-full">
          <Image
            src="https://images.squarespace-cdn.com/content/v1/66c4ab9d1cc12e32b4138e7e/f4e716cf-7a6e-44c5-a8cd-24b47dec43a1/favicon.ico?format=100w"
            alt="Project icon"
            width={128}
            height={128}
            className="object-cover"
          />
        </div>
        <div className="flex items-center justify-center">
          <Image
            src="/locale-lending-logo.svg"
            alt="Locale Lending"
            width={240}
            height={96}
            priority
          />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-center text-sm text-muted-foreground">
          Empowering local communities through Decentralized Finance
        </p>
      </CardContent>
      <CardFooter className="flex flex-col items-center space-y-4">
        <WalletButton label="Sign In" signInScreen />

        <div className="text-xs text-muted-foreground">
          <Link href="/terms" className="hover:underline">
            Terms and Conditions
          </Link>
          {' • '}
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
