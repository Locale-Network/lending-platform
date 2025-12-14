'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { X, ArrowRight, TrendingUp, Users, Wallet, BarChart3 } from 'lucide-react';
import Link from 'next/link';

type Pool = {
  id: string;
  name: string;
  slug: string;
  description: string;
  poolType: string;
  annualizedReturn: number;
  totalStaked: number;
  totalInvestors: number;
  minimumStake: number;
  availableLiquidity: number;
  riskLevel?: string;
  status: string;
  isFeatured: boolean;
};

type PoolComparisonProps = {
  pools: Pool[];
  selectedPools: string[];
  onTogglePool: (poolId: string) => void;
  onClearSelection: () => void;
};

export function PoolComparison({
  pools,
  selectedPools,
  onTogglePool,
  onClearSelection,
}: PoolComparisonProps) {
  const selectedPoolData = pools.filter(p => selectedPools.includes(p.id));
  const canCompare = selectedPoolData.length >= 2;

  if (selectedPools.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-medium">
              {selectedPools.length} pool{selectedPools.length !== 1 ? 's' : ''} selected for comparison
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  disabled={!canCompare}
                  size="sm"
                >
                  Compare Pools
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Pool Comparison</DialogTitle>
                  <DialogDescription>
                    Compare key metrics across selected pools
                  </DialogDescription>
                </DialogHeader>
                <ComparisonTable pools={selectedPoolData} />
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonTable({ pools }: { pools: Pool[] }) {
  const metrics = [
    { label: 'APY', key: 'annualizedReturn', format: (val: any) => `${val.toFixed(1)}%` },
    { label: 'TVL', key: 'totalStaked', format: (val: any) => `${(val / 1000000).toFixed(2)}M USDC` },
    { label: 'Available Liquidity', key: 'availableLiquidity', format: (val: any) => `${(val / 1000).toFixed(0)}K USDC` },
    { label: 'Total Investors', key: 'totalInvestors', format: (val: any) => val.toLocaleString() },
    { label: 'Minimum Stake', key: 'minimumStake', format: (val: any) => `${val.toLocaleString()} USDC` },
    { label: 'Pool Type', key: 'poolType', format: (val: any) => val.replace('_', ' ') },
    { label: 'Risk Level', key: 'riskLevel', format: (val: any) => val || 'N/A' },
    { label: 'Status', key: 'status', format: (val: any) => val },
  ];

  return (
    <div className="space-y-6">
      {/* Pool Names */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${pools.length}, 1fr)` }}>
        <div className="font-semibold">Pool</div>
        {pools.map(pool => (
          <div key={pool.id} className="font-semibold text-sm">
            {pool.name}
            {pool.isFeatured && (
              <Badge className="ml-2 bg-yellow-400 text-yellow-900">Featured</Badge>
            )}
          </div>
        ))}
      </div>

      {/* Metrics */}
      {metrics.map(metric => {
        const values = pools.map(pool => (pool as any)[metric.key]);
        const numericValues = values.filter(v => typeof v === 'number') as number[];
        const bestValue = numericValues.length > 0 ? Math.max(...numericValues) : null;

        return (
          <div
            key={metric.key}
            className="grid gap-4 py-3 border-t"
            style={{ gridTemplateColumns: `200px repeat(${pools.length}, 1fr)` }}
          >
            <div className="text-sm text-muted-foreground">{metric.label}</div>
            {pools.map(pool => {
              const value = (pool as any)[metric.key];
              const isBest = bestValue !== null && value === bestValue;
              return (
                <div key={pool.id} className="text-sm">
                  <span className={isBest ? 'font-bold text-green-600' : ''}>
                    {metric.format(value)}
                  </span>
                  {isBest && metric.key !== 'poolType' && metric.key !== 'riskLevel' && metric.key !== 'status' && (
                    <Badge variant="outline" className="ml-2 text-xs border-green-600 text-green-600">
                      Best
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Actions */}
      <div className="grid gap-4 pt-4 border-t" style={{ gridTemplateColumns: `200px repeat(${pools.length}, 1fr)` }}>
        <div className="text-sm font-semibold">View Details</div>
        {pools.map(pool => (
          <Link key={pool.id} href={`/explore/pools/${pool.slug}`}>
            <Button variant="outline" size="sm" className="w-full">
              View Pool
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PoolComparisonCheckbox({
  poolId,
  isSelected,
  onToggle,
}: {
  poolId: string;
  isSelected: boolean;
  onToggle: (poolId: string) => void;
}) {
  return (
    <div className="flex items-center space-x-2" onClick={(e) => e.preventDefault()}>
      <Checkbox
        id={`compare-${poolId}`}
        checked={isSelected}
        onCheckedChange={() => onToggle(poolId)}
      />
      <label
        htmlFor={`compare-${poolId}`}
        className="text-xs text-muted-foreground cursor-pointer select-none"
      >
        Compare
      </label>
    </div>
  );
}
