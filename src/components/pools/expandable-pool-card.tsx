'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { TiltCard } from '@/components/ui/tilt-card';
import { PoolComparisonCheckbox } from '@/components/pools/pool-comparison';
import { Star, Wallet, TrendingUp, Clock, Shield, ExternalLink, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { flushSync } from 'react-dom';

// Small business / merchant shop themed images based on pool type
const poolTypeImages: Record<string, string> = {
  SMALL_BUSINESS: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80', // Coffee shop storefront
  REAL_ESTATE: 'https://images.unsplash.com/photo-1582037928769-181f2644ecb7?w=800&q=80', // Commercial building
  WORKING_CAPITAL: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=800&q=80', // Retail store interior
  EQUIPMENT_FINANCING: 'https://images.unsplash.com/photo-1597766353931-9e9e68d62b65?w=800&q=80', // Bakery/restaurant
  DEFAULT: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=800&q=80', // Small shop storefront
};

// Get image URL for a pool type
const getPoolImage = (poolType: string): string => {
  return poolTypeImages[poolType] || poolTypeImages.DEFAULT;
};

interface Pool {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  poolType: string;
  annualizedReturn: number | null;
  totalStaked: number;
  totalInvestors: number;
  minimumStake: number;
  availableLiquidity: number;
  isFeatured?: boolean;
  isComingSoon?: boolean;
  riskLevel?: string;
  lockupPeriod?: number;
  baseInterestRate?: number;
}

interface ExpandablePoolCardProps {
  pool: Pool;
  statusColors: Record<string, string>;
  isSelectedForComparison: boolean;
  onToggleComparison: (poolId: string) => void;
}

export function ExpandablePoolCard({
  pool,
  statusColors,
  isSelectedForComparison,
  onToggleComparison,
}: ExpandablePoolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  const handleCardClick = useCallback(async (e: React.MouseEvent) => {
    // Don't expand if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="checkbox"]') ||
      target.closest('input')
    ) {
      return;
    }

    // Use View Transitions API if available
    if (document.startViewTransition && cardRef.current && titleRef.current) {
      setIsAnimating(true);

      // Set view transition names on source elements
      cardRef.current.style.viewTransitionName = 'pool-card';
      titleRef.current.style.viewTransitionName = 'pool-title';

      const transition = document.startViewTransition(() => {
        flushSync(() => {
          setIsExpanded(true);
        });
      });

      try {
        await transition.finished;
      } finally {
        // Clean up view transition names
        if (cardRef.current) {
          cardRef.current.style.viewTransitionName = '';
          cardRef.current.style.visibility = 'hidden';
        }
        if (titleRef.current) {
          titleRef.current.style.viewTransitionName = '';
        }
        setIsAnimating(false);
      }
    } else {
      setIsExpanded(true);
    }
  }, []);

  const handleClose = useCallback(async () => {
    if (document.startViewTransition && cardRef.current && titleRef.current && modalRef.current) {
      setIsAnimating(true);

      // Store refs to modal elements before transition
      const modalElement = modalRef.current;
      const cardElement = cardRef.current;
      const titleElement = titleRef.current;

      // First, prepare the source card to receive the transition
      // Make it visible but keep it in place
      cardElement.style.visibility = 'visible';
      cardElement.style.opacity = '0';

      const transition = document.startViewTransition(() => {
        flushSync(() => {
          // Transfer view transition names from modal to source card
          // The modal will be the "old" state, the card will be the "new" state
          modalElement.style.viewTransitionName = '';
          cardElement.style.viewTransitionName = 'pool-card';
          cardElement.style.opacity = '1';

          titleElement.style.viewTransitionName = 'pool-title';

          setIsExpanded(false);
        });
      });

      try {
        await transition.finished;
      } finally {
        cardElement.style.viewTransitionName = '';
        cardElement.style.opacity = '';
        titleElement.style.viewTransitionName = '';
        setIsAnimating(false);
      }
    } else {
      setIsExpanded(false);
    }
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded && !isAnimating) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, isAnimating, handleClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  return (
    <>
      {/* Regular Card */}
      <div
        ref={cardRef}
        onClick={handleCardClick}
        className={cn(isExpanded && !isAnimating && 'invisible')}
      >
        <TiltCard maxTilt={15} scale={1.02} perspective={500}>
          <Card
            variant="elevated"
            className="group h-full rounded-2xl overflow-hidden"
          >
            {/* Background Image */}
            <div className="relative h-40">
              <img
                src={getPoolImage(pool.poolType)}
                alt={pool.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-transparent" />

              {/* Badges positioned over image */}
              <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                <div className="flex gap-1.5 flex-wrap items-center">
                  {pool.isComingSoon && (
                    <Badge className="bg-purple-500 text-white hover:bg-purple-600 text-xs px-2 py-0.5 shadow-sm">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />
                      Coming Soon
                    </Badge>
                  )}
                  {pool.isFeatured && !pool.isComingSoon && (
                    <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500 text-xs px-2 py-0.5 shadow-sm">
                      <Star className="h-2.5 w-2.5 mr-1 fill-current" />
                      Featured
                    </Badge>
                  )}
                  {!pool.isComingSoon && (
                    <Badge
                      className={`${statusColors[pool.status] || ''} flex items-center gap-1 text-xs px-2 py-0.5 shadow-sm`}
                    >
                      <StatusIndicator
                        status={pool.status === 'ACTIVE' ? 'active' : pool.status === 'PAUSED' ? 'pending' : 'inactive'}
                        size="sm"
                      />
                      {pool.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Content below image */}
            <CardHeader className="pt-2 pb-3">
              <div ref={titleRef}>
                <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">
                  {pool.name}
                </CardTitle>
                <CardDescription
                  className="line-clamp-2 text-sm mt-1"
                  dangerouslySetInnerHTML={{ __html: pool.description }}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4 space-y-4">
              {/* Key Metrics - APY only */}
              <div className="flex items-center justify-between p-3 bg-gradient-subtle rounded-xl">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Annual Yield</p>
                  {pool.isComingSoon ? (
                    <p className="text-xl font-bold text-purple-600">TBD</p>
                  ) : (
                    <p className="text-2xl font-bold text-green-600">
                      {pool.annualizedReturn?.toFixed(1) || 'N/A'}
                      <span className="text-base">%</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {pool.isComingSoon ? 'Target Size' : 'Available'}
                  </p>
                  {pool.isComingSoon ? (
                    <p className="text-lg font-semibold text-muted-foreground">
                      {pool.totalStaked > 0 ? `$${(pool.totalStaked / 1000).toFixed(0)}K` : 'TBD'}
                    </p>
                  ) : (
                    <p className="text-lg font-semibold">
                      ${(pool.availableLiquidity / 1000).toFixed(0)}K
                    </p>
                  )}
                </div>
              </div>

              {/* Pool Utilization Progress - hide for Coming Soon */}
              {!pool.isComingSoon && pool.totalStaked > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">Pool Utilization</p>
                    <span className="text-xs font-medium">
                      {((1 - pool.availableLiquidity / pool.totalStaked) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Progress
                    variant="gradient"
                    value={(1 - pool.availableLiquidity / pool.totalStaked) * 100}
                    className="h-2"
                  />
                </div>
              )}

              {/* Coming Soon message */}
              {pool.isComingSoon && (
                <div className="text-center py-2">
                  <p className="text-sm text-purple-600 font-medium">
                    Launching Soon - Stay Tuned!
                  </p>
                </div>
              )}

              {/* Compare Checkbox - bottom left */}
              <PoolComparisonCheckbox
                poolId={pool.id}
                isSelected={isSelectedForComparison}
                onToggle={onToggleComparison}
              />
            </CardContent>
          </Card>
        </TiltCard>
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <>
          {/* Overlay - clicking closes the modal */}
          <div
            className="overlay fixed inset-0 bg-black/80 z-[1000] cursor-pointer"
            style={{ viewTransitionName: 'overlay' }}
            onClick={handleClose}
          />

          {/* Expanded Card Container */}
          <div
            className="fixed inset-0 z-[1001] flex items-center justify-center p-8 md:p-12 lg:p-16 pointer-events-none"
            onClick={handleClose}
          >
            {/* Expanded Card */}
            <div
              ref={modalRef}
              className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl bg-card border shadow-2xl overflow-hidden pointer-events-auto"
              style={{ viewTransitionName: 'pool-card' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Scrollable Content */}
              <div className="h-full max-h-[85vh] overflow-y-auto">
                {/* Hero Section with Fading Image */}
                <div className="relative h-44">
                  {/* Background image */}
                  <img
                    src={getPoolImage(pool.poolType)}
                    alt={pool.name}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                  {/* Strong gradient fade from bottom to create smooth transition */}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 via-50% to-transparent" />

                  {/* Badges at top */}
                  <div className="absolute top-4 left-6 right-6 flex gap-2">
                    {pool.isComingSoon && (
                      <Badge className="bg-purple-500 text-white text-xs shadow-sm">
                        <Sparkles className="h-2.5 w-2.5 mr-1" />
                        Coming Soon
                      </Badge>
                    )}
                    {pool.isFeatured && !pool.isComingSoon && (
                      <Badge className="bg-yellow-400 text-yellow-900 text-xs shadow-sm">
                        <Star className="h-2.5 w-2.5 mr-1 fill-current" />
                        Featured
                      </Badge>
                    )}
                    {!pool.isComingSoon && (
                      <Badge
                        className={`${statusColors[pool.status] || ''} flex items-center gap-1 text-xs shadow-sm`}
                      >
                        <StatusIndicator
                          status={pool.status === 'ACTIVE' ? 'active' : pool.status === 'PAUSED' ? 'pending' : 'inactive'}
                          size="sm"
                        />
                        {pool.status}
                      </Badge>
                    )}
                  </div>

                  {/* Pool name positioned at bottom of image area */}
                  <div
                    className="absolute bottom-4 left-6 right-6"
                    style={{ viewTransitionName: 'pool-title' }}
                  >
                    <h2 className="text-xl md:text-2xl font-bold">{pool.name}</h2>
                  </div>
                </div>

                {/* Content - Description starts right after the image fade */}
                <div className="p-6 pt-2 space-y-6">
                  {/* Description */}
                  <p
                    className="text-sm text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: pool.description }}
                  />

                  {/* Key Metrics Grid - 2x2 with simple styling */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-card border">
                      <p className="text-xs text-muted-foreground mb-1">Annual Yield</p>
                      {pool.isComingSoon ? (
                        <p className="text-2xl font-bold text-purple-600">TBD</p>
                      ) : (
                        <p className="text-2xl font-bold text-green-600">
                          {pool.annualizedReturn?.toFixed(1) || 'N/A'}%
                        </p>
                      )}
                    </div>
                    <div className="p-4 rounded-xl bg-card border">
                      <p className="text-xs text-muted-foreground mb-1">
                        {pool.isComingSoon ? 'Target Size' : 'Total Value Locked'}
                      </p>
                      {pool.isComingSoon ? (
                        <p className="text-2xl font-bold text-muted-foreground">
                          {pool.totalStaked > 0 ? `$${(pool.totalStaked / 1000000).toFixed(2)}M` : 'TBD'}
                        </p>
                      ) : (
                        <p className="text-2xl font-bold">
                          ${(pool.totalStaked / 1000000).toFixed(2)}M
                        </p>
                      )}
                    </div>
                    <div className="p-4 rounded-xl bg-card border">
                      <p className="text-xs text-muted-foreground mb-1">Active Investors</p>
                      {pool.isComingSoon ? (
                        <p className="text-2xl font-bold text-muted-foreground">—</p>
                      ) : (
                        <p className="text-2xl font-bold">{pool.totalInvestors}</p>
                      )}
                    </div>
                    <div className="p-4 rounded-xl bg-card border">
                      <p className="text-xs text-muted-foreground mb-1">
                        {pool.isComingSoon ? 'Status' : 'Available Liquidity'}
                      </p>
                      {pool.isComingSoon ? (
                        <p className="text-xl font-bold text-purple-600">Launching Soon</p>
                      ) : (
                        <p className="text-2xl font-bold">
                          ${(pool.availableLiquidity / 1000).toFixed(0)}K
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Pool Details */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pool Details</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Type
                        </span>
                        <span className="font-medium text-xs">{pool.poolType.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Wallet className="h-3.5 w-3.5" />
                          Min. Stake
                        </span>
                        <span className="font-medium">${pool.minimumStake.toLocaleString()}</span>
                      </div>
                      {pool.lockupPeriod && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Lock-up
                          </span>
                          <span className="font-medium">{pool.lockupPeriod} days</span>
                        </div>
                      )}
                      {pool.riskLevel && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5" />
                            Risk
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs px-1.5 py-0',
                              pool.riskLevel === 'Low'
                                ? 'border-green-500 text-green-600'
                                : pool.riskLevel === 'Medium'
                                ? 'border-yellow-500 text-yellow-600'
                                : 'border-red-500 text-red-600'
                            )}
                          >
                            {pool.riskLevel}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Utilization - hide for Coming Soon pools */}
                  {!pool.isComingSoon && pool.totalStaked > 0 && (
                    <div className="p-4 rounded-xl border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-muted-foreground">Pool Utilization</span>
                        <span className="text-sm font-semibold">
                          {((1 - pool.availableLiquidity / pool.totalStaked) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress
                        variant="gradient"
                        value={(1 - pool.availableLiquidity / pool.totalStaked) * 100}
                        className="h-2"
                      />
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-2">
                    <Link href={`/explore/pools/${pool.slug}`} className="block">
                      <Button className="w-full" size="lg">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Full Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
