'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { ConcentrationLevel, RiskTier } from '@/services/risk/calculations';

/**
 * Composite Risk Score Card - Displays the weighted composite risk score
 * for multi-borrower pools using CMBS-style methodology.
 */

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

interface CompositeRiskScoreCardProps {
  compositeMetrics: CompositeMetrics | null;
  loanCount: number;
  borrowerType: 'SINGLE_BORROWER' | 'MULTI_BORROWER' | 'SYNDICATED';
  isLoading?: boolean;
  onViewBreakdown?: () => void;
}

// Color mapping for risk tiers
const riskTierColors: Record<string, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700',
};

// Gauge colors for the circular score display
const gaugeColors: Record<string, string> = {
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};

function CircularGauge({ score, color }: { score: number; color: string }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const gaugeColor = gaugeColors[color] || gaugeColors.blue;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={gaugeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-500"
        />
      </svg>
      {/* Score display in center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{Math.round(score)}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function ComponentBar({ label, score, weight, contribution }: ComponentScore & { label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label} ({(weight * 100)}%)</span>
        <span className="font-medium">{score.toFixed(0)} pts</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground text-right">
        +{contribution.toFixed(1)} to composite
      </div>
    </div>
  );
}

export function CompositeRiskScoreCard({
  compositeMetrics,
  loanCount,
  borrowerType,
  isLoading,
  onViewBreakdown,
}: CompositeRiskScoreCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Don't show for single-borrower pools
  if (borrowerType === 'SINGLE_BORROWER') {
    return null;
  }

  // Show message for multi-borrower with < 2 loans
  if (loanCount < 2) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            Composite Risk Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">
              Composite scoring requires at least 2 loans in the pool.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Current: {loanCount} loan{loanCount !== 1 ? 's' : ''}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            Composite Risk Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-muted" />
            <div className="h-6 w-24 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data yet
  if (!compositeMetrics) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            Composite Risk Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">
              Composite score not yet calculated.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Score will be computed when DSCR verification completes.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { compositeRiskScore, riskTier, riskTierBadgeColor, componentScores, borrowerConcentration, calculatedAt } = compositeMetrics;
  const badgeClass = riskTierColors[riskTierBadgeColor] || riskTierColors.blue;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            Composite Risk Score
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium mb-1">CMBS-Style Composite Score</p>
                  <p className="text-xs">
                    Weighted by loan principal: 40% DSCR, 25% LendScore,
                    20% Diversification (HHI), 15% Interest Rate.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <Badge className={cn('border', badgeClass)}>{riskTier}</Badge>
        </div>
        <CardDescription>
          {loanCount} loans • {borrowerConcentration}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Circular gauge */}
        <div className="flex justify-center">
          <CircularGauge score={compositeRiskScore} color={riskTierBadgeColor} />
        </div>

        {/* Toggle for component breakdown */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span>View Score Breakdown</span>
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {/* Component breakdown */}
        {showDetails && (
          <div className="space-y-4 pt-2 border-t">
            <ComponentBar
              label="DSCR"
              {...componentScores.dscr}
            />
            <ComponentBar
              label="LendScore"
              {...componentScores.lendScore}
            />
            <ComponentBar
              label="Diversification"
              {...componentScores.diversification}
            />
            <ComponentBar
              label="Interest Rate"
              {...componentScores.rate}
            />
          </div>
        )}

        {/* Last calculated timestamp */}
        <p className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(calculatedAt).toLocaleString()}
        </p>

        {/* View full breakdown button */}
        {onViewBreakdown && (
          <Button variant="outline" size="sm" className="w-full" onClick={onViewBreakdown}>
            View Full Breakdown
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
