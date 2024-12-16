import { createLinkTokenForTransactions, getFilteredLoanApplicationsOfBorrower } from './actions';
import AddressInput from './input-address';
import { formatAddress } from '@/utils/string';
import { Address } from 'viem';
import * as React from 'react';
import Loans from './select-loan';
import { isUndefined } from 'lodash';

/**
 * This page offers a Plaid Link session for users to connect to their bank account.
 * This page is wrapped inside the Reclaim flow.
 * After bank account is successfully connected, an access token is generated for the user's transaction history.
 * The transaction history to used to calculated debt-service/ interest rate
 */

interface Props {
  searchParams: {
    accountAddress: string;
  };
}

export default async function Page({ searchParams: { accountAddress } }: Props) {
  if (!accountAddress) {
    return <AddressInput />;
  }

  const {
    isError: isErrorLinkToken,
    errorMessage: errorMessageLinkToken,
    linkToken,
  } = await createLinkTokenForTransactions(accountAddress);

  if (isErrorLinkToken || !linkToken) {
    return <div>err: {errorMessageLinkToken}</div>;
  }

  const {
    isError: isErrorLoanApplications,
    errorMessage: errorMessageLoanApplications,
    loanApplications,
  } = await getFilteredLoanApplicationsOfBorrower(accountAddress);

  if (isErrorLoanApplications || isUndefined(loanApplications)) {
    return <div>{errorMessageLoanApplications}</div>;
  }

  return (
    <div className="mx-4">
      <p>Loan creator: {formatAddress(accountAddress as Address)}</p>
      <div className="my-4" />
      <Loans
        loanApplications={loanApplications}
        linkToken={linkToken}
        accountAddress={accountAddress}
      />
    </div>
  );
}
