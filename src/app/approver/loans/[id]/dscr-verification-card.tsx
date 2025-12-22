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
  AlertTriangle,
  ExternalLink,
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
  borrowerAddress: string;
}

/**
 * DSCR Verification Card for Approvers
 *
 * Enhanced view for loan approvers showing:
 * - Verification status and risk indicators
 * - DSCR value with risk assessment
 * - LendScore with detailed breakdown
 * - Transaction analysis summary
 */
export default function DscrVerificationCard({
  loanApplicationId,
  borrowerAddress,
}: DscrVerificationCardProps) {
  const [data, setData] = useState<DscrVerificationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDscrStatus() {
      try {
        // Approvers may need a different endpoint or bypass owner check
        const response = await fetch(
          `/api/loan/${loanApplicationId}/dscr-status?approver=true`
        );
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
      <Card className="animate-pulse">
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
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Shield className="h-5 w-5 text-gray-400" />
            DSCR Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg bg-yellow-50 p-4 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-medium">Not Yet Verified</p>
              <p className="text-sm">
                DSCR verification has not been completed for this loan application.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const dscrDisplay = data.dscrValue ? (data.dscrValue / 1000).toFixed(2) : '-';
  const interestRateDisplay = data.interestRate
    ? `${(data.interestRate / 100).toFixed(2)}%`
    : '-';

  // Risk assessment for approvers
  const riskLevel =
    data.dscrValue && data.dscrValue >= 1500
      ? 'low'
      : data.dscrValue && data.dscrValue >= 1250
        ? 'moderate'
        : data.dscrValue && data.dscrValue >= 1000
          ? 'elevated'
          : 'high';

  const riskColors = {
    low: 'border-green-500 bg-green-50 text-green-700',
    moderate: 'border-blue-500 bg-blue-50 text-blue-700',
    elevated: 'border-yellow-500 bg-yellow-50 text-yellow-700',
    high: 'border-red-500 bg-red-50 text-red-700',
  };

  const riskLabels = {
    low: 'Low Risk',
    moderate: 'Moderate Risk',
    elevated: 'Elevated Risk',
    high: 'High Risk',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Shield className="h-5 w-5 text-green-600" />
            DSCR Verification
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`border ${riskColors[riskLevel]}`}>
              {riskLabels[riskLevel]}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    zkVerified
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Verified using zkFetch + Cartesi</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">DSCR</p>
            <p className="text-xl font-bold">{dscrDisplay}</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Interest Rate</p>
            <p className="text-xl font-bold text-green-600">{interestRateDisplay}</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-xl font-bold">{data.transactionCount || '-'}</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">LendScore</p>
            <p className="text-xl font-bold text-purple-600">
              {data.lendScore || '-'}
              {data.lendScore && <span className="text-sm text-gray-400">/99</span>}
            </p>
          </div>
        </div>

        {/* LendScore Details */}
        {data.lendScore && data.lendScoreReasons && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <p className="text-sm font-medium text-purple-900">
                LendScore Factors
              </p>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
              {data.lendScoreReasons.map((reason, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 text-xs text-purple-700"
                >
                  <CheckCircle className="h-3 w-3" />
                  {reason}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verification Details */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`${process.env.NEXT_PUBLIC_CARTESI_INSPECT_URL || 'http://localhost:8080'}/inspect/zkfetch/loan_id/${loanApplicationId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-600 hover:underline transition-colors"
                >
                  <Hash className="h-3 w-3" />
                  <span>Proof: {data.proofHash?.slice(0, 20)}...</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>View verification proof in Cartesi</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              {data.verifiedAt
                ? new Date(data.verifiedAt).toLocaleString()
                : '-'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
