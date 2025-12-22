'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, Filter } from 'lucide-react';
import LoadingDots from '@/components/ui/loading-dots';
import useSWR from 'swr';
import { PoolComparison } from '@/components/pools/pool-comparison';
import { ExpandablePoolCard } from '@/components/pools/expandable-pool-card';
import { type AdvancedFilters } from '@/components/pools/advanced-filters';

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
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Staking Pools</h1>
        <p className="text-muted-foreground mt-2">
          Discover lending pools that match your investment goals
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingDots size="md" />
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
      <Card variant="elevated" className="animate-fade-in-up">
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
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in-stagger">
        {filteredPools.map((pool: any) => (
          <ExpandablePoolCard
            key={pool.id}
            pool={pool}
            statusColors={statusColors}
            isSelectedForComparison={selectedForComparison.includes(pool.id)}
            onToggleComparison={togglePoolForComparison}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredPools.length === 0 && (
        <EmptyState
          icon={<Filter />}
          title="No pools found"
          description="Try adjusting your filters or search terms to find pools that match your criteria."
          action={
            <Button variant="outline" onClick={() => {
              setSearchTerm('');
              setFilterType('all');
              setFilterStatus('all');
              resetAdvancedFilters();
            }}>
              Clear all filters
            </Button>
          }
        />
      )}
      </>
      )}
    </div>
  );
}
