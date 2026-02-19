'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  ShieldCheck,
  GitBranch,
  Percent,
  ArrowRight,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ConcentrationLevel, RiskTier } from '@/services/risk/calculations';

/**
 * Risk Breakdown Panel - Detailed view of composite risk components
 * Shows weighted vs simple averages, HHI visualization, and component contributions.
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

interface SimpleMetrics {
  avgDscr: number;
  avgLendScore: number | null;
  avgInterestRateFormatted: string;
  industryBreakdown: Record<string, number>;
}

interface RiskBreakdownPanelProps {
  compositeMetrics: CompositeMetrics;
  simpleMetrics: SimpleMetrics;
}

// HHI thresholds visualization
const HHI_MARKERS = [
  { value: 0, label: '0' },
  { value: 0.15, label: '0.15' },
  { value: 0.25, label: '0.25' },
  { value: 1, label: '1.0' },
];

function HHIGauge({ hhi, concentration }: { hhi: number; concentration: ConcentrationLevel }) {
  // Calculate position on the gauge (0-100%)
  const position = Math.min(100, hhi * 100);

  // Color based on concentration
  const getColor = () => {
    if (hhi < 0.15) return 'bg-green-500';
    if (hhi < 0.25) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Well Diversified</span>
        <span>Moderate</span>
        <span>Highly Concentrated</span>
      </div>
      <div className="relative h-3 rounded-full bg-gradient-to-r from-green-200 via-amber-200 to-red-200 dark:from-green-900/30 dark:via-amber-900/30 dark:to-red-900/30">
        {/* Threshold markers */}
        <div className="absolute top-0 left-[15%] w-0.5 h-3 bg-muted-foreground/30" />
        <div className="absolute top-0 left-[25%] w-0.5 h-3 bg-muted-foreground/30" />

        {/* Indicator */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all',
            getColor()
          )}
          style={{ left: `calc(${position}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-xs">
        {HHI_MARKERS.map((marker) => (
          <span key={marker.value} className="text-muted-foreground">
            {marker.label}
          </span>
        ))}
      </div>
      <div className="text-center">
        <Badge variant="outline" className="mt-2">
          HHI: {hhi.toFixed(4)} • {concentration}
        </Badge>
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  icon: Icon,
  weighted,
  simple,
  unit = '',
  higherBetter = true,
}: {
  label: string;
  icon: React.ElementType;
  weighted: string | number;
  simple: string | number;
  unit?: string;
  higherBetter?: boolean;
}) {
  const weightedNum = typeof weighted === 'number' ? weighted : parseFloat(weighted);
  const simpleNum = typeof simple === 'number' ? simple : parseFloat(simple);
  const difference = weightedNum - simpleNum;
  const showDiff = !isNaN(difference) && Math.abs(difference) > 0.01;

  const isPositive = higherBetter ? difference > 0 : difference < 0;
  const diffColor = isPositive ? 'text-green-600' : 'text-red-600';

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Simple Avg</p>
          <p className="font-medium">{simple}{unit}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Weighted Avg</p>
          <p className="font-bold">{weighted}{unit}</p>
        </div>
        {showDiff && (
          <span className={cn('text-xs font-medium', diffColor)}>
            ({difference > 0 ? '+' : ''}{difference.toFixed(2)})
          </span>
        )}
      </div>
    </div>
  );
}

function ComponentContributionBar({
  label,
  icon: Icon,
  weight,
  score,
  contribution,
  color,
}: ComponentScore & {
  label: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="secondary" className="text-xs">{(weight * 100)}%</Badge>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold">{score.toFixed(0)}</span>
          <span className="text-xs text-muted-foreground ml-1">→ +{contribution.toFixed(1)}</span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function RiskBreakdownPanel({ compositeMetrics, simpleMetrics }: RiskBreakdownPanelProps) {
  const {
    compositeRiskScore,
    riskTier,
    weightedAvgDscr,
    weightedAvgRateFormatted,
    weightedAvgLendScore,
    diversificationScore,
    hhiIndex,
    borrowerConcentration,
    componentScores,
  } = compositeMetrics;

  const { avgDscr, avgLendScore, avgInterestRateFormatted, industryBreakdown } = simpleMetrics;

  return (
    <div className="space-y-6">
      {/* Weighted vs Simple Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weighted vs Simple Averages</CardTitle>
          <CardDescription>
            Principal-weighted averages give more influence to larger loans
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <ComparisonRow
            label="DSCR"
            icon={TrendingUp}
            weighted={weightedAvgDscr.toFixed(2)}
            simple={avgDscr.toFixed(2)}
            higherBetter={true}
          />
          <ComparisonRow
            label="LendScore"
            icon={ShieldCheck}
            weighted={weightedAvgLendScore?.toFixed(0) ?? '—'}
            simple={avgLendScore?.toFixed(0) ?? '—'}
            higherBetter={true}
          />
          <ComparisonRow
            label="Interest Rate"
            icon={Percent}
            weighted={weightedAvgRateFormatted}
            simple={avgInterestRateFormatted}
            higherBetter={false}
          />
        </CardContent>
      </Card>

      {/* HHI / Diversification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Concentration Risk (HHI)
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium mb-1">Herfindahl-Hirschman Index</p>
                  <p className="text-xs">
                    Measures portfolio concentration. Lower HHI = better diversification.
                    DOJ/FTC thresholds: &lt;0.15 (competitive), 0.15-0.25 (moderate), &gt;0.25 (concentrated).
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HHIGauge hhi={hhiIndex} concentration={borrowerConcentration} />

          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <div className="flex justify-between items-center">
              <span className="text-sm">Diversification Score</span>
              <span className="text-2xl font-bold">{diversificationScore.toFixed(0)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              (1 - HHI) × 100 = {((1 - hhiIndex) * 100).toFixed(1)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Component Contributions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Score Component Breakdown</CardTitle>
          <CardDescription>
            Each component contributes to the final composite score of {compositeRiskScore.toFixed(0)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ComponentContributionBar
            label="DSCR"
            icon={TrendingUp}
            {...componentScores.dscr}
            color="bg-blue-500"
          />
          <ComponentContributionBar
            label="LendScore"
            icon={ShieldCheck}
            {...componentScores.lendScore}
            color="bg-green-500"
          />
          <ComponentContributionBar
            label="Diversification"
            icon={GitBranch}
            {...componentScores.diversification}
            color="bg-purple-500"
          />
          <ComponentContributionBar
            label="Interest Rate"
            icon={Percent}
            {...componentScores.rate}
            color="bg-amber-500"
          />

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Composite Score</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{compositeRiskScore.toFixed(1)}</span>
                <Badge className="ml-2" variant="outline">{riskTier}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Industry Diversification */}
      {Object.keys(industryBreakdown).length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Industry Diversification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(industryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([industry, percentage]) => (
                  <div key={industry} className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm w-20 text-right">{industry}</span>
                    <span className="text-sm font-medium w-12 text-right">{percentage}%</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Methodology Note */}
      <p className="text-xs text-muted-foreground text-center px-4">
        Composite score calculated using CMBS-style principal-weighted methodology.
        Based on Federal Reserve and DBRS/BlackRock rating frameworks.
      </p>
    </div>
  );
}
