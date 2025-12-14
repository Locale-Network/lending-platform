'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useToast } from '@/hooks/use-toast';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { parseUnits, formatUnits } from 'viem';
import {
  usePoolDetails,
  useUserStake,
  useStakingToken,
  useStakeWithApproval,
  useRequestUnstake,
  useCompleteUnstake,
  useCancelUnstake,
  useStake,
} from '@/hooks/useStakingPool';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Mock pool data
const mockPool = {
  id: '1',
  name: 'Small Business Growth Pool',
  slug: 'small-business-growth',
  description:
    'Invest in carefully vetted small businesses with strong growth potential. This pool focuses on established businesses with proven revenue streams and solid business models.',
  type: 'SMALL_BUSINESS',
  status: 'ACTIVE',
  apy: 12.5,
  tvl: 1250000,
  targetSize: 2000000,
  availableLiquidity: 450000,
  investors: 47,
  minStake: 100,
  managementFee: 2,
  performanceFee: 10,
  risk: 'Medium',
  activeLoans: 15,
  minimumCreditScore: 650,
  maxLTV: 80,
};

const mockUserStake = {
  amount: 5000,
  shares: 4850,
  rewards: 625,
};

export default function PoolDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);
  const [stakingStep, setStakingStep] = useState<'idle' | 'approving' | 'staking' | 'success'>('idle');

  const { toast } = useToast();
  const { address, isConnected } = useWalletAuth();

  // Fetch pool data from API
  const { data: pool, error, isLoading, mutate } = useSWR(`/api/pools/public/${resolvedParams.slug}`, fetcher);

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

  const { stake: stakeTokens } = useStake();

  // Get user's on-chain stake data
  const { stake: userStakeOnChain, refetch: refetchUserStake } = useUserStake(pool?.slug);
  const { tokenAddress } = useStakingToken();

  // Derived state
  const isStaking = isApproving || isStakingContract || stakingStep === 'approving' || stakingStep === 'staking';
  const isUnstaking = isUnstakePending || isUnstakeConfirming;

  // If still loading or error, use defaults for calculations
  const poolData = pool || mockPool;

  const utilizationRate = poolData.totalStaked && poolData.availableLiquidity
    ? ((poolData.totalStaked - poolData.availableLiquidity) / poolData.totalStaked) * 100
    : 0;
  const targetProgress = poolData.totalStaked && poolData.poolSize
    ? (poolData.totalStaked / poolData.poolSize) * 100
    : 0;

  // Calculate estimated shares and returns
  const estimatedShares = stakeAmount ? parseFloat(stakeAmount) * 0.97 : 0; // Mock 3% fee
  const estimatedAnnualReturn = stakeAmount && poolData.annualizedReturn
    ? (parseFloat(stakeAmount) * poolData.annualizedReturn) / 100
    : 0;
  const estimatedMonthlyReturn = estimatedAnnualReturn / 12;

  // Format user stake data from on-chain
  const userStakeData = userStakeOnChain ? {
    hasStake: userStakeOnChain.amount > 0n,
    amount: Number(formatUnits(userStakeOnChain.amount, 6)),
    shares: Number(formatUnits(userStakeOnChain.shares, 6)),
    rewards: 0, // Calculate from share value vs staked amount
    pendingUnstake: Number(formatUnits(userStakeOnChain.pendingUnstake, 6)),
    hasPendingUnstake: userStakeOnChain.pendingUnstake > 0n,
    canWithdrawAt: Number(userStakeOnChain.canWithdrawAt),
    canWithdrawNow: userStakeOnChain.canWithdrawAt > 0n && Number(userStakeOnChain.canWithdrawAt) * 1000 <= Date.now(),
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

  // Handle unstake confirmation
  useEffect(() => {
    if (isUnstakeConfirmed) {
      setShowUnstakeModal(false);
      setUnstakeAmount('');
      refetchUserStake();
      mutate();
      toast({
        title: 'Unstake Requested!',
        description: 'Funds will be available after 7-day cooldown period.',
      });
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

  const handleStake = async () => {
    const minStake = poolData.minimumStake || mockPool.minStake;
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading pool details...</span>
      </div>
    );
  }

  // Error state
  if (error || !pool) {
    return (
      <div className="space-y-8 p-8">
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

  return (
    <div className="space-y-8 p-8">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        <Link href="/explore/pools" className="hover:underline">
          All Pools
        </Link>
        {' / '}
        <span className="text-foreground font-medium">{poolData.name}</span>
      </div>

      {/* Hero Section */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pool Header */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-2xl font-bold">{poolData.name}</h1>
              <Badge className="bg-green-100 text-green-800">
                {poolData.status}
              </Badge>
            </div>
            <div className="text-base text-muted-foreground" dangerouslySetInnerHTML={{ __html: poolData.description || '' }} />
          </div>

          {/* Key Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Current APY</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{poolData.annualizedReturn?.toFixed(1) || 'N/A'}%</div>
                <p className="text-xs text-muted-foreground mt-1">Annual percentage yield</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Value Locked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((poolData.totalStaked || 0) / 1000000).toFixed(2)}M USDC
                </div>
                <Progress value={targetProgress} className="mt-2 h-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {targetProgress.toFixed(0)}% of {((poolData.poolSize || 0) / 1000000).toFixed(1)}M USDC target
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Available Liquidity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((poolData.availableLiquidity || 0) / 1000).toFixed(0)}K USDC
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {utilizationRate.toFixed(0)}% utilized
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for Detailed Info */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="loans">Active Loans</TabsTrigger>
              <TabsTrigger value="terms">Terms & Fees</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pool Strategy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    This pool invests in small businesses with annual revenues between $500K-$5M. We focus
                    on companies with:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Minimum 2 years of operating history</li>
                    <li>Positive cash flow for the last 12 months</li>
                    <li>Credit scores above {poolData.minCreditScore || 650}</li>
                    <li>Clear business expansion or working capital needs</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Pool Type</Label>
                      <Badge variant="outline">{poolData.poolType?.replace('_', ' ') || 'N/A'}</Badge>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Loan-to-Value</Label>
                      <p className="text-2xl font-bold">{poolData.maxLTV || 'N/A'}%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Credit Score</Label>
                      <p className="text-2xl font-bold">{poolData.minCreditScore || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Total Investors</Label>
                      <p className="text-2xl font-bold">{poolData.totalInvestors || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Historical Performance</CardTitle>
                  <CardDescription>Last 90 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    📊 Performance chart would go here
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="loans" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Loans</CardTitle>
                  <CardDescription>Loan information coming soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Loan details will be displayed here once available.</p>
                  </div>
                </CardContent>
              </Card>
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
                      <p className="text-2xl font-bold">{poolData.managementFeeRate || 0}%</p>
                      <p className="text-xs text-muted-foreground">Annual fee on total staked</p>
                    </div>
                    <div>
                      <Label>Performance Fee</Label>
                      <p className="text-2xl font-bold">{poolData.performanceFeeRate || 0}%</p>
                      <p className="text-xs text-muted-foreground">Fee on profits only</p>
                    </div>
                    <div>
                      <Label>Minimum Stake</Label>
                      <p className="text-2xl font-bold">{poolData.minimumStake || 0} USDC</p>
                      <p className="text-xs text-muted-foreground">Minimum investment amount</p>
                    </div>
                    <div>
                      <Label>Withdrawal Period</Label>
                      <p className="text-2xl font-bold">7 days</p>
                      <p className="text-xs text-muted-foreground">Unstaking cooldown period</p>
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
                  href={`https://sepolia.arbiscan.io/address/${process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS}`}
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
                                <strong>7-day cooldown in progress.</strong> You can complete your withdrawal or cancel and restake after the cooldown period ends.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {!userStakeData.hasPendingUnstake && (
                      <div className="flex justify-between pt-2 border-t border-green-200">
                        <span className="text-sm text-green-700">Total Rewards</span>
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
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={handleCompleteUnstake}
                          disabled={isCompletingUnstake}
                        >
                          {isCompletingUnstake ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Withdrawing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Complete Withdrawal
                            </>
                          )}
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        className="w-full border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                        onClick={handleCancelUnstake}
                        disabled={isCancellingUnstake}
                      >
                        {isCancellingUnstake ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          'Cancel & Restake'
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                      onClick={() => setShowUnstakeModal(true)}
                    >
                      Unstake Funds
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stake Action Card */}
            <Card>
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
                      placeholder={`Min. ${poolData.minimumStake || 100}`}
                      className="pl-9"
                      value={stakeAmount}
                      onChange={e => setStakeAmount(e.target.value)}
                    />
                  </div>
                </div>

                {/* Estimated Returns */}
                {stakeAmount && parseFloat(stakeAmount) >= (poolData.minimumStake || 100) && (
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
                  className="w-full"
                  size="lg"
                  onClick={handleStake}
                  disabled={
                    !stakeAmount ||
                    parseFloat(stakeAmount) < (poolData.minimumStake || 100) ||
                    isStaking ||
                    !isConnected
                  }
                >
                  {isStaking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {stakingStep === 'approving' ? 'Approving...' : 'Staking...'}
                    </>
                  ) : (
                    <>
                      <Wallet className="mr-2 h-4 w-4" />
                      {isConnected ? 'Stake Now' : 'Connect Wallet to Stake'}
                    </>
                  )}
                </Button>

                {/* Info Notice */}
                <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-800">
                    Your funds will be locked in the pool. Withdrawals have a 7-day cooldown period.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Pool Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pool Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Total Investors
                  </span>
                  <span className="font-semibold">{poolData.totalInvestors || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Utilization Rate
                  </span>
                  <span className="font-semibold">{utilizationRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Pool Type
                  </span>
                  <Badge variant="outline">{poolData.poolType?.replace('_', ' ') || 'N/A'}</Badge>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full m-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Stake Confirmed!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your stake of {parseFloat(stakeAmount || '0').toLocaleString()} USDC has been successfully added to{' '}
                <strong>{poolData.name}</strong>.
              </p>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  🎉 You'll start earning {poolData.annualizedReturn?.toFixed(1) || 'N/A'}% APY immediately!
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full m-4">
            <CardHeader>
              <CardTitle>Unstake Funds</CardTitle>
              <CardDescription>
                Withdraw your staked funds from {poolData.name}
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

              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-800">
                    <strong>7-day cooldown period:</strong> Your funds will be locked for 7 days after unstaking before you can withdraw them.
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
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleUnstake}
                  disabled={
                    isUnstaking ||
                    !unstakeAmount ||
                    parseFloat(unstakeAmount) <= 0 ||
                    parseFloat(unstakeAmount) > userStakeData.amount
                  }
                >
                  {isUnstaking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Unstaking...
                    </>
                  ) : (
                    'Confirm Unstake'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
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
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stake: 'Staked',
      unstake: 'Unstaked',
      unstake_request: 'Unstake Requested',
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
        <CardDescription>Recent staking transactions in this pool</CardDescription>
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
                          href={`https://sepolia.arbiscan.io/tx/${tx.transaction_hash}`}
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
                <span className={`font-semibold text-sm ${tx.type === 'stake' ? 'text-green-600' : 'text-orange-600'}`}>
                  {tx.type === 'stake' ? '+' : '-'}{tx.amount.toLocaleString()} USDC
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
