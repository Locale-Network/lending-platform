'use client';
import {
  IdentityVerificationGetResponse,
  IdentityVerificationStepSummary,
  IdentityVerificationStepStatus,
} from 'plaid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { snakeToSentenceCase } from '@/utils/string';

interface SuccessIdentityVerificationProps {
  accountAddress: string;
  identityVerificationData: IdentityVerificationGetResponse;
}

export default function SuccessIdentityVerification(props: SuccessIdentityVerificationProps) {
  const verificationSteps: IdentityVerificationStepSummary = props.identityVerificationData.steps;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[350px] overflow-hidden">
        <CardHeader className="border-b border-green-100 bg-green-50">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-green-700">Verification Successful</CardTitle>
          </div>
          <CardDescription className="text-green-600">
            Your identity verification process was successful.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Verification Steps:</h3>
          <div className="space-y-2">
            {Object.entries(verificationSteps).map(([key, value]) => {
              if (value === IdentityVerificationStepStatus.Success) {
                return (
                  <div
                    key={key}
                    className="flex items-center space-x-2 rounded bg-green-50 p-2 text-green-600"
                  >
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{snakeToSentenceCase(key)}</span>
                  </div>
                );
              }
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
