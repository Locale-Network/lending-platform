'use client';
import {
  IdentityVerificationGetResponse,
  IdentityVerificationRetryResponse,
  IdentityVerificationStepSummary,
  IdentityVerificationStepStatus,
} from 'plaid';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { snakeToSentenceCase } from '@/utils/string';
import { Separator } from '@/components/ui/separator';

interface RetryIdentityVerificationProps {
  accountAddress: string;
  identityVerificationData: IdentityVerificationGetResponse;
  retryIdentityVerificationData: IdentityVerificationRetryResponse;
}

export default function RetryIdentityVerification(props: RetryIdentityVerificationProps) {
  const verificationSteps: IdentityVerificationStepSummary = props.identityVerificationData.steps;

  const onRetry = () => {
    const retryUrl = props.retryIdentityVerificationData.shareable_url;

    if (retryUrl) {
      window.open(retryUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[350px] overflow-hidden">
        <CardHeader className="border-b border-red-100 bg-red-50">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <CardTitle className="text-red-700">Verification Failed</CardTitle>
          </div>
          <CardDescription className="text-red-600">
            Your identity verification process failed. Please review the details below and try
            again.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Verification Steps:</h3>
          <div className="space-y-2">
            {Object.entries(verificationSteps).map(([key, value]) => {
              if (value === IdentityVerificationStepStatus.Failed) {
                return (
                  <div
                    key={key}
                    className="flex items-center space-x-2 rounded bg-red-50 p-2 text-red-600"
                  >
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{snakeToSentenceCase(key)}</span>
                  </div>
                );
              }
            })}
          </div>
          <Separator className="my-4" />
          <p className="text-sm text-gray-600">
            Don&apos;t worry! Sometimes verification fails due to technical issues or unclear
            images. Please ensure you have: Please ensure you have:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-600">
            <li>A clear, well-lit photo of your ID</li>
            <li>Entered all information correctly</li>
            <li>A stable internet connection</li>
          </ul>
        </CardContent>
        <CardFooter className="border-t border-gray-100 bg-gray-50">
          <Button onClick={onRetry} className="w-full bg-blue-500 hover:bg-blue-600">
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry Verification
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
