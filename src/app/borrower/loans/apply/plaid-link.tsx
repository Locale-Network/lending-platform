'use client';

// https://github.com/plaid/react-plaid-link/blob/master/examples/oauth.tsx

import { useCallback, useEffect, useState } from 'react';
import { plaidPublicTokenExchange, savePlaidItemAccessToken } from './actions';
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from 'react-plaid-link';
import CalculateDebtService from './calculate-debt-service';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlaidLinkProps {
  linkToken: string;
  loanApplicationId: string;
  accountAddress: string;
  onSuccess: (accessToken: string) => void;
}

export default function PlaidLink(props: PlaidLinkProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const toast = useToast();

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async publicToken => {
      const response = await plaidPublicTokenExchange(publicToken);
      if (response.isError) {
        toast.toast({
          title: 'Error',
          description: response.errorMessage,
          variant: 'destructive',
        });
        return;
      }

      const { accessToken, itemId } = response;

      if (!accessToken || !itemId) {
        toast.toast({
          title: 'Error',
          description: 'Error connecting Plaid account',
          variant: 'destructive',
        });
        return;
      }
      await savePlaidItemAccessToken({
        accessToken,
        itemId,
        accountAddress: props.accountAddress,
        loanApplicationId: props.loanApplicationId,
      });

      props.onSuccess(accessToken);

      setAccessToken(accessToken);
    },
    [props, toast]
  );

  const config: PlaidLinkOptions = {
    token: props.linkToken,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  if (!accessToken && !ready) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  if (!accessToken) {
    return <Button onClick={() => open()}>Connect</Button>;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-600">
      <p>Success</p>
    </div>
  );
}
