'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp, Users, Wallet, Star, Filter, Loader2 } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { AdvancedFiltersPanel, type AdvancedFilters } from '@/components/pools/advanced-filters';
import { ActiveFilters } from '@/components/pools/active-filters';
import { PoolComparison, PoolComparisonCheckbox } from '@/components/pools/pool-comparison';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const riskColors = {
  Low: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-red-100 text-red-800',
};

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-red-100 text-red-800',
};

export default function PoolsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('apy');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    apyRange: [0, 30],
    tvlRange: [0, 10000000],
    riskLevels: [],
    onlyFeatured: false,
    minInvestors: 0,
  });
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);

  // Fetch pools from API
  const { data: pools, error, isLoading } = useSWR('/api/pools/public', fetcher);

  // Filter removal handlers
  const handleRemoveFilter = (filterType: string, value?: any) => {
    switch (filterType) {
      case 'search':
        setSearchTerm('');
        break;
      case 'type':
        setFilterType('all');
        break;
      case 'status':
        setFilterStatus('all');
        break;
      case 'apyRange':
        setAdvancedFilters({ ...advancedFilters, apyRange: [0, 30] });
        break;
      case 'tvlRange':
        setAdvancedFilters({ ...advancedFilters, tvlRange: [0, 10000000] });
        break;
      case 'riskLevel':
        setAdvancedFilters({
          ...advancedFilters,
          riskLevels: advancedFilters.riskLevels.filter(l => l !== value),
        });
        break;
      case 'minInvestors':
        setAdvancedFilters({ ...advancedFilters, minInvestors: 0 });
        break;
      case 'featured':
        setAdvancedFilters({ ...advancedFilters, onlyFeatured: false });
        break;
    }
  };

  const resetAdvancedFilters = () => {
    setAdvancedFilters({
      apyRange: [0, 30],
      tvlRange: [0, 10000000],
      riskLevels: [],
      onlyFeatured: false,
      minInvestors: 0,
    });
  };

  // Comparison handlers
  const togglePoolForComparison = (poolId: string) => {
    setSelectedForComparison(prev =>
      prev.includes(poolId)
        ? prev.filter(id => id !== poolId)
        : [...prev, poolId]
    );
  };

  const clearComparison = () => {
    setSelectedForComparison([]);
  };

  // Filter and sort pools
  const filteredPools = (pools || [])
    .filter((pool: any) => {
      // Basic filters
      const matchesSearch =
        pool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pool.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || pool.poolType === filterType;
      const matchesStatus = filterStatus === 'all' || pool.status === filterStatus;

      // Advanced filters
      const apy = pool.annualizedReturn || 0;
      const matchesApy = apy >= advancedFilters.apyRange[0] && apy <= advancedFilters.apyRange[1];

      const tvl = pool.totalStaked || 0;
      const matchesTvl = tvl >= advancedFilters.tvlRange[0] && tvl <= advancedFilters.tvlRange[1];

      const matchesRiskLevel =
        advancedFilters.riskLevels.length === 0 ||
        advancedFilters.riskLevels.includes(pool.riskLevel);

      const matchesInvestors = (pool.totalInvestors || 0) >= advancedFilters.minInvestors;

      const matchesFeatured = !advancedFilters.onlyFeatured || pool.isFeatured;

      return matchesSearch && matchesType && matchesStatus &&
             matchesApy && matchesTvl && matchesRiskLevel &&
             matchesInvestors && matchesFeatured;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'apy') return (b.annualizedReturn || 0) - (a.annualizedReturn || 0);
      if (sortBy === 'tvl') return (b.totalStaked || 0) - (a.totalStaked || 0);
      if (sortBy === 'investors') return (b.totalInvestors || 0) - (a.totalInvestors || 0);
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return 0;
    });

  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staking Pools</h1>
        <p className="text-muted-foreground mt-2">
          Discover lending pools that match your investment goals
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading pools...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load pools. Please try again later.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (
        <>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pools by name or description..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Pool Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="SMALL_BUSINESS">Small Business</SelectItem>
                <SelectItem value="REAL_ESTATE">Real Estate</SelectItem>
                <SelectItem value="WORKING_CAPITAL">Working Capital</SelectItem>
                <SelectItem value="EQUIPMENT_FINANCING">Equipment Financing</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apy">Highest APY</SelectItem>
                <SelectItem value="tvl">Highest TVL</SelectItem>
                <SelectItem value="investors">Most Investors</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>


      {/* Pool Comparison */}
      <PoolComparison
        pools={pools || []}
        selectedPools={selectedForComparison}
        onTogglePool={togglePoolForComparison}
        onClearSelection={clearComparison}
      />

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredPools.length} of {pools?.length || 0} pools
        </p>
      </div>

      {/* Pools Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredPools.map((pool: any) => (
          <Card key={pool.id} className="hover:shadow-lg transition-all hover:scale-[1.02]">
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex gap-2 flex-wrap">
                  {pool.isFeatured && (
                    <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Featured
                    </Badge>
                  )}
                  <Badge className={statusColors[pool.status as keyof typeof statusColors]}>
                    {pool.status}
                  </Badge>
                </div>
                <PoolComparisonCheckbox
                  poolId={pool.id}
                  isSelected={selectedForComparison.includes(pool.id)}
                  onToggle={togglePoolForComparison}
                />
              </div>
              <CardTitle className="text-xl">{pool.name}</CardTitle>
              <CardDescription className="line-clamp-2" dangerouslySetInnerHTML={{ __html: pool.description }} />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-accent/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">APY</p>
                  <p className="text-2xl font-bold text-green-600">{pool.annualizedReturn?.toFixed(1) || 'N/A'}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">TVL</p>
                  <p className="text-xl font-bold">
                    ${(pool.totalStaked / 1000000).toFixed(1)}M
                  </p>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Investors
                  </span>
                  <span className="font-medium">{pool.totalInvestors}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3 w-3" />
                    Min. Stake
                  </span>
                  <span className="font-medium">${pool.minimumStake}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Pool Type
                  </span>
                  <Badge variant="outline">
                    {pool.poolType.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {/* Available Liquidity */}
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-1">Available to Lend</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${(pool.availableLiquidity / pool.totalStaked) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium">
                    ${(pool.availableLiquidity / 1000).toFixed(0)}K
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <Link href={`/explore/pools/${pool.slug}`}>
                <Button className="w-full" size="lg">
                  View Pool Details
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredPools.length === 0 && (
        <Card className="p-12 text-center">
          <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No pools found</h3>
          <p className="text-muted-foreground">
            Try adjusting your filters or search terms
          </p>
        </Card>
      )}
      </>
      )}
    </div>
  );
}
