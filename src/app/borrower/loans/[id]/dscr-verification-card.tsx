'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Shield,
  CheckCircle,
  TrendingUp,
  Hash,
  Calendar,
  FileText,
  Sparkles,
  Info,
} from 'lucide-react';

interface DscrVerificationData {
  verified: boolean;
  dscrValue?: number;
  interestRate?: number;
  baseInterestRate?: number;
  proofHash?: string;
  verifiedAt?: string;
  transactionCount?: number;
  lendScore?: number | null;
  lendScoreReasons?: string[] | null;
}

interface DscrVerificationCardProps {
  loanApplicationId: string;
}

/**
 * DSCR Verification Card
 *
 * Displays the zkFetch + Cartesi verified DSCR information for a loan.
 * Shows:
 * - Verification status badge
 * - DSCR value with explanation
 * - Interest rate (base and adjusted)
 * - LendScore with reason codes
 * - Proof hash for transparency
 */
export default function DscrVerificationCard({
  loanApplicationId,
}: DscrVerificationCardProps) {
  const [data, setData] = useState<DscrVerificationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDscrStatus() {
      try {
        const response = await fetch(`/api/loan/${loanApplicationId}/dscr-status`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch DSCR status:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDscrStatus();
  }, [loanApplicationId]);

  if (loading) {
    return (
      <Card className="mx-auto w-full max-w-2xl animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-gray-200" />
            <div className="h-4 w-3/4 rounded bg-gray-200" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.verified) {
    return null;
  }

  const dscrDisplay = data.dscrValue ? (data.dscrValue / 1000).toFixed(2) : '-';
  const interestRateDisplay = data.interestRate
    ? `${(data.interestRate / 100).toFixed(2)}%`
    : '-';
  const baseRateDisplay = data.baseInterestRate
    ? `${(data.baseInterestRate / 100).toFixed(2)}%`
    : null;

  // Determine DSCR health indicator
  const dscrHealth =
    data.dscrValue && data.dscrValue >= 1500
      ? 'excellent'
      : data.dscrValue && data.dscrValue >= 1250
        ? 'good'
        : data.dscrValue && data.dscrValue >= 1000
          ? 'fair'
          : 'needs-improvement';

  const healthColors = {
    excellent: 'text-green-600 bg-green-50',
    good: 'text-blue-600 bg-blue-50',
    fair: 'text-yellow-600 bg-yellow-50',
    'needs-improvement': 'text-red-600 bg-red-50',
  };

  const healthLabels = {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    'needs-improvement': 'Needs Improvement',
  };

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Shield className="h-5 w-5 text-green-600" />
            Data Verification
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  zkVerified
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Verified using secure encryption</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* DSCR Value Section */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Debt Service Coverage Ratio
              </p>
              <p className="text-3xl font-bold">{dscrDisplay}</p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-sm font-medium ${healthColors[dscrHealth]}`}
            >
              {healthLabels[dscrHealth]}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            DSCR measures your ability to cover debt payments. A ratio above 1.25
            indicates strong cash flow.
          </p>
        </div>

        {/* Interest Rate Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Interest Rate</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {interestRateDisplay}
            </p>
            {baseRateDisplay && data.interestRate !== data.baseInterestRate && (
              <p className="mt-1 text-xs text-muted-foreground">
                Base rate: {baseRateDisplay}
                {data.lendScore && (
                  <span className="ml-1 text-green-600">
                    (adjusted by LendScore)
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Transactions Analyzed</p>
            </div>
            <p className="mt-1 text-2xl font-bold">{data.transactionCount || '-'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rolling 3-month window
            </p>
          </div>
        </div>

        {/* LendScore Section */}
        {data.lendScore && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <p className="font-medium text-purple-900">LendScore</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-purple-600">
                  {data.lendScore}
                </span>
                <span className="text-sm text-purple-500">/99</span>
              </div>
            </div>
            {data.lendScoreReasons && data.lendScoreReasons.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-purple-700">
                  Score Factors:
                </p>
                <ul className="mt-1 space-y-1">
                  {data.lendScoreReasons.map((reason, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 text-xs text-purple-600"
                    >
                      <CheckCircle className="h-3 w-3" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Proof Details */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Hash className="h-3 w-3" />
            <span>Proof: {data.proofHash?.slice(0, 16)}...</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              Verified:{' '}
              {data.verifiedAt
                ? new Date(data.verifiedAt).toLocaleDateString()
                : '-'}
            </span>
          </div>
        </div>

        {/* Info Footer */}
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <p>
            Your financial data was verified using advanced encryption technology
            for secure, tamper-proof validation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
