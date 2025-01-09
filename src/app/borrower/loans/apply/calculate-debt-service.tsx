'use client';

import { useState, useEffect } from 'react';
import { XCircle } from 'lucide-react';
import { DebtServiceApiResponse } from '@/app/api/loan/[id]/debt-service/get';
import { Transaction } from 'plaid';

export default function CalculateDebtService({
  accessToken,
  loanApplicationId,
}: {
  accessToken: string;
  loanApplicationId: string;
}) {
  const [apiError, setApiError] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  useEffect(() => {
    if (accessToken) {
      fetch(`/api/loan/${loanApplicationId}/debt-service`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then(response => response.json())
        .then((data: DebtServiceApiResponse) => {
          if (data.status === 'error') {
            setApiError(data.message);
          } else {
            setTransactions(data.data?.transactions ?? null);
          }
        })
        .catch(() => setApiError('Error fetching credit score'));
    }
  }, [loanApplicationId, accessToken]);

  if (apiError) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
        <XCircle className="h-5 w-5" />
        <span>{apiError}</span>
      </div>
    );
  }

  if (transactions) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-600">
        <p>Success</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-4 text-gray-600">
      <span>Processing transactions...</span>
    </div>
  );
}
