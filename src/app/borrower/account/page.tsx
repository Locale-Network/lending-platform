import { getSession } from '@/lib/auth/authorization';
import {
  getIdentityVerificationStatus,
  createLinkTokenForIdentityVerification,
  retryIdentityVerification,
  getBorrowerNFTTokenId,
} from './actions';
import CompleteIdentityVerification from './complete-identity-verification';
import RetryIdentityVerification from './retry-identity-verification';
import SuccessIdentityVerification from './success-identity-verification';
import PendingIdentityVerification from './pending-identity-verification';
import { KYCVerificationStatus } from '@prisma/client';

export default async function Page() {
  const session = await getSession();
  const accountAddress = session?.address;

  if (!accountAddress) {
    return null;
  }

  const {
    isError: isIdentityVerificationError,
    hasAttemptedKyc,
    identityVerificationData,
  } = await getIdentityVerificationStatus(accountAddress);

  // If error OR no KYC attempt OR resettable status → show Plaid module
  // Don't block on errors - let user start/restart verification
  if (
    isIdentityVerificationError ||
    !hasAttemptedKyc ||
    !identityVerificationData ||
    identityVerificationData.status === KYCVerificationStatus.canceled ||
    identityVerificationData.status === KYCVerificationStatus.expired ||
    identityVerificationData.status === KYCVerificationStatus.active
  ) {
    const { isError, errorMessage, linkToken } =
      await createLinkTokenForIdentityVerification(accountAddress);

    if (isError || !linkToken) {
      return <div>{errorMessage}</div>;
    }

    return <CompleteIdentityVerification linkToken={linkToken} accountAddress={accountAddress} />;
  }

  if (hasAttemptedKyc && identityVerificationData.status === KYCVerificationStatus.failed) {
    const { isError, errorMessage, retryIdentityVerificationData } =
      await retryIdentityVerification(accountAddress);

    if (isError || !retryIdentityVerificationData) {
      return <div>{errorMessage}</div>;
    }

    return (
      <RetryIdentityVerification
        accountAddress={accountAddress}
        identityVerificationData={identityVerificationData}
        retryIdentityVerificationData={retryIdentityVerificationData}
      />
    );
  }

  if (hasAttemptedKyc && identityVerificationData.status === KYCVerificationStatus.success) {
    const { tokenId } = await getBorrowerNFTTokenId(accountAddress);
    const borrowerCredentialAddress = process.env.BORROWER_CREDENTIAL_ADDRESS;

    return (
      <SuccessIdentityVerification
        accountAddress={accountAddress}
        identityVerificationData={identityVerificationData}
        borrowerNFTTokenId={tokenId}
        borrowerCredentialAddress={borrowerCredentialAddress}
      />
    );
  }

  if (hasAttemptedKyc && identityVerificationData.status === KYCVerificationStatus.pending_review) {
    return (
      <PendingIdentityVerification
        accountAddress={accountAddress}
        identityVerificationData={identityVerificationData}
      />
    );
  }
}
