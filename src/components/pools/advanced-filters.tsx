'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

export type AdvancedFilters = {
  apyRange: [number, number];
  tvlRange: [number, number];
  riskLevels: string[];
  onlyFeatured: boolean;
  minInvestors: number;
};

type AdvancedFiltersProps = {
  filters: AdvancedFilters;
  onChange: (filters: AdvancedFilters) => void;
  onReset: () => void;
};

export function AdvancedFiltersPanel({ filters, onChange, onReset }: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.apyRange[0] > 0 ||
    filters.apyRange[1] < 30 ||
    filters.tvlRange[0] > 0 ||
    filters.tvlRange[1] < 10000000 ||
    filters.riskLevels.length > 0 ||
    filters.onlyFeatured ||
    filters.minInvestors > 0;

  const toggleRiskLevel = (level: string) => {
    const newRiskLevels = filters.riskLevels.includes(level)
      ? filters.riskLevels.filter(l => l !== level)
      : [...filters.riskLevels, level];
    onChange({ ...filters, riskLevels: newRiskLevels });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                Active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={onReset}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* APY Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">APY Range</Label>
              <span className="text-sm text-muted-foreground">
                {filters.apyRange[0]}% - {filters.apyRange[1]}%
              </span>
            </div>
            <Slider
              min={0}
              max={30}
              step={0.5}
              value={filters.apyRange}
              onValueChange={(value) =>
                onChange({ ...filters, apyRange: value as [number, number] })
              }
              className="w-full"
            />
          </div>

          {/* TVL Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">TVL Range</Label>
              <span className="text-sm text-muted-foreground">
                ${(filters.tvlRange[0] / 1000000).toFixed(1)}M - $
                {(filters.tvlRange[1] / 1000000).toFixed(1)}M
              </span>
            </div>
            <Slider
              min={0}
              max={10000000}
              step={100000}
              value={filters.tvlRange}
              onValueChange={(value) =>
                onChange({ ...filters, tvlRange: value as [number, number] })
              }
              className="w-full"
            />
          </div>

          {/* Risk Levels */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Risk Level</Label>
            <div className="flex gap-2">
              {['Low', 'Medium', 'High'].map((level) => (
                <Button
                  key={level}
                  variant={filters.riskLevels.includes(level) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleRiskLevel(level)}
                  className="flex-1"
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          {/* Minimum Investors */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Minimum Investors</Label>
              <span className="text-sm text-muted-foreground">
                {filters.minInvestors}+
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[filters.minInvestors]}
              onValueChange={(value) =>
                onChange({ ...filters, minInvestors: value[0] })
              }
              className="w-full"
            />
          </div>

          {/* Featured Only */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="featured"
              checked={filters.onlyFeatured}
              onCheckedChange={(checked) =>
                onChange({ ...filters, onlyFeatured: checked as boolean })
              }
            />
            <Label
              htmlFor="featured"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Show only featured pools
            </Label>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
