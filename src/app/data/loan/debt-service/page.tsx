import { createLinkTokenForTransactions, getFilteredLoanApplicationsOfBorrower } from './actions';
import AddressInput from './input-address';
import { formatAddress } from '@/utils/string';
import { Address } from 'viem';
import * as React from 'react';
import Loans from './select-loan';

/**
 * This page offers a Plaid Link session for users to connect to their bank account.
 * After bank account is successfully connected, an access token is generated for the user's transaction history.
 * The transaction history is used to calculate debt-service / interest rate via Cartesi verifiable compute.
 */

interface Props {
  searchParams: Promise<{
    accountAddress: string;
  }>;
}

export default async function Page(props: Props) {
  const searchParams = await props.searchParams;

  const {
    accountAddress
  } = searchParams;

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

  if (isErrorLoanApplications || !loanApplications) {
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
