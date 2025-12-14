'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, Wallet, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  return res.json();
};

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-red-100 text-red-800',
};

export default function AdminPoolsPage() {
  const { data: pools, error: poolsError, isLoading: poolsLoading } = useSWR('/api/pools', fetcher);
  const { data: stats, error: statsError, isLoading: statsLoading } = useSWR(
    '/api/pools/stats',
    fetcher
  );

  const isLoading = poolsLoading || statsLoading;
  const error = poolsError || statsError;

  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pool Management</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage investment pools for lending
          </p>
        </div>
        <Link href="/admin/pools/create">
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Create New Pool
          </Button>
        </Link>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Failed to load pool data. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      {!isLoading && !error && stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pools</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPools ?? 0}</div>
              <p className="text-xs text-muted-foreground">{stats.activePools ?? 0} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats.totalValueLocked ?? 0).toLocaleString()} USDC</div>
              <p className="text-xs text-muted-foreground">Across all pools</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Investors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInvestors ?? 0}</div>
              <p className="text-xs text-muted-foreground">Unique addresses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg APY</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats.averageAPY ?? 0).toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Active pools only</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pools List */}
      {!isLoading && !error && Array.isArray(pools) && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">All Pools</h2>
          {pools.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No pools created yet. Create your first pool to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pools.map((pool: any) => (
            <Card key={pool.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{pool.name}</CardTitle>
                    <CardDescription className="mt-1">{pool.poolType.replace('_', ' ')}</CardDescription>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[pool.status as keyof typeof statusColors]}`}
                  >
                    {pool.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">TVL</p>
                    <p className="font-semibold">{(pool.totalStaked ?? 0).toLocaleString()} USDC</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">APY</p>
                    <p className="font-semibold">
                      {pool.annualizedReturn ? `${pool.annualizedReturn}%` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Investors</p>
                    <p className="font-semibold">{pool.totalInvestors ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Available</p>
                    <p className="font-semibold">{(pool.availableLiquidity ?? 0).toLocaleString()} USDC</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/admin/pools/${pool.id}`}>
                    <Button variant="outline" className="w-full">
                      Manage
                    </Button>
                  </Link>
                  <Link href={`/explore/pools/${pool.slug}`}>
                    <Button variant="ghost" className="w-full">
                      View
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
