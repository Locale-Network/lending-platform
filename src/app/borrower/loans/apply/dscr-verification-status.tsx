'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, AlertCircle, Lock, Shield, ExternalLink } from 'lucide-react';

interface DscrVerificationStatusProps {
  loanApplicationId: string;
  accessToken: string | null;
  onVerificationComplete?: (verified: boolean) => void;
}

interface VerificationStatus {
  status: 'idle' | 'processing' | 'verified' | 'failed';
  verifiedAt?: string;
  proofHash?: string;
  error?: string;
}

/**
 * Bank Verification Status Component
 *
 * User-friendly display of bank account verification status.
 * Hides technical details (DSCR, zkProofs) from users.
 */
export default function DscrVerificationStatus({
  loanApplicationId,
  accessToken,
  onVerificationComplete,
}: DscrVerificationStatusProps) {
  const [status, setStatus] = useState<VerificationStatus>({ status: 'idle' });

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    // Start processing when access token is available
    setStatus({ status: 'processing' });

    // Poll for verification status
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/loan/${loanApplicationId}/dscr-status`);
        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (data.verified) {
          setStatus({
            status: 'verified',
            verifiedAt: data.verifiedAt,
            proofHash: data.proofHash,
          });
          onVerificationComplete?.(true);
          clearInterval(pollInterval);
        } else if (data.error) {
          setStatus({
            status: 'failed',
            error: data.error,
          });
          onVerificationComplete?.(false);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling verification status:', error);
      }
    }, 3000);

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  }, [accessToken, loanApplicationId, onVerificationComplete]);

  if (status.status === 'idle') {
    return null;
  }

  if (status.status === 'processing') {
    return (
      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div>
            <p className="font-medium text-blue-900">Verifying Your Account</p>
            <p className="text-sm text-blue-700">
              Securely analyzing your transaction history...
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
          <Lock className="h-3 w-3" />
          <span>Your data is encrypted and secure</span>
        </div>
      </div>
    );
  }

  if (status.status === 'failed') {
    return (
      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-900">Verification Issue</p>
            <p className="text-sm text-red-700">
              {status.error || 'Unable to verify account. Please try connecting again.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Verified state - display zkProof hash
  return (
    <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <div className="flex-1">
          <p className="font-medium text-green-900">Account Verified</p>
          <p className="text-sm text-green-700">
            Your financial information has been securely verified
          </p>
        </div>
      </div>

      {/* zkProof Hash Display */}
      {status.proofHash && (
        <div className="mt-4 rounded-md border border-green-300 bg-green-100/50 p-3">
          <div className="flex items-center gap-2 text-xs text-green-800">
            <Shield className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium">zkProof Hash:</span>
          </div>
          <a
            href={`${process.env.NEXT_PUBLIC_CARTESI_INSPECT_URL || 'http://localhost:8080'}/inspect/zkfetch/loan_id/${loanApplicationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-2 group"
          >
            <p className="break-all font-mono text-xs text-green-700 group-hover:text-blue-600 group-hover:underline transition-colors">
              {status.proofHash}
            </p>
            <ExternalLink className="h-3 w-3 flex-shrink-0 text-green-600 group-hover:text-blue-600 transition-colors" />
          </a>
          <p className="mt-1 text-xs text-green-600 italic">
            Click to view proof in Cartesi
          </p>
        </div>
      )}

      {status.verifiedAt && (
        <div className="mt-3 text-xs text-gray-500">
          Verified on {new Date(status.verifiedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
