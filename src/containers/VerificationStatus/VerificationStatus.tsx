'use client';

import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface VerificationStatusProps {
  signedUrl: string;
  statusUrl: string;
}

const VerificationStatus: React.FC<VerificationStatusProps> = ({ signedUrl, statusUrl }) => {
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(statusUrl);
        const jsonResponse = await response.json();
        if (jsonResponse?.session?.statusV2 === 'PROOF_SUBMITTED') {
          setIsVerified(true);
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    };

    const intervalId = setInterval(pollStatus, 3000); // Poll every 3 seconds

    return () => {
      clearInterval(intervalId); // Clean up interval on component unmount
    };
  }, [statusUrl]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      {isVerified ? (
        <div className="text-2xl font-bold text-green-600">Verification Successful!</div>
      ) : (
        <>
          <div className="mb-4">
            <QRCode value={signedUrl} size={256} />
          </div>
          <Link href={signedUrl}>
            <Button>Link Account</Button>
          </Link>
          <div className="mt-4 text-sm text-gray-500">Waiting for verification...</div>
          <div>
            <svg
              className="h-5 w-5 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="black"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="black"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        </>
      )}
    </div>
  );
};

export default VerificationStatus;
