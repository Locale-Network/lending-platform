'use client';

import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from 'react-plaid-link';
import { useCallback } from 'react';
import { createKycVerificationRecord } from './actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IdCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface CompleteIdentityVerificationProps {
  accountAddress: string;
  linkToken: string;
}

export default function CompleteIdentityVerification(props: CompleteIdentityVerificationProps) {
  const { toast } = useToast();
  const router = useRouter();
  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (_, metadata) => {
      await createKycVerificationRecord(props.accountAddress, metadata.link_session_id);
      toast({
        title: 'Identity verification completed',
        variant: 'success',
      });
      router.push('/borrower/loans/apply');
    },
    [props.accountAddress, toast, router]
  );

  const config: PlaidLinkOptions = {
    token: props.linkToken,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[350px]">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <IdCard className="h-6 w-6 text-blue-500" />
            <CardTitle>Verify Your Identity</CardTitle>
          </div>
          <CardDescription>Simple and secure verification powered by Plaid</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            We use Plaid&apos;s trusted verification system to confirm your identity. The process is
            quick, secure, and helps protect both you and our platform.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center">
              <span className="mr-2">✅</span> Verify ID in as little as 10 seconds
            </li>
            <li className="flex items-center">
              <span className="mr-2">✅</span> Bank-level security & encryption
            </li>
            <li className="flex items-center">
              <span className="mr-2">✅</span> Supports 190+ countries
            </li>
            <li className="flex items-center">
              <span className="mr-2">✅</span> Auto-fill capability for faster completion
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button disabled={!ready} onClick={() => open()} className="w-full">
            {ready ? (
              'Start Verification'
            ) : (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
