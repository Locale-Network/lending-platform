import { Reason } from "@/constants/reason.enum";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";

import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import VerificationStatus from "@/containers/VerificationStatus/VerificationStatus";
import { Skeleton } from "@/components/ui/skeleton";

interface ReclaimPageProps {
  searchParams: {
    account: string;
    redirectUrl: string;
  };
}

const VerificationStatusComponent = async ({
  redirectUrl,
  account,
}: {
  redirectUrl: string;
  account: string;
}) => {
  const appSecret = process.env.SECRET_ID;
  const appId = process.env.APP_ID;
  const callbackUrl = process.env.RECLAIM_CALLBACK_URL;
  const providerId = process.env.RECLAIM_PROVIDER_ID;
  if (!appSecret || !appId || !callbackUrl || !providerId) {
    throw new Error("Missing configuration");
  }

  const reclaimProofRequest = await ReclaimProofRequest.init(
    appId,
    appSecret,
    providerId
  );

  // await reclaimProofRequest.buildProofRequest(providerId, true, "V2Linking");

  reclaimProofRequest.setRedirectUrl(redirectUrl);
  reclaimProofRequest.setAppCallbackUrl(callbackUrl);

  // reclaimProofRequest.setSignature(await reclaimProofRequest.generateSignature(appSecret));

  const message = `for account verification ${account} ${Date.now().toString()}`;
  reclaimProofRequest.addContext(account, message);

  const requestUrl = await reclaimProofRequest.getRequestUrl();
  const statusUrl = reclaimProofRequest.getStatusUrl();

  // const { requestUrl: signedUrl, statusUrl } =
  //   await reclaimClient.createVerificationRequest();

  return <VerificationStatus signedUrl={requestUrl} statusUrl={statusUrl} />;
};

export default async function ReclaimPage({ searchParams }: ReclaimPageProps) {
  const { account, redirectUrl } = searchParams;

  if (!account) {
    return <div>No account provided</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Suspense
        fallback={
          <>
            <div className="mb-4">
              <Skeleton className="w-[256px] h-[256px]" />
            </div>
            <Button disabled>
              <span className="mr-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </span>
              Verifying...
            </Button>
            <div className="mt-4">
              <Skeleton className="w-[160px] h-[20px]" />
            </div>
            <div>
              <Skeleton className="w-[20px] h-[20px]" />
            </div>
          </>
        }
      >
        <VerificationStatusComponent
          account={account}
          redirectUrl={redirectUrl}
        />
      </Suspense>
    </div>
  );
}
