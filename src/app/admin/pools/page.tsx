'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  TrendingUp,
  Wallet,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import LoadingDots from '@/components/ui/loading-dots';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  return res.json();
};

const poolStatusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-red-100 text-red-800',
};

const loanStatusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  ADDITIONAL_INFO_NEEDED: 'bg-orange-100 text-orange-800',
  APPROVED: 'bg-green-100 text-green-800',
  DISBURSED: 'bg-emerald-100 text-emerald-800',
  ACTIVE: 'bg-teal-100 text-teal-800',
  REPAID: 'bg-purple-100 text-purple-800',
  REJECTED: 'bg-red-100 text-red-800',
  DEFAULTED: 'bg-red-200 text-red-900',
};

const LoanStatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'APPROVED':
    case 'DISBURSED':
    case 'ACTIVE':
    case 'REPAID':
      return <CheckCircle className="h-3 w-3 text-green-600" />;
    case 'REJECTED':
    case 'DEFAULTED':
      return <XCircle className="h-3 w-3 text-red-600" />;
    case 'PENDING':
    case 'SUBMITTED':
    case 'ADDITIONAL_INFO_NEEDED':
      return <Clock className="h-3 w-3 text-yellow-600" />;
    default:
      return <AlertCircle className="h-3 w-3 text-gray-400" />;
  }
};

export default function AdminPoolsPage() {
  const [expandedPool, setExpandedPool] = useState<string | null>(null);
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
          <LoadingDots size="md" />
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
            <div className="space-y-4">
              {pools.map((pool: any) => (
                <Card key={pool.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                  {/* Pool Header - Clickable to expand */}
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedPool(expandedPool === pool.id ? null : pool.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <CardTitle className="text-lg">{pool.name}</CardTitle>
                            <Badge className={poolStatusColors[pool.status as keyof typeof poolStatusColors]}>
                              {pool.status}
                            </Badge>
                            {pool.isComingSoon && pool.status === 'DRAFT' && (
                              <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Public Preview
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="mt-1">{pool.poolType.replace('_', ' ')}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right text-sm mr-4">
                            <p className="text-muted-foreground">Loans in Pool</p>
                            <p className="font-semibold">{pool.loans?.length || 0}</p>
                          </div>
                          {expandedPool === pool.id ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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

                      <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
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
                  </div>

                  {/* Expanded Loans Section */}
                  {expandedPool === pool.id && (
                    <div className="border-t bg-muted/30 p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Loans in this Pool ({pool.loans?.length || 0})
                      </h4>
                      {!pool.loans || pool.loans.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No loans assigned to this pool yet
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {pool.loans.map((poolLoan: any) => (
                            <div
                              key={poolLoan.id}
                              className="bg-background border rounded-lg p-4 space-y-2"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {poolLoan.loanApplication?.businessLegalName || 'Unknown Business'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <LoanStatusIcon status={poolLoan.loanApplication?.status || 'DRAFT'} />
                                  <Badge className={loanStatusColors[poolLoan.loanApplication?.status || 'DRAFT']}>
                                    {poolLoan.loanApplication?.status || 'Unknown'}
                                  </Badge>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Principal</p>
                                  <p className="font-semibold">{poolLoan.principal?.toLocaleString() || 0} USDC</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Interest Rate</p>
                                  <p className="font-semibold">{poolLoan.interestRate?.toFixed(2) || 'N/A'}%</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Term</p>
                                  <p className="font-semibold">{poolLoan.termMonths || 'N/A'} months</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Expected Return</p>
                                  <p className="font-semibold text-green-600">
                                    {poolLoan.expectedReturn?.toLocaleString() || 0} USDC
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                                <span>
                                  Funded: {new Date(poolLoan.fundedAt).toLocaleDateString()}
                                </span>
                                <span className="font-mono">
                                  Borrower: {poolLoan.loanApplication?.accountAddress?.slice(0, 6)}...
                                  {poolLoan.loanApplication?.accountAddress?.slice(-4)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
