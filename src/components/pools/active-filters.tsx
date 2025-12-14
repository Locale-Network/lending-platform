'use client';

import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { AdvancedFilters } from './advanced-filters';

type ActiveFiltersProps = {
  filters: AdvancedFilters;
  searchTerm: string;
  filterType: string;
  filterStatus: string;
  onRemoveFilter: (filterType: string, value?: any) => void;
};

export function ActiveFilters({
  filters,
  searchTerm,
  filterType,
  filterStatus,
  onRemoveFilter,
}: ActiveFiltersProps) {
  const activeFilters = [];

  if (searchTerm) {
    activeFilters.push({
      label: `Search: "${searchTerm}"`,
      onRemove: () => onRemoveFilter('search'),
    });
  }

  if (filterType !== 'all') {
    activeFilters.push({
      label: `Type: ${filterType.replace('_', ' ')}`,
      onRemove: () => onRemoveFilter('type'),
    });
  }

  if (filterStatus !== 'all') {
    activeFilters.push({
      label: `Status: ${filterStatus}`,
      onRemove: () => onRemoveFilter('status'),
    });
  }

  if (filters.apyRange[0] > 0 || filters.apyRange[1] < 30) {
    activeFilters.push({
      label: `APY: ${filters.apyRange[0]}% - ${filters.apyRange[1]}%`,
      onRemove: () => onRemoveFilter('apyRange'),
    });
  }

  if (filters.tvlRange[0] > 0 || filters.tvlRange[1] < 10000000) {
    activeFilters.push({
      label: `TVL: $${(filters.tvlRange[0] / 1000000).toFixed(1)}M - $${(filters.tvlRange[1] / 1000000).toFixed(1)}M`,
      onRemove: () => onRemoveFilter('tvlRange'),
    });
  }

  filters.riskLevels.forEach((level) => {
    activeFilters.push({
      label: `Risk: ${level}`,
      onRemove: () => onRemoveFilter('riskLevel', level),
    });
  });

  if (filters.minInvestors > 0) {
    activeFilters.push({
      label: `Min Investors: ${filters.minInvestors}+`,
      onRemove: () => onRemoveFilter('minInvestors'),
    });
  }

  if (filters.onlyFeatured) {
    activeFilters.push({
      label: 'Featured Only',
      onRemove: () => onRemoveFilter('featured'),
    });
  }

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {activeFilters.map((filter, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="px-3 py-1 cursor-pointer hover:bg-secondary/80"
          onClick={filter.onRemove}
        >
          {filter.label}
          <X className="h-3 w-3 ml-2" />
        </Badge>
      ))}
    </div>
  );
}
