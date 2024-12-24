'use client';

// https://github.com/plaid/react-plaid-link/blob/master/examples/oauth.tsx

import { useCallback, useEffect, useState } from 'react';
import { plaidPublicTokenExchange, savePlaidItemAccessToken } from './actions';
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from 'react-plaid-link';
import CalculateDebtService from './calculate-debt-service';
import { useToast } from '@/hooks/use-toast';

interface PlaidLinkProps {
  linkToken: string;
  loanApplicationId: string;
  accountAddress: string;
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

      setAccessToken(accessToken);
    },
    [toast, props.accountAddress, props.loanApplicationId]
  );

  const config: PlaidLinkOptions = {
    token: props.linkToken,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (ready) {
      open(); // open Plaid Link
    }
  }, [ready, open]);

  if (!accessToken) {
    return null;
  }

  return (
    <CalculateDebtService accessToken={accessToken} loanApplicationId={props.loanApplicationId} />
  );
}
