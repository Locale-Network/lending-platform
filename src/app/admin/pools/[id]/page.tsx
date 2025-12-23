'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import RichTextEditor from '@/components/ui/rich-text-editor';
import {
  AlertTriangle,
  ArrowLeft,
  TrendingUp,
  Wallet,
  Users,
  DollarSign,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileText,
  Sparkles,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const POOL_TYPES = [
  { value: 'SMALL_BUSINESS', label: 'Small Business' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'CONSUMER', label: 'Consumer Loans' },
  { value: 'MIXED', label: 'Mixed Portfolio' },
];

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-red-100 text-red-800',
};

export default function ManagePoolPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.id as string;

  // Fetch pool data from API
  const { data: poolData, error, isLoading } = useSWR(`/api/pools/${poolId}`, fetcher);

  const [isEditExpanded, setIsEditExpanded] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Update form data when pool data loads
  if (poolData && !formData) {
    setFormData({
      name: poolData.name,
      slug: poolData.slug,
      poolType: poolData.poolType,
      description: poolData.description,
      targetSize: poolData.poolSize?.toString() || '',
      minimumStake: poolData.minimumStake?.toString() || '',
      managementFee: poolData.managementFeeRate?.toString() || '',
      performanceFee: poolData.performanceFeeRate?.toString() || '',
      baseInterestRate: poolData.baseInterestRate?.toString() || '',
      riskPremiumMin: poolData.riskPremiumMin?.toString() || '',
      riskPremiumMax: poolData.riskPremiumMax?.toString() || '',
      maxLoanToValue: poolData.maxLTV?.toString() || '',
      minimumCreditScore: poolData.minCreditScore?.toString() || '',
      allowedIndustries: poolData.allowedIndustries?.join(', ') || '',
      imageUrl: poolData.imageUrl || '',
    });
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error || !poolData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive mb-4">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold">Pool Not Found</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              The pool you're looking for doesn't exist or you don't have permission to access it.
            </p>
            <Link href="/admin/pools">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Pools
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pool = poolData;

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const updateData = {
        name: formData.name,
        description: formData.description,
        managementFeeRate: parseFloat(formData.managementFee),
        performanceFeeRate: parseFloat(formData.performanceFee),
        baseInterestRate: parseFloat(formData.baseInterestRate),
        riskPremiumMin: parseFloat(formData.riskPremiumMin),
        riskPremiumMax: parseFloat(formData.riskPremiumMax),
        minCreditScore: formData.minimumCreditScore ? parseInt(formData.minimumCreditScore) : null,
        maxLTV: formData.maxLoanToValue ? parseFloat(formData.maxLoanToValue) : null,
        allowedIndustries: formData.allowedIndustries
          ? formData.allowedIndustries.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
        imageUrl: formData.imageUrl || null,
      };

      const response = await fetch(`/api/pools/${poolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update pool');
      }

      // Revalidate the cache
      mutate(`/api/pools/${poolId}`);
      setSaveSuccess(true);
      setIsEditExpanded(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update pool');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePool = async () => {
    try {
      const response = await fetch(`/api/pools/${poolId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete pool');
      }

      router.push('/admin/pools');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete pool');
    }
  };

  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/pools">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Pools
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{pool.name}</h1>
          <p className="text-muted-foreground mt-2">Manage pool settings and configuration</p>
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[pool.status as keyof typeof statusColors]}`}
        >
          {pool.status}
        </span>
      </div>

      {/* Success/Error Messages */}
      {saveSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            Pool configuration updated successfully!
          </AlertDescription>
        </Alert>
      )}
      {saveError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {/* Pool Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(pool.totalStaked || 0).toLocaleString()} USDC</div>
            <p className="text-xs text-muted-foreground">Current TVL</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">APY</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pool.annualizedReturn ? `${pool.annualizedReturn}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Annualized return</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Investors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pool.totalInvestors || 0}</div>
            <p className="text-xs text-muted-foreground">Active investors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Liquidity</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(pool.availableLiquidity || 0).toLocaleString()} USDC</div>
            <p className="text-xs text-muted-foreground">For new loans</p>
          </CardContent>
        </Card>
      </div>

      {/* Pool Details */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Details</CardTitle>
          <CardDescription>Basic information about this pool</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pool Name</p>
              <p className="text-lg font-semibold">{pool.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pool Type</p>
              <p className="text-lg font-semibold">{pool.poolType?.replace('_', ' ') || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pool ID</p>
              <p className="text-lg font-mono">{pool.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Slug</p>
              <p className="text-lg font-mono">{pool.slug}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
            <div className="text-sm" dangerouslySetInnerHTML={{ __html: pool.description || '' }} />
          </div>
        </CardContent>
      </Card>

      {/* Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Actions</CardTitle>
          <CardDescription>Common management actions for this pool</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Edit Pool Configuration - Expandable */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setIsEditExpanded(!isEditExpanded)}
            >
              <span>Edit Pool Configuration</span>
              {isEditExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {/* Expandable Edit Form */}
            {isEditExpanded && (
              <div className="border rounded-lg p-6 space-y-6 bg-gray-50 animate-in slide-in-from-top-2">
                {/* Step 1: Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="name">Pool Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={e => handleInputChange('name', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug">URL Slug *</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={e => handleInputChange('slug', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Will be used in URL: /explore/pools/{formData.slug}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="poolType">Pool Type *</Label>
                    <Select value={formData.poolType} onValueChange={value => handleInputChange('poolType', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POOL_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <RichTextEditor
                      value={formData.description}
                      onChange={value => handleInputChange('description', value)}
                      placeholder="Describe the pool's investment strategy, target borrowers, and key features..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Use the toolbar to format text, add images, and create lists
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imageUrl">Pool Image URL (optional)</Label>
                    <Input
                      id="imageUrl"
                      type="url"
                      value={formData.imageUrl}
                      onChange={e => handleInputChange('imageUrl', e.target.value)}
                    />
                  </div>
                </div>

                {/* Step 2: Pool Parameters */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Pool Parameters</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetSize">Target Pool Size (USDC) *</Label>
                      <Input
                        id="targetSize"
                        type="number"
                        value={formData.targetSize}
                        onChange={e => handleInputChange('targetSize', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxSize">Maximum Pool Size (USDC)</Label>
                      <Input
                        id="maxSize"
                        type="number"
                        value={formData.maxSize}
                        onChange={e => handleInputChange('maxSize', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minimumStake">Minimum Stake Amount (USDC) *</Label>
                    <Input
                      id="minimumStake"
                      type="number"
                      value={formData.minimumStake}
                      onChange={e => handleInputChange('minimumStake', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="managementFee">Management Fee (%) *</Label>
                      <Input
                        id="managementFee"
                        type="number"
                        step="0.1"
                        value={formData.managementFee}
                        onChange={e => handleInputChange('managementFee', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="performanceFee">Performance Fee (%) *</Label>
                      <Input
                        id="performanceFee"
                        type="number"
                        step="0.1"
                        value={formData.performanceFee}
                        onChange={e => handleInputChange('performanceFee', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Step 3: Interest Rates */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Interest Rates</h3>
                  <div className="space-y-2">
                    <Label htmlFor="baseInterestRate">Base Interest Rate (%) *</Label>
                    <Input
                      id="baseInterestRate"
                      type="number"
                      step="0.1"
                      value={formData.baseInterestRate}
                      onChange={e => handleInputChange('baseInterestRate', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="riskPremiumMin">Minimum Risk Premium (%) *</Label>
                      <Input
                        id="riskPremiumMin"
                        type="number"
                        step="0.1"
                        value={formData.riskPremiumMin}
                        onChange={e => handleInputChange('riskPremiumMin', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="riskPremiumMax">Maximum Risk Premium (%) *</Label>
                      <Input
                        id="riskPremiumMax"
                        type="number"
                        step="0.1"
                        value={formData.riskPremiumMax}
                        onChange={e => handleInputChange('riskPremiumMax', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Step 4: Risk Parameters */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Risk Parameters</h3>
                  <div className="space-y-2">
                    <Label htmlFor="maxLoanToValue">Maximum Loan-to-Value Ratio (%) *</Label>
                    <Input
                      id="maxLoanToValue"
                      type="number"
                      value={formData.maxLoanToValue}
                      onChange={e => handleInputChange('maxLoanToValue', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minimumCreditScore">Minimum Credit Score *</Label>
                    <Input
                      id="minimumCreditScore"
                      type="number"
                      value={formData.minimumCreditScore}
                      onChange={e => handleInputChange('minimumCreditScore', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allowedIndustries">Allowed Industries (optional)</Label>
                    <Textarea
                      id="allowedIndustries"
                      rows={3}
                      value={formData.allowedIndustries}
                      onChange={e => handleInputChange('allowedIndustries', e.target.value)}
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={handleSaveChanges} className="flex-1" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormData({
                        name: poolData.name,
                        slug: poolData.slug,
                        poolType: poolData.poolType,
                        description: poolData.description,
                        targetSize: poolData.poolSize?.toString() || '',
                        minimumStake: poolData.minimumStake?.toString() || '',
                        managementFee: poolData.managementFeeRate?.toString() || '',
                        performanceFee: poolData.performanceFeeRate?.toString() || '',
                        baseInterestRate: poolData.baseInterestRate?.toString() || '',
                        riskPremiumMin: poolData.riskPremiumMin?.toString() || '',
                        riskPremiumMax: poolData.riskPremiumMax?.toString() || '',
                        maxLoanToValue: poolData.maxLTV?.toString() || '',
                        minimumCreditScore: poolData.minCreditScore?.toString() || '',
                        allowedIndustries: poolData.allowedIndustries?.join(', ') || '',
                        imageUrl: poolData.imageUrl || '',
                      });
                      setIsEditExpanded(false);
                      setSaveError(null);
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* View Investor List */}
          <Link href="/admin/investors">
            <Button variant="outline" className="w-full justify-start">
              View Investor List
            </Button>
          </Link>

          {/* View Public Page */}
          <Link href={`/explore/pools/${pool.slug}`} target="_blank">
            <Button variant="outline" className="w-full justify-start">
              <span>View Public Page</span>
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Pool Status Management */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Status</CardTitle>
          <CardDescription>Change the pool's operational status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-semibold">Current Status</p>
              <p className="text-sm text-muted-foreground mt-1">
                {pool.status === 'DRAFT' && 'Pool is in draft mode and not visible to investors'}
                {pool.status === 'ACTIVE' && 'Pool is live and accepting investments'}
                {pool.status === 'PAUSED' && 'Pool is temporarily paused'}
                {pool.status === 'CLOSED' && 'Pool is permanently closed'}
              </p>
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[pool.status as keyof typeof statusColors]}`}
            >
              {pool.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {pool.status === 'DRAFT' && (
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/pools/${poolId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'ACTIVE' }),
                    });
                    if (!response.ok) throw new Error('Failed to activate pool');
                    mutate(`/api/pools/${poolId}`);
                    setSaveSuccess(true);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to activate pool');
                  }
                }}
              >
                Activate Pool
              </Button>
            )}

            {pool.status === 'ACTIVE' && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/pools/${poolId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'PAUSED' }),
                    });
                    if (!response.ok) throw new Error('Failed to pause pool');
                    mutate(`/api/pools/${poolId}`);
                    setSaveSuccess(true);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to pause pool');
                  }
                }}
              >
                Pause Pool
              </Button>
            )}

            {pool.status === 'PAUSED' && (
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/pools/${poolId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'ACTIVE' }),
                    });
                    if (!response.ok) throw new Error('Failed to reactivate pool');
                    mutate(`/api/pools/${poolId}`);
                    setSaveSuccess(true);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to reactivate pool');
                  }
                }}
              >
                Reactivate Pool
              </Button>
            )}

            {(pool.status === 'ACTIVE' || pool.status === 'PAUSED') && (
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm('Are you sure you want to permanently close this pool? This action cannot be undone.')) {
                    return;
                  }
                  try {
                    const response = await fetch(`/api/pools/${poolId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'CLOSED' }),
                    });
                    if (!response.ok) throw new Error('Failed to close pool');
                    mutate(`/api/pools/${poolId}`);
                    setSaveSuccess(true);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to close pool');
                  }
                }}
              >
                Close Pool
              </Button>
            )}
          </div>

          {pool.status === 'DRAFT' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This pool is currently in <strong>DRAFT</strong> status. Activate it to make it visible on the Explore page for investors.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Coming Soon Promotion - Only for DRAFT pools */}
      {pool.status === 'DRAFT' && (
        <Card className={pool.isComingSoon ? 'border-purple-200 bg-purple-50/50' : ''}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className={`h-5 w-5 ${pool.isComingSoon ? 'text-purple-600' : 'text-muted-foreground'}`} />
              <CardTitle>Public Preview (Coming Soon)</CardTitle>
            </div>
            <CardDescription>
              Show this DRAFT pool on the public Explore page as "Coming Soon" for promotional purposes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <p className="font-semibold">Enable Coming Soon Preview</p>
                <p className="text-sm text-muted-foreground mt-1">
                  When enabled, this pool will appear on the Explore page with a "Coming Soon" badge.
                  Investors can view pool details but cannot stake until the pool is activated.
                </p>
              </div>
              <Switch
                checked={pool.isComingSoon}
                onCheckedChange={async (checked) => {
                  try {
                    const response = await fetch(`/api/pools/${poolId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ isComingSoon: checked }),
                    });
                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || 'Failed to update coming soon status');
                    }
                    mutate(`/api/pools/${poolId}`);
                    setSaveSuccess(true);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to update coming soon status');
                  }
                }}
              />
            </div>

            {pool.isComingSoon && (
              <div className="flex items-start gap-3 p-4 bg-purple-100 rounded-lg border border-purple-200">
                <Eye className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-purple-900">Public Preview Active</p>
                  <p className="text-sm text-purple-700 mt-1">
                    This pool is now visible on the public Explore page with a "Coming Soon" badge.
                    When you activate this pool, the Coming Soon status will be automatically removed.
                  </p>
                  <Link href={`/explore/pools/${pool.slug}`} target="_blank" className="inline-block mt-2">
                    <Button variant="outline" size="sm" className="border-purple-300 text-purple-700 hover:bg-purple-100">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Public Preview
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {!pool.isComingSoon && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Enable this option to promote your pool before launch. The pool will appear on the Explore page
                  with a "Coming Soon" badge, allowing potential investors to preview the opportunity.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compliance Documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Compliance Documents</CardTitle>
          </div>
          <CardDescription>Manage PPM, subscription agreements, and other compliance documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Upload and manage compliance documents that investors will see on the pool's documents page.
              </p>
            </div>
            <Link href={`/admin/pools/${poolId}/documents`}>
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                Manage Documents
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
          </div>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-red-600">Delete this pool</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Once you delete a pool, there is no going back. Please be certain.
                </p>
                {pool.totalInvestors > 0 && (
                  <p className="text-sm font-semibold text-red-600 mt-2">
                    Warning: This pool has {pool.totalInvestors} active investor
                    {pool.totalInvestors > 1 ? 's' : ''} and {pool.totalStaked.toLocaleString()} USDC in
                    TVL.
                  </p>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="ml-4">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Pool
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the pool "
                      {pool.name}" and remove all associated data from our servers.
                      {pool.totalInvestors > 0 && (
                        <span className="block mt-4 p-3 bg-red-100 text-red-800 rounded-md font-semibold">
                          <AlertTriangle className="inline h-4 w-4 mr-2" />
                          This pool has {pool.totalInvestors} active investor
                          {pool.totalInvestors > 1 ? 's' : ''} and{' '}
                          {pool.totalStaked.toLocaleString()} USDC in TVL. Deleting this pool may affect
                          these users.
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeletePool}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, delete this pool
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
