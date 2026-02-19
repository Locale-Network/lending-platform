'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { StatusIndicator } from '@/components/ui/status-indicator';
import {
  TrendingUp,
  Users,
  Wallet,
  DollarSign,
  Shield,
  Info,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  FileCode,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Activity,
  FileText,
  Sparkles,
  Banknote,
} from 'lucide-react';
import LoadingDots from '@/components/ui/loading-dots';
import { HoldConfirmModal } from '@/components/ui/hold-confirm-modal';
import Link from 'next/link';
import useSWR from 'swr';
import { useToast } from '@/hooks/use-toast';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { parseUnits, formatUnits } from 'viem';
import { LoanMetricsCard, NoLoansCard } from '@/components/pools/loan-metrics-card';
import { PoolRiskDashboard } from '@/components/pools/pool-risk-dashboard';
import { getExplorerUrl } from '@/lib/explorer';
import {
  usePoolDetails,
  useUserStake,
  useStakingToken,
  useStakeWithApproval,
  useRequestUnstake,
  useCompleteUnstake,
  useCancelUnstake,
  useStake,
  useAvailableYield,
  useClaimYield,
} from '@/hooks/useStakingPool';

const fetcher = (url: string) => fetch(url).then(r => r.json());


export default function PoolDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);
  const [showStakeConfirmModal, setShowStakeConfirmModal] = useState(false);
  const [showUnstakeConfirmModal, setShowUnstakeConfirmModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showCancelUnstakeModal, setShowCancelUnstakeModal] = useState(false);
  const [stakingStep, setStakingStep] = useState<'idle' | 'approving' | 'staking' | 'success'>('idle');

  const { toast } = useToast();
  const { address, isConnected } = useWalletAuth();

  // Fetch pool data from API
  const { data: pool, error, isLoading, mutate } = useSWR(`/api/pools/public/${resolvedParams.slug}`, fetcher);

  // Fetch loan metrics and risk data for investor transparency
  const { data: loansData, isLoading: loansLoading } = useSWR(
    pool ? `/api/pools/public/${resolvedParams.slug}/loans` : null,
    fetcher
  );
  const { data: riskData, isLoading: riskLoading } = useSWR(
    pool ? `/api/pools/public/${resolvedParams.slug}/risk-metrics` : null,
    fetcher
  );

  // Wagmi hooks for contract interaction - use pool slug for hashing
  const {
    stakeWithApproval,
    allowance,
    balance,
    refetchAllowance,
    isApproving,
    isApprovalConfirmed,
    isStaking: isStakingContract,
    isStakeConfirmed,
    stakeHash,
    error: stakeError,
    reset: resetStake,
  } = useStakeWithApproval();

  const {
    requestUnstake,
    isPending: isUnstakePending,
    isConfirming: isUnstakeConfirming,
    isConfirmed: isUnstakeConfirmed,
    error: unstakeError,
    reset: resetUnstake,
  } = useRequestUnstake();

  const {
    completeUnstake,
    isPending: isCompletingUnstake,
    isConfirmed: isCompleteUnstakeConfirmed,
    error: completeUnstakeError,
    reset: resetCompleteUnstake,
  } = useCompleteUnstake();

  const {
    cancelUnstake,
    isPending: isCancellingUnstake,
    isConfirmed: isCancelUnstakeConfirmed,
    error: cancelUnstakeError,
    reset: resetCancelUnstake,
  } = useCancelUnstake();

  const {
    claimYield,
    isPending: isClaimingYield,
    isConfirmed: isClaimYieldConfirmed,
    error: claimYieldError,
    reset: resetClaimYield,
  } = useClaimYield();

  const { stake: stakeTokens } = useStake();

  // Get user's on-chain stake data
  const { stake: userStakeOnChain, refetch: refetchUserStake } = useUserStake(pool?.slug);
  const { availableYield, refetch: refetchYield } = useAvailableYield(pool?.slug);
  const { tokenAddress } = useStakingToken();
  // Get on-chain pool details (for cooldownWaived flag)
  const { pool: onChainPool } = usePoolDetails(pool?.slug);

  // Derived state
  const isStaking = isApproving || isStakingContract || stakingStep === 'approving' || stakingStep === 'staking';
  const isUnstaking = isUnstakePending || isUnstakeConfirming;

  const utilizationRate = pool?.totalStaked && pool?.availableLiquidity
    ? ((pool.totalStaked - pool.availableLiquidity) / pool.totalStaked) * 100
    : 0;
  const targetProgress = pool?.totalStaked && pool?.poolSize
    ? (pool.totalStaked / pool.poolSize) * 100
    : 0;

  // Calculate estimated shares and returns
  // Note: Actual share calculation happens on-chain - this is just 1:1 for display
  // The smart contract determines the actual share ratio based on pool state
  const estimatedShares = stakeAmount ? parseFloat(stakeAmount) : 0;
  const estimatedAnnualReturn = stakeAmount && pool?.annualizedReturn
    ? (parseFloat(stakeAmount) * pool.annualizedReturn) / 100
    : 0;
  const estimatedMonthlyReturn = estimatedAnnualReturn / 12;

  // Format user stake data from on-chain
  const availableYieldFormatted = Number(formatUnits(availableYield, 6));

  const userStakeData = userStakeOnChain ? {
    hasStake: userStakeOnChain.amount > 0n,
    amount: Number(formatUnits(userStakeOnChain.amount, 6)),
    shares: Number(formatUnits(userStakeOnChain.shares, 6)),
    rewards: availableYieldFormatted,
    pendingUnstake: Number(formatUnits(userStakeOnChain.pendingUnstake, 6)),
    hasPendingUnstake: userStakeOnChain.pendingUnstake > 0n,
    canWithdrawAt: Number(userStakeOnChain.canWithdrawAt),
    canWithdrawNow: userStakeOnChain.pendingUnstake > 0n && (
      onChainPool?.cooldownWaived === true ||
      (userStakeOnChain.canWithdrawAt > 0n && Number(userStakeOnChain.canWithdrawAt) * 1000 <= Date.now())
    ),
  } : null;

  // Handle approval confirmation then stake
  useEffect(() => {
    if (isApprovalConfirmed && stakingStep === 'approving' && stakeAmount) {
      setStakingStep('staking');
      // Now stake after approval
      const amountInWei = parseUnits(stakeAmount, 6);
      stakeTokens(pool?.slug || resolvedParams.slug, amountInWei);
    }
  }, [isApprovalConfirmed, stakingStep, stakeAmount]);

  // Handle stake confirmation
  useEffect(() => {
    if (isStakeConfirmed && (stakingStep === 'staking' || stakingStep === 'approving')) {
      setStakingStep('success');
      setShowStakeModal(true);
      refetchUserStake();
      mutate();
      toast({
        title: 'Stake Successful!',
        description: `You've successfully staked ${parseFloat(stakeAmount).toLocaleString()} USDC`,
      });
      setStakeAmount('');
    }
  }, [isStakeConfirmed, stakingStep]);

  // Handle stake error
  useEffect(() => {
    if (stakeError) {
      setStakingStep('idle');
      toast({
        title: 'Stake Failed',
        description: stakeError.message || 'An error occurred while staking.',
        variant: 'destructive',
      });
    }
  }, [stakeError]);

  // Handle unstake confirmation — auto-complete when cooldown is waived
  useEffect(() => {
    if (isUnstakeConfirmed) {
      setShowUnstakeModal(false);
      setUnstakeAmount('');
      refetchUserStake();
      mutate();

      if (onChainPool?.cooldownWaived) {
        // Cooldown waived — automatically complete the unstake in one flow
        toast({
          title: 'Unstake Requested — Completing Withdrawal...',
          description: 'Cooldown waived. Automatically withdrawing your funds.',
        });
        const poolSlug = pool?.slug || resolvedParams.slug;
        completeUnstake(poolSlug).catch((err) => {
          toast({
            title: 'Auto-Withdraw Failed',
            description: 'Unstake request succeeded but withdrawal failed. Click "Withdraw Funds" to complete manually.',
            variant: 'destructive',
          });
        });
      } else {
        toast({
          title: 'Unstake Requested!',
          description: 'Funds will be available after the cooldown period.',
        });
      }
    }
  }, [isUnstakeConfirmed]);

  // Handle complete unstake confirmation
  useEffect(() => {
    if (isCompleteUnstakeConfirmed) {
      refetchUserStake();
      mutate();
      toast({
        title: 'Withdrawal Complete!',
        description: 'Your funds have been returned to your wallet.',
      });
      resetCompleteUnstake();
    }
  }, [isCompleteUnstakeConfirmed]);

  // Handle cancel unstake confirmation
  useEffect(() => {
    if (isCancelUnstakeConfirmed) {
      refetchUserStake();
      mutate();
      toast({
        title: 'Unstake Cancelled',
        description: 'Your funds have been restaked in the pool.',
      });
      resetCancelUnstake();
    }
  }, [isCancelUnstakeConfirmed]);

  // Handle claim yield confirmation
  useEffect(() => {
    if (isClaimYieldConfirmed) {
      refetchUserStake();
      refetchYield();
      mutate();
      toast({
        title: 'Interest Claimed!',
        description: 'Earned interest has been sent to your wallet.',
      });
      resetClaimYield();
    }
  }, [isClaimYieldConfirmed]);

  // Handle claim yield error
  useEffect(() => {
    if (claimYieldError) {
      toast({
        title: 'Claim Failed',
        description: claimYieldError.message || 'An error occurred while claiming interest.',
        variant: 'destructive',
      });
    }
  }, [claimYieldError]);

  const handleStake = async () => {
    const minStake = pool.minimumStake || 100;
    if (!stakeAmount || parseFloat(stakeAmount) < minStake) {
      toast({
        title: 'Invalid Amount',
        description: `Minimum stake is ${minStake} USDC`,
        variant: 'destructive',
      });
      return;
    }

    if (!isConnected || !address) {
      toast({
        title: 'Not Connected',
        description: 'Please connect your wallet to stake.',
        variant: 'destructive',
      });
      return;
    }

    // Verify KYC/investor credential before staking
    try {
      const kycRes = await fetch(`/api/investor/kyc-check?address=${address}`);
      const kycData = await kycRes.json();
      if (!kycData.hasCredential) {
        toast({
          title: 'KYC Required',
          description: 'You must complete identity verification before staking. Visit your profile to get started.',
          variant: 'destructive',
        });
        return;
      }
    } catch {
      toast({
        title: 'Verification Check Failed',
        description: 'Unable to verify your KYC status. Please try again later.',
        variant: 'destructive',
      });
      return;
    }

    // Check token balance
    const amountInWei = parseUnits(stakeAmount, 6); // 6 decimals for USDC
    if (balance && balance < amountInWei) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${stakeAmount} USDC to stake. Current balance: ${formatUnits(balance, 6)} USDC`,
        variant: 'destructive',
      });
      return;
    }

    // Reset any previous errors
    resetStake();
    setStakingStep('idle');

    try {
      // Use slug for pool ID hashing
      const poolSlug = pool?.slug || resolvedParams.slug;
      const result = await stakeWithApproval(poolSlug, amountInWei);

      if (result.needsApproval) {
        setStakingStep('approving');
        toast({
          title: 'Approval Required',
          description: 'Please approve the token transfer in your wallet.',
        });
      } else {
        setStakingStep('staking');
      }
    } catch (err) {
      setStakingStep('idle');
      toast({
        title: 'Stake Failed',
        description: err instanceof Error ? err.message : 'An error occurred while staking.',
        variant: 'destructive',
      });
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid unstake amount',
        variant: 'destructive',
      });
      return;
    }

    if (!isConnected || !address) {
      toast({
        title: 'Not Connected',
        description: 'Please connect your wallet to unstake.',
        variant: 'destructive',
      });
      return;
    }

    if (!userStakeData || parseFloat(unstakeAmount) > userStakeData.amount) {
      toast({
        title: 'Invalid Amount',
        description: 'Unstake amount exceeds your staked amount',
        variant: 'destructive',
      });
      return;
    }

    // Reset any previous errors
    resetUnstake();

    try {
      const poolSlug = pool?.slug || resolvedParams.slug;
      const amountInWei = parseUnits(unstakeAmount, 6);
      await requestUnstake(poolSlug, amountInWei);
    } catch (err) {
      toast({
        title: 'Unstake Failed',
        description: err instanceof Error ? err.message : 'An error occurred while unstaking.',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteUnstake = async () => {
    if (!isConnected || !address) {
      toast({
        title: 'Not Connected',
        description: 'Please connect your wallet.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const poolSlug = pool?.slug || resolvedParams.slug;
      await completeUnstake(poolSlug);
    } catch (err) {
      toast({
        title: 'Withdrawal Failed',
        description: err instanceof Error ? err.message : 'An error occurred while completing withdrawal.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelUnstake = async () => {
    if (!isConnected || !address) {
      toast({
        title: 'Not Connected',
        description: 'Please connect your wallet.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const poolSlug = pool?.slug || resolvedParams.slug;
      await cancelUnstake(poolSlug);
    } catch (err) {
      toast({
        title: 'Cancel Failed',
        description: err instanceof Error ? err.message : 'An error occurred while cancelling unstake.',
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingDots size="md" />
      </div>
    );
  }

  // Error state
  if (error || !pool) {
    return (
      <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 md:p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive mb-4">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold">Pool not found</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              The pool you're looking for doesn't exist or is no longer active.
            </p>
            <Link href="/explore/pools">
              <Button variant="outline">
                <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                Back to All Pools
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if this is a Coming Soon pool
  const isComingSoon = pool.isComingSoon === true;

  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 md:p-8">
      {/* Coming Soon Banner */}
      {isComingSoon && (
        <div className="bg-purple-100 border border-purple-300 rounded-xl p-4 flex items-center gap-3 animate-fade-in-up">
          <div className="flex-shrink-0 p-2 bg-purple-200 rounded-full">
            <Sparkles className="h-5 w-5 text-purple-700" />
          </div>
          <div>
            <h3 className="font-semibold text-purple-900">Coming Soon</h3>
            <p className="text-sm text-purple-700">
              This pool is launching soon. Investment will be available once the pool is activated.
            </p>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground animate-fade-in-up">
        <Link href="/explore/pools" className="hover:underline hover:text-primary transition-colors">
          All Pools
        </Link>
        {' / '}
        <span className="text-foreground font-medium">{pool.name}</span>
      </div>

      {/* Hero Section */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pool Header */}
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-2xl font-bold">{pool.name}</h1>
              {isComingSoon ? (
                <Badge className="bg-purple-500 text-white flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Coming Soon
                </Badge>
              ) : (
                <Badge className="bg-green-100 text-green-800 flex items-center gap-1.5">
                  <StatusIndicator status={pool.status === 'ACTIVE' ? 'active' : 'pending'} size="sm" />
                  {pool.status}
                </Badge>
              )}
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-3 animate-fade-in-stagger">
            <Card variant="elevated" className="bg-gradient-subtle">
              <CardHeader className="pb-2">
                <CardDescription>{isComingSoon ? 'Target APY' : 'Current APY'}</CardDescription>
              </CardHeader>
              <CardContent>
                {isComingSoon ? (
                  <>
                    <div className="text-3xl font-bold text-purple-600">TBD</div>
                    <p className="text-xs text-muted-foreground mt-1">To be determined</p>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-green-600">{pool.annualizedReturn?.toFixed(1) || 'N/A'}<span className="text-xl">%</span></div>
                    <p className="text-xs text-muted-foreground mt-1">Annual percentage yield</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card variant="elevated" className="bg-gradient-subtle">
              <CardHeader className="pb-2">
                <CardDescription>{isComingSoon ? 'Target Size' : 'Total Value Locked'}</CardDescription>
              </CardHeader>
              <CardContent>
                {isComingSoon ? (
                  <>
                    <div className="text-2xl font-bold text-muted-foreground">
                      {pool.poolSize ? `${((pool.poolSize) / 1000000).toFixed(1)}M` : 'TBD'} <span className="text-lg text-muted-foreground">USDC</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Target pool size</p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {((pool.totalStaked || 0) / 1000000).toFixed(2)}M <span className="text-lg text-muted-foreground">USDC</span>
                    </div>
                    <Progress variant="gradient" value={targetProgress} className="mt-2 h-1.5" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {targetProgress.toFixed(0)}% of {((pool.poolSize || 0) / 1000000).toFixed(1)}M target
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card variant="elevated" className="bg-gradient-subtle">
              <CardHeader className="pb-2">
                <CardDescription>{isComingSoon ? 'Status' : 'Available Liquidity'}</CardDescription>
              </CardHeader>
              <CardContent>
                {isComingSoon ? (
                  <>
                    <div className="text-2xl font-bold text-purple-600">Launching Soon</div>
                    <p className="text-xs text-muted-foreground mt-1">Stay tuned for updates</p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {((pool.availableLiquidity || 0) / 1000).toFixed(0)}K <span className="text-lg text-muted-foreground">USDC</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {utilizationRate.toFixed(0)}% utilized
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabs for Detailed Info */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
              <TabsTrigger value="loans">Active Loans</TabsTrigger>
              <TabsTrigger value="terms">Terms & Fees</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pool Strategy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pool.description ? (
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: pool.description }}
                    />
                  ) : (
                    <p className="text-muted-foreground">
                      No description provided for this pool.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pool Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Pool Type</Label>
                      <Badge variant="outline">{pool.poolType?.replace('_', ' ') || 'N/A'}</Badge>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Loan-to-Value</Label>
                      <p className="text-2xl font-bold">{pool.maxLTV || 'N/A'}%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Credit Score</Label>
                      <p className="text-2xl font-bold">{pool.minCreditScore || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Total Investors</Label>
                      <p className="text-2xl font-bold">{pool.totalInvestors || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pool Risk Analytics - sourced from Cartesi */}
              <PoolRiskDashboard
                riskMetrics={riskData?.simpleMetrics}
                compositeMetrics={riskData?.compositeMetrics}
                borrowerType={riskData?.pool?.borrowerType}
                isLoading={riskLoading}
              />
            </TabsContent>

            <TabsContent value="financials" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pool Financials</CardTitle>
                  <CardDescription>Current financial snapshot</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total Value Locked</p>
                      <p className="text-2xl font-bold">${((pool?.totalStaked || 0)).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">USDC</span></p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Available Liquidity</p>
                      <p className="text-2xl font-bold">${((pool?.availableLiquidity || 0)).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">USDC</span></p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Target APY</p>
                      <p className="text-2xl font-bold">{pool?.annualizedReturn?.toFixed(1) || 'N/A'}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Capital Utilization</p>
                      <p className="text-2xl font-bold">{utilizationRate.toFixed(1)}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Fundraise Progress</p>
                      <div className="space-y-2">
                        <p className="text-2xl font-bold">{targetProgress.toFixed(0)}%</p>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(targetProgress, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ${((pool?.totalStaked || 0)).toLocaleString()} of ${((pool?.poolSize || 0)).toLocaleString()} target
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total Investors</p>
                      <p className="text-2xl font-bold">{pool?.totalInvestors || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Interest Rate Structure</CardTitle>
                  <CardDescription>Borrower rate parameters for this pool</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Base Rate</p>
                      <p className="text-2xl font-bold">{pool?.baseInterestRate?.toFixed(1) || 'N/A'}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Risk Premium Range</p>
                      <p className="text-2xl font-bold">{pool?.riskPremiumMin?.toFixed(1) || '0'}% – {pool?.riskPremiumMax?.toFixed(1) || '0'}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Effective Rate Range</p>
                      <p className="text-2xl font-bold">
                        {((pool?.baseInterestRate || 0) + (pool?.riskPremiumMin || 0)).toFixed(1)}% – {((pool?.baseInterestRate || 0) + (pool?.riskPremiumMax || 0)).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="loans" className="space-y-4">
              {loansLoading ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading loan metrics...</span>
                    </div>
                  </CardContent>
                </Card>
              ) : loansData?.loans?.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Active Loans ({loansData.totalCount})</h3>
                      <p className="text-sm text-muted-foreground">
                        Metrics sourced from {loansData.dataSource === 'cartesi' ? 'Cartesi verifiable computation' : 'database'}
                      </p>
                    </div>
                    {loansData.contractExplorerUrl && (
                      <a
                        href={loansData.contractExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View Contract
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="grid gap-4">
                    {loansData.loans.map((loan: any) => (
                      <LoanMetricsCard
                        key={loan.id}
                        displayLabel={loan.displayLabel}
                        lendScore={loan.lendScore}
                        lendScoreHealth={loan.lendScoreHealth}
                        dscr={loan.dscr}
                        dscrHealth={loan.dscrHealth}
                        interestRate={loan.interestRate}
                        interestRateFormatted={loan.interestRateFormatted}
                        status={loan.status}
                        industry={loan.industry}
                        proofHash={loan.proofHash}
                        verifiedAt={loan.verifiedAt}
                        verifiedOnChain={loan.verifiedOnChain}
                        proofSource={loan.proofSource}
                        explorerUrl={loan.explorerUrl}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <NoLoansCard />
              )}
            </TabsContent>

            <TabsContent value="terms" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Fees & Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Management Fee</Label>
                      <p className="text-2xl font-bold">{pool.managementFeeRate || 0}%</p>
                      <p className="text-xs text-muted-foreground">Annual fee on total staked</p>
                    </div>
                    <div>
                      <Label>Performance Fee</Label>
                      <p className="text-2xl font-bold">{pool.performanceFeeRate || 0}%</p>
                      <p className="text-xs text-muted-foreground">Fee on profits only</p>
                    </div>
                    <div>
                      <Label>Minimum Stake</Label>
                      <p className="text-2xl font-bold">{pool.minimumStake || 0} USDC</p>
                      <p className="text-xs text-muted-foreground">Minimum investment amount</p>
                    </div>
                    <div>
                      <Label>Withdrawal Period</Label>
                      <p className="text-2xl font-bold">
                        {onChainPool?.cooldownWaived ? 'Instant' : '7 days'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {onChainPool?.cooldownWaived ? 'Cooldown currently waived' : 'Unstaking cooldown period'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Compliance Documents
                  </CardTitle>
                  <CardDescription>
                    Review all required legal and compliance documentation before investing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This pool operates under SEC Regulation D Rule 506(b) exemption. All offering documents
                    are stored on decentralized networks (IPFS/Arweave) for transparency and immutability.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href={`/explore/pools/${resolvedParams.slug}/documents`} className="flex-1">
                      <Button className="w-full" size="lg">
                        <FileText className="h-4 w-4 mr-2" />
                        View All Documents
                      </Button>
                    </Link>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 pt-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Private Placement Memo</p>
                        <p className="text-xs text-muted-foreground">Investment terms & risks</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <DollarSign className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Use of Funds</p>
                        <p className="text-xs text-muted-foreground">Capital allocation details</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Smart Contracts Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                Smart Contracts
              </CardTitle>
              <CardDescription>Verified on-chain contracts powering this pool</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-sm">Staking Pool</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS?.slice(0, 10)}...{process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS?.slice(-8)}
                  </p>
                </div>
                <a
                  href={getExplorerUrl('address', process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <div className="pt-2">
                <a
                  href="https://cartesi.io/explorer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  View on Cartesi Explorer
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Pool Activity Section */}
          <PoolActivity poolSlug={resolvedParams.slug} />
        </div>

        {/* Stake Panel - Sticky Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            {/* Current Stake (if user has one) */}
            {userStakeData && userStakeData.hasStake && (
              <Card className={userStakeData.hasPendingUnstake ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}>
                <CardHeader>
                  <CardTitle className={userStakeData.hasPendingUnstake ? "text-yellow-900" : "text-green-900"}>
                    {userStakeData.hasPendingUnstake ? 'Pending Withdrawal' : 'Your Stake'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`text-sm ${userStakeData.hasPendingUnstake ? 'text-yellow-700' : 'text-green-700'}`}>Staked Amount</span>
                      <span className={`font-bold ${userStakeData.hasPendingUnstake ? 'text-yellow-900' : 'text-green-900'}`}>
                        {userStakeData.amount.toLocaleString()} USDC
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${userStakeData.hasPendingUnstake ? 'text-yellow-700' : 'text-green-700'}`}>Pool Shares</span>
                      <span className={`font-bold ${userStakeData.hasPendingUnstake ? 'text-yellow-900' : 'text-green-900'}`}>
                        {userStakeData.shares.toLocaleString()}
                      </span>
                    </div>

                    {/* Pending Unstake Info */}
                    {userStakeData.hasPendingUnstake && (
                      <>
                        <div className="flex justify-between pt-2 border-t border-yellow-200">
                          <span className="text-sm text-yellow-700">Pending Unstake</span>
                          <span className="font-bold text-orange-600">
                            {userStakeData.pendingUnstake.toLocaleString()} USDC
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-yellow-700">
                            {userStakeData.canWithdrawNow ? 'Ready to Withdraw' : 'Available After'}
                          </span>
                          <span className="font-bold text-yellow-900">
                            {userStakeData.canWithdrawNow
                              ? '✓ Now'
                              : new Date(userStakeData.canWithdrawAt * 1000).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                          </span>
                        </div>

                        {/* Countdown or Status */}
                        {!userStakeData.canWithdrawNow && (
                          <div className="p-3 bg-yellow-100 rounded-lg border border-yellow-300 mt-2">
                            <div className="flex items-start gap-2">
                              <Clock className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-yellow-800">
                                <strong>Cooldown in progress.</strong> You can complete your withdrawal or cancel and restake after the cooldown period ends.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {!userStakeData.hasPendingUnstake && (
                      <div className="flex justify-between pt-2 border-t border-green-200">
                        <span className="text-sm text-green-700">Available Interest</span>
                        <span className="font-bold text-green-600">
                          +{userStakeData.rewards.toLocaleString()} USDC
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons based on state */}
                  {userStakeData.hasPendingUnstake ? (
                    <div className="space-y-2">
                      {userStakeData.canWithdrawNow ? (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => setShowWithdrawModal(true)}
                          disabled={isCompletingUnstake}
                        >
                          {isCompletingUnstake ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            'Withdraw Funds'
                          )}
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        className="w-full border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white"
                        onClick={() => setShowCancelUnstakeModal(true)}
                        disabled={isCancellingUnstake}
                      >
                        {isCancellingUnstake ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Cancel & Restake'
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userStakeData.rewards > 0 && (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => claimYield(pool?.slug || resolvedParams.slug)}
                          disabled={isClaimingYield}
                        >
                          {isClaimingYield ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Claiming...
                            </>
                          ) : (
                            <>
                              <Banknote className="mr-2 h-4 w-4" />
                              Claim Interest ({userStakeData.rewards.toLocaleString()} USDC)
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="w-full border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                        onClick={() => setShowUnstakeModal(true)}
                      >
                        Unstake Funds
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stake Action Card - Show disabled state for Coming Soon pools */}
            {isComingSoon ? (
              <Card variant="elevated" className="border-purple-200 bg-purple-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-900">
                    <Sparkles className="h-5 w-5" />
                    Coming Soon
                  </CardTitle>
                  <CardDescription>This pool is not yet accepting investments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-purple-100 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-800">
                      This pool is currently being prepared for launch. Investment will be available once the pool is activated.
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                      <span>Pool details being finalized</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span>Launch announcement coming soon</span>
                    </div>
                  </div>
                  <Button disabled className="w-full" size="lg">
                    Investment Coming Soon
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Stake in This Pool</CardTitle>
                  <CardDescription>Enter amount to calculate returns</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Token Balance Display */}
                  {isConnected && balance !== undefined && (
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm text-muted-foreground">Your Balance:</span>
                      <span className="font-semibold">
                        {Number(formatUnits(balance, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="stakeAmount">Amount (USDC)</Label>
                      {isConnected && balance && (
                        <Button
                          variant="link"
                          className="h-auto p-0 text-xs"
                          onClick={() => setStakeAmount(formatUnits(balance, 6))}
                        >
                          Use Max
                        </Button>
                      )}
                    </div>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="stakeAmount"
                        type="number"
                        placeholder={`Min. ${pool.minimumStake || 100}`}
                        className="pl-9"
                        value={stakeAmount}
                        onChange={e => setStakeAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Estimated Returns */}
                  {stakeAmount && parseFloat(stakeAmount) >= (pool.minimumStake || 100) && (
                    <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700">Estimated Shares</span>
                        <span className="font-semibold text-blue-900">
                          {estimatedShares.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700">Est. Annual Return</span>
                        <span className="font-semibold text-green-600">
                          {estimatedAnnualReturn.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700">Est. Monthly Return</span>
                        <span className="font-semibold text-green-600">
                          {estimatedMonthlyReturn.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                    disabled={
                      !stakeAmount ||
                      parseFloat(stakeAmount) < (pool.minimumStake || 100) ||
                      isStaking ||
                      !isConnected
                    }
                    onClick={() => setShowStakeConfirmModal(true)}
                  >
                    {isStaking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Staking...
                      </>
                    ) : isConnected ? (
                      'Stake Funds'
                    ) : (
                      'Connect Wallet to Stake'
                    )}
                  </Button>

                  {/* Info Notice */}
                  <div className={`flex items-start gap-2 p-3 rounded-lg border ${onChainPool?.cooldownWaived ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${onChainPool?.cooldownWaived ? 'text-green-600' : 'text-yellow-600'}`} />
                    <p className={`text-xs ${onChainPool?.cooldownWaived ? 'text-green-800' : 'text-yellow-800'}`}>
                      {onChainPool?.cooldownWaived
                        ? 'Cooldown is currently waived for this pool. You can withdraw at any time.'
                        : 'Your funds will be locked in the pool. Withdrawals have a 7-day cooldown period.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pool Stats Card */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="text-base">Pool Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Total Investors
                  </span>
                  <span className="font-semibold">
                    {isComingSoon ? '—' : (pool.totalInvestors || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {isComingSoon ? 'Status' : 'Utilization Rate'}
                  </span>
                  <span className={`font-semibold ${isComingSoon ? 'text-purple-600' : ''}`}>
                    {isComingSoon ? 'Preparing' : `${utilizationRate.toFixed(1)}%`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Pool Type
                  </span>
                  <Badge variant="outline">{pool.poolType?.replace('_', ' ') || 'N/A'}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Apply for Funding Button */}
            <Link href="/borrower/loans/apply" className="block">
              <Button
                variant="outline"
                size="lg"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
              >
                Apply for Funding
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stake Confirmation Modal */}
      {showStakeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
          <Card variant="glass" className="max-w-md w-full m-4 shadow-soft-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Stake Confirmed!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your stake of {parseFloat(stakeAmount || '0').toLocaleString()} USDC has been successfully added to{' '}
                <strong>{pool.name}</strong>.
              </p>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  🎉 You'll start earning {pool.annualizedReturn?.toFixed(1) || 'N/A'}% APY immediately!
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowStakeModal(false)}
                >
                  Close
                </Button>
                <Link href="/explore/portfolio" className="flex-1">
                  <Button className="w-full">
                    View Portfolio
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unstake Modal */}
      {showUnstakeModal && userStakeData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
          <Card variant="glass" className="max-w-md w-full m-4 shadow-soft-lg">
            <CardHeader>
              <CardTitle>Unstake Funds</CardTitle>
              <CardDescription>
                Withdraw your staked funds from {pool.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Currently Staked:</span>
                    <span className="font-semibold">{userStakeData.amount.toLocaleString()} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Earned Rewards:</span>
                    <span className="font-semibold text-green-600">+{userStakeData.rewards.toLocaleString()} USDC</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unstakeAmount">Unstake Amount (USDC)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="unstakeAmount"
                    type="number"
                    placeholder={`Max: ${userStakeData.amount}`}
                    className="pl-9"
                    value={unstakeAmount}
                    onChange={e => setUnstakeAmount(e.target.value)}
                    max={userStakeData.amount}
                  />
                </div>
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => setUnstakeAmount(userStakeData.amount.toString())}
                >
                  Unstake Maximum
                </Button>
              </div>

              <div className={`p-3 rounded-lg border ${onChainPool?.cooldownWaived ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-start gap-2">
                  <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${onChainPool?.cooldownWaived ? 'text-green-600' : 'text-yellow-600'}`} />
                  <p className={`text-xs ${onChainPool?.cooldownWaived ? 'text-green-800' : 'text-yellow-800'}`}>
                    {onChainPool?.cooldownWaived
                      ? <><strong>No cooldown:</strong> Cooldown is waived for this pool. You can withdraw immediately after unstaking.</>
                      : <><strong>7-day cooldown period:</strong> Your funds will be locked for 7 days after unstaking before you can withdraw them.</>}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowUnstakeModal(false);
                    setUnstakeAmount('');
                  }}
                  disabled={isUnstaking}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={
                    isUnstaking ||
                    !unstakeAmount ||
                    parseFloat(unstakeAmount) <= 0 ||
                    parseFloat(unstakeAmount) > userStakeData.amount
                  }
                  onClick={() => {
                    setShowUnstakeModal(false);
                    setShowUnstakeConfirmModal(true);
                  }}
                >
                  {isUnstaking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Request Unstake'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stake Confirmation Modal */}
      <HoldConfirmModal
        open={showStakeConfirmModal}
        onOpenChange={setShowStakeConfirmModal}
        onConfirm={handleStake}
        title="Confirm Stake"
        description="You are about to stake funds into this lending pool. Your funds will be locked and earn yield from loan interest."
        confirmText="Hold to Stake"
        variant="success"
        duration={1500}
        loading={isStaking}
        details={
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">{parseFloat(stakeAmount || '0').toLocaleString()} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pool:</span>
              <span className="font-medium">{pool?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target APY:</span>
              <span className="font-medium text-green-600">{pool?.annualizedReturn?.toFixed(1) || '0'}%</span>
            </div>
            <p className="pt-2 text-xs text-muted-foreground border-t">
              By depositing into this pool, you agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">
                Terms and Conditions
              </a>{' '}
              and acknowledge the risks disclosed in the{' '}
              <a href={`/explore/pools/${resolvedParams.slug}/documents`} target="_blank" rel="noopener noreferrer" className="underline">
                pool documents
              </a>.
            </p>
          </div>
        }
      />

      {/* Unstake Confirmation Modal */}
      <HoldConfirmModal
        open={showUnstakeConfirmModal}
        onOpenChange={setShowUnstakeConfirmModal}
        onConfirm={handleUnstake}
        title="Confirm Unstake Request"
        description={onChainPool?.cooldownWaived
          ? "Cooldown is waived. You can withdraw your funds immediately after this request."
          : "Your unstake request will begin a 7-day cooldown period. After the cooldown, you can withdraw your funds."}
        confirmText="Hold to Unstake"
        variant="destructive"
        duration={2000}
        loading={isUnstaking}
        details={
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">{parseFloat(unstakeAmount || '0').toLocaleString()} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cooldown Period:</span>
              <span className="font-medium">{onChainPool?.cooldownWaived ? 'Waived' : '7 days'}</span>
            </div>
          </div>
        }
      />

      {/* Withdraw Confirmation Modal */}
      <HoldConfirmModal
        open={showWithdrawModal}
        onOpenChange={setShowWithdrawModal}
        onConfirm={handleCompleteUnstake}
        title="Withdraw Funds"
        description="Your cooldown period is complete. Confirm to withdraw your funds to your wallet."
        confirmText="Hold to Withdraw"
        variant="success"
        duration={2000}
        loading={isCompletingUnstake}
        details={
          userStakeData ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">{userStakeData.pendingUnstake?.toLocaleString() || 0} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rewards:</span>
                <span className="font-medium text-green-600">+{userStakeData.rewards?.toLocaleString() || 0} USDC</span>
              </div>
            </div>
          ) : null
        }
      />

      {/* Cancel Unstake Confirmation Modal */}
      <HoldConfirmModal
        open={showCancelUnstakeModal}
        onOpenChange={setShowCancelUnstakeModal}
        onConfirm={handleCancelUnstake}
        title="Cancel Unstake Request"
        description="This will cancel your pending unstake request and restake your funds back into the pool."
        confirmText="Hold to Cancel"
        variant="warning"
        duration={1500}
        loading={isCancellingUnstake}
        details={
          userStakeData ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount to Restake:</span>
                <span className="font-medium">{userStakeData.pendingUnstake?.toLocaleString() || 0} USDC</span>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
}

// Pool Activity Component - Shows recent staking transactions for this pool
function PoolActivity({ poolSlug }: { poolSlug: string }) {
  const { data: activityData, isLoading } = useSWR(
    `/api/pools/${poolSlug}/activity`,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  const transactions = activityData?.transactions || [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'stake':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'unstake':
        return <ArrowDownLeft className="h-4 w-4 text-orange-600" />;
      case 'unstake_request':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'disbursement':
        return <Banknote className="h-4 w-4 text-blue-600" />;
      case 'repayment':
        return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stake: 'Staked',
      unstake: 'Unstaked',
      unstake_request: 'Unstake Requested',
      disbursement: 'Loan Disbursed',
      repayment: 'Loan Repayment',
    };
    return labels[type] || type;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Pool Activity
        </CardTitle>
        <CardDescription>Recent transactions in this pool</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-300" />
                  <div className="space-y-1">
                    <div className="h-4 w-24 bg-gray-300 rounded" />
                    <div className="h-3 w-32 bg-gray-300 rounded" />
                  </div>
                </div>
                <div className="h-5 w-20 bg-gray-300 rounded" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            No activity yet. Be the first to stake in this pool!
          </p>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 5).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background">
                    {getTypeIcon(tx.type)}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{getTypeLabel(tx.type)}</span>
                      {tx.transaction_hash && (
                        <a
                          href={getExplorerUrl('tx', tx.transaction_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{formatAddress(tx.user_address)}</span>
                      <span>•</span>
                      <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <span className={`font-semibold text-sm ${(tx.type === 'stake' || tx.type === 'repayment') ? 'text-green-600' : 'text-orange-600'}`}>
                  {(tx.type === 'stake' || tx.type === 'repayment') ? '+' : '-'}{tx.amount.toLocaleString()} USDC
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
