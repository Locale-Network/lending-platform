'use client';
import { IdentityVerificationGetResponse, IdentityVerificationStepSummary } from 'plaid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { snakeToSentenceCase } from '@/utils/string';

interface PendingIdentityVerificationProps {
  accountAddress: string;
  identityVerificationData: IdentityVerificationGetResponse;
}

export default function PendingIdentityVerification(props: PendingIdentityVerificationProps) {
  const verificationSteps: IdentityVerificationStepSummary = props.identityVerificationData.steps;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[350px] overflow-hidden">
        <CardHeader className="border-b border-yellow-100 bg-yellow-50">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-yellow-700">Verification Pending</CardTitle>
          </div>
          <CardDescription className="text-yellow-600">
            Your identity verification is currently under review.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Verification Steps:</h3>
          <div className="space-y-2">
            {Object.entries(verificationSteps).map(([key, value]) => {
              return (
                <div
                  key={key}
                  className="flex items-center space-x-2 rounded bg-yellow-50 p-2 text-yellow-600"
                >
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{snakeToSentenceCase(key)}</span>
                  <span className="ml-auto text-xs font-medium">{snakeToSentenceCase(value)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
