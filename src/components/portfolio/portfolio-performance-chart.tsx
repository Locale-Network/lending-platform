'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMemo } from 'react';

type PortfolioPerformanceChartProps = {
  stakes: any[];
};

export function PortfolioPerformanceChart({ stakes }: PortfolioPerformanceChartProps) {
  // Calculate current portfolio snapshot (NOT simulated historical data)
  const portfolioSnapshot = useMemo(() => {
    if (!stakes || stakes.length === 0) return null;

    let totalInvested = 0;
    let totalEarnings = 0;

    stakes.forEach((stake) => {
      totalInvested += stake.amount || 0;
      totalEarnings += stake.pendingRewards || 0;
    });

    return {
      totalValue: totalInvested + totalEarnings,
      invested: totalInvested,
      earnings: totalEarnings,
    };
  }, [stakes]);

  if (!stakes || stakes.length === 0) {
    return null;
  }

  // Show current portfolio value without fake historical chart
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Portfolio Summary
            </CardTitle>
            <CardDescription>Current holdings</CardDescription>
          </div>
          {portfolioSnapshot && (
            <div className="text-right">
              <p className="text-2xl font-bold">{portfolioSnapshot.totalValue.toLocaleString()} USDC</p>
              {portfolioSnapshot.earnings > 0 && (
                <p className="text-sm text-green-600">
                  +{portfolioSnapshot.earnings.toLocaleString()} USDC earnings
                </p>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current portfolio breakdown */}
        {portfolioSnapshot && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Invested</p>
              <p className="text-xl font-semibold">{portfolioSnapshot.invested.toLocaleString()} USDC</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Pending Rewards</p>
              <p className="text-xl font-semibold text-green-600">
                {portfolioSnapshot.earnings.toLocaleString()} USDC
              </p>
            </div>
          </div>
        )}

        {/* Historical data notice */}
        <Alert variant="default" className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Historical performance charts are not yet available. We show your current portfolio
            snapshot based on on-chain stake positions and pending rewards.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
