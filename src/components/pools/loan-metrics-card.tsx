'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Clock,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Public loan metrics card for investor transparency.
 * Shows: LendScore, DSCR, interest rate, industry, verification status.
 * Excludes: borrower identity, loan amount, transactions.
 */

interface LoanMetricsCardProps {
  displayLabel: string;
  lendScore: number | null;
  lendScoreHealth: string;
  dscr: number;
  dscrHealth: string;
  interestRate: number;
  interestRateFormatted: string;
  status: string;
  industry: string;
  proofHash: string;
  verifiedAt: string | null;
  verifiedOnChain: boolean;
  proofSource: 'onchain' | 'cartesi' | 'local';
  explorerUrl: string | null;
}

const healthColors: Record<string, string> = {
  Excellent: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  Good: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  Adequate: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
  Fair: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
  Marginal: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
  Poor: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  Weak: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  Unknown: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30',
};

const sourceLabels: Record<string, { label: string; color: string }> = {
  onchain: { label: 'On-Chain Verified', color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' },
  cartesi: { label: 'Cartesi Verified', color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30' },
  local: { label: 'Pending Verification', color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30' },
};

export function LoanMetricsCard({
  displayLabel,
  lendScore,
  lendScoreHealth,
  dscr,
  dscrHealth,
  interestRateFormatted,
  industry,
  proofHash,
  verifiedAt,
  verifiedOnChain,
  proofSource,
  explorerUrl,
}: LoanMetricsCardProps) {
  const sourceInfo = sourceLabels[proofSource] || sourceLabels.local;
  const truncatedHash = proofHash ? `${proofHash.slice(0, 8)}...${proofHash.slice(-6)}` : 'N/A';

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-medium">
            {industry}
          </Badge>
          <span className="text-sm font-medium text-muted-foreground">
            {displayLabel}
          </span>
        </div>
        <Badge className={cn('text-xs', sourceInfo.color)}>
          {verifiedOnChain ? (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          ) : proofSource === 'cartesi' ? (
            <ShieldCheck className="h-3 w-3 mr-1" />
          ) : (
            <Clock className="h-3 w-3 mr-1" />
          )}
          {sourceInfo.label}
        </Badge>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-3">
        {/* LendScore */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">LendScore</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">
              {lendScore ?? '—'}
            </span>
            {lendScore !== null && (
              <Badge className={cn('text-xs', healthColors[lendScoreHealth] || healthColors.Unknown)}>
                {lendScoreHealth}
              </Badge>
            )}
          </div>
        </div>

        {/* DSCR */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">DSCR</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">
              {dscr > 0 ? dscr.toFixed(2) : '—'}
            </span>
            {dscr > 0 && (
              <Badge className={cn('text-xs', healthColors[dscrHealth] || healthColors.Unknown)}>
                {dscrHealth}
              </Badge>
            )}
          </div>
        </div>

        {/* Interest Rate */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Interest Rate</p>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-semibold text-green-600 dark:text-green-400">
              {interestRateFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Verification Details */}
      <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          {/* Proof Hash */}
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            <span>Proof:</span>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline flex items-center gap-1"
              >
                {truncatedHash}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="font-mono">{truncatedHash}</span>
            )}
          </div>
        </div>

        {/* Verification Time */}
        {verifiedAt && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              Verified: {new Date(verifiedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Empty state for when no loans exist in a pool
 */
export function NoLoansCard() {
  return (
    <Card className="p-8 text-center">
      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <h3 className="text-lg font-medium mb-2">No Active Loans</h3>
      <p className="text-sm text-muted-foreground">
        This pool does not have any funded loans yet. Loan metrics will appear here once borrowers are funded.
      </p>
    </Card>
  );
}
