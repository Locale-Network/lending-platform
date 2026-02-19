'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShieldCheck,
  TrendingUp,
  PieChart,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Info,
  Percent,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CompositeRiskScoreCard } from './composite-risk-score-card';
import { RiskBreakdownPanel } from './risk-breakdown-panel';
import type { ConcentrationLevel, RiskTier } from '@/services/risk/calculations';

/**
 * Pool Risk Dashboard - Shows aggregated risk metrics for investor transparency
 *
 * Enhanced to support both simple metrics and composite scoring for multi-borrower pools.
 * - Single-borrower pools: Show simple metrics only
 * - Multi-borrower pools (2+ loans): Show composite score with breakdown
 */

interface PoolRiskMetrics {
  avgLendScore: number | null;
  lendScoreDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  avgDscr: number;
  dscrDistribution: {
    excellent: number;
    good: number;
    adequate: number;
    marginal: number;
    weak: number;
  };
  totalActiveLoans: number;
  avgInterestRate: number;
  avgInterestRateFormatted: string;
  industryBreakdown: Record<string, number>;
  loansVerifiedOnChain: number;
  verificationRate: number;
}

interface ComponentScore {
  weight: number;
  score: number;
  contribution: number;
}

interface CompositeMetrics {
  compositeRiskScore: number;
  riskTier: RiskTier;
  riskTierBadgeColor: string;
  weightedAvgDscr: number;
  weightedAvgRate: number;
  weightedAvgRateFormatted: string;
  weightedAvgLendScore: number | null;
  diversificationScore: number;
  hhiIndex: number;
  borrowerConcentration: ConcentrationLevel;
  componentScores: {
    dscr: ComponentScore;
    lendScore: ComponentScore;
    diversification: ComponentScore;
    rate: ComponentScore;
  };
  calculatedAt: string;
}

interface PoolRiskDashboardProps {
  riskMetrics: PoolRiskMetrics | null;
  compositeMetrics?: CompositeMetrics | null;
  borrowerType?: 'SINGLE_BORROWER' | 'MULTI_BORROWER' | 'SYNDICATED';
  isLoading?: boolean;
}

// Get health badge styling based on tier
function getDscrBadge(dscr: number) {
  if (dscr >= 2.0) return { label: 'Excellent', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
  if (dscr >= 1.5) return { label: 'Good', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
  if (dscr >= 1.25) return { label: 'Adequate', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
  if (dscr >= 1.0) return { label: 'Marginal', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' };
  return { label: 'Weak', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
}

function getLendScoreBadge(score: number | null) {
  if (score === null) return { label: 'N/A', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
  if (score >= 80) return { label: 'Excellent', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
  if (score >= 60) return { label: 'Good', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
  if (score >= 40) return { label: 'Fair', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
  return { label: 'Poor', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
}

const dscrColors = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  adequate: 'bg-amber-500',
  marginal: 'bg-orange-500',
  weak: 'bg-red-500',
};

const lendScoreColors = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  fair: 'bg-amber-500',
  poor: 'bg-red-500',
};

function DistributionBar({
  distribution,
  colors,
  total,
}: {
  distribution: Record<string, number>;
  colors: Record<string, string>;
  total: number;
}) {
  if (total === 0) return null;

  return (
    <div className="flex h-3 rounded-full overflow-hidden bg-muted">
      {Object.entries(distribution).map(([key, count]) => {
        const percentage = (count / total) * 100;
        if (percentage === 0) return null;
        return (
          <TooltipProvider key={key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(colors[key], 'h-full transition-all')}
                  style={{ width: `${percentage}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="capitalize">{key}: {count} loans ({percentage.toFixed(0)}%)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

export function PoolRiskDashboard({
  riskMetrics,
  compositeMetrics,
  borrowerType = 'MULTI_BORROWER',
  isLoading,
}: PoolRiskDashboardProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'breakdown'>('summary');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Pool Risk Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!riskMetrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Pool Risk Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Risk metrics will be available once loans are funded in this pool.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    avgLendScore,
    lendScoreDistribution,
    avgDscr,
    dscrDistribution,
    totalActiveLoans,
    avgInterestRateFormatted,
    industryBreakdown,
    loansVerifiedOnChain,
  } = riskMetrics;

  // Determine if we should show composite metrics
  const isMultiBorrower = borrowerType === 'MULTI_BORROWER' || borrowerType === 'SYNDICATED';
  const hasComposite = isMultiBorrower && compositeMetrics && totalActiveLoans >= 2;

  const totalDscrLoans = Object.values(dscrDistribution).reduce((a, b) => a + b, 0);
  const totalLendScoreLoans = Object.values(lendScoreDistribution).reduce((a, b) => a + b, 0);

  const dscrBadge = getDscrBadge(avgDscr);
  const lendScoreBadge = getLendScoreBadge(avgLendScore);

  // Only show distribution charts when there are 3+ loans
  const showDistributions = totalActiveLoans >= 3;

  // Simple metrics content (reused in both single-borrower and multi-borrower views)
  const SimpleMetricsContent = () => (
    <div className="space-y-6">
      {/* Key Metrics - Clean grid layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* DSCR */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>DSCR</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Debt Service Coverage Ratio measures ability to cover debt payments. Higher is better. 1.25+ is healthy.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge className={dscrBadge.className}>{dscrBadge.label}</Badge>
          </div>
          <p className="text-3xl font-bold">{avgDscr > 0 ? avgDscr.toFixed(2) : '—'}</p>
        </div>

        {/* LendScore */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span>LendScore</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Plaid LendScore (1-99) assesses cash flow patterns from bank data. Higher indicates healthier finances.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge className={lendScoreBadge.className}>{lendScoreBadge.label}</Badge>
          </div>
          <p className="text-3xl font-bold">{avgLendScore ?? '—'}</p>
        </div>

        {/* Interest Rate */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Percent className="h-4 w-4" />
            <span>Avg Interest Rate</span>
          </div>
          <p className="text-3xl font-bold">{avgInterestRateFormatted}</p>
        </div>

        {/* Verification Status */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>On-Chain Verified</span>
          </div>
          <p className="text-3xl font-bold">
            {loansVerifiedOnChain}/{totalActiveLoans}
            <span className="text-lg text-muted-foreground ml-1">loans</span>
          </p>
        </div>
      </div>

      {/* Distribution Charts - Only show when meaningful (3+ loans) */}
      {showDistributions && (
        <>
          {/* DSCR Distribution */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">DSCR Distribution</h4>
            <DistributionBar
              distribution={dscrDistribution}
              colors={dscrColors}
              total={totalDscrLoans}
            />
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(dscrDistribution).map(([key, count]) => (
                count > 0 && (
                  <div key={key} className="flex items-center gap-1">
                    <div className={cn('w-2 h-2 rounded-full', dscrColors[key as keyof typeof dscrColors])} />
                    <span className="capitalize">{key}: {count}</span>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* LendScore Distribution */}
          {totalLendScoreLoans > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">LendScore Distribution</h4>
              <DistributionBar
                distribution={lendScoreDistribution}
                colors={lendScoreColors}
                total={totalLendScoreLoans}
              />
              <div className="flex flex-wrap gap-3 text-xs">
                {Object.entries(lendScoreDistribution).map(([key, count]) => (
                  count > 0 && (
                    <div key={key} className="flex items-center gap-1">
                      <div className={cn('w-2 h-2 rounded-full', lendScoreColors[key as keyof typeof lendScoreColors])} />
                      <span className="capitalize">{key}: {count}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Industry Breakdown */}
      {Object.keys(industryBreakdown).length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Industry Breakdown
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(industryBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([industry, percentage]) => (
                <Badge key={industry} variant="secondary" className="font-normal">
                  {industry}: {percentage}%
                </Badge>
              ))}
          </div>
        </div>
      )}

      {/* Data Source Note */}
      <p className="text-xs text-muted-foreground pt-2 border-t">
        DSCR verified via Cartesi computation. LendScore from Plaid. View Active Loans tab for individual loan details.
      </p>
    </div>
  );

  // For multi-borrower pools with composite data, show tabs
  if (hasComposite) {
    return (
      <div className="space-y-6">
        {/* Composite Score Card - Always visible for multi-borrower */}
        <CompositeRiskScoreCard
          compositeMetrics={compositeMetrics}
          loanCount={totalActiveLoans}
          borrowerType={borrowerType}
          onViewBreakdown={() => setActiveTab('breakdown')}
        />

        {/* Tabs for Summary vs Detailed Breakdown */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'summary' | 'breakdown')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Detailed Breakdown
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Pool Risk Summary
                </CardTitle>
                <CardDescription>
                  {totalActiveLoans} active loan{totalActiveLoans !== 1 ? 's' : ''} • {loansVerifiedOnChain} verified on-chain
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleMetricsContent />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="breakdown" className="mt-4">
            <RiskBreakdownPanel
              compositeMetrics={compositeMetrics}
              simpleMetrics={{
                avgDscr,
                avgLendScore,
                avgInterestRateFormatted,
                industryBreakdown,
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // For single-borrower or pools without composite data, show simple view
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Pool Risk Summary
        </CardTitle>
        <CardDescription>
          {totalActiveLoans} active loan{totalActiveLoans !== 1 ? 's' : ''} • {loansVerifiedOnChain} verified on-chain
          {borrowerType === 'SINGLE_BORROWER' && (
            <Badge variant="outline" className="ml-2">Single Borrower</Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SimpleMetricsContent />
      </CardContent>
    </Card>
  );
}
