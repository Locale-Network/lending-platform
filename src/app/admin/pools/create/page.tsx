'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Check, Loader2, AlertCircle, ExternalLink, Rocket } from 'lucide-react';
import Link from 'next/link';
import RichTextEditor from '@/components/ui/rich-text-editor';
import { Alert, AlertDescription } from '@/components/ui/alert';

const POOL_TYPES = [
  { value: 'SMALL_BUSINESS', label: 'Small Business' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'CONSUMER', label: 'Consumer Loans' },
  { value: 'MIXED', label: 'Mixed Portfolio' },
];

const STEPS = [
  { id: 1, name: 'Basic Information', description: 'Pool name, description, and type' },
  { id: 2, name: 'Pool Parameters', description: 'Size, fees, and minimums' },
  { id: 3, name: 'Interest Rates', description: 'Base rate and risk premiums' },
  { id: 4, name: 'Risk Parameters', description: 'Credit requirements and LTV' },
  { id: 5, name: 'Smart Contract', description: 'Deploy or connect contract' },
  { id: 6, name: 'Review & Launch', description: 'Review all settings' },
];

export default function CreatePoolPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPoolId, setSavedPoolId] = useState<string | null>(null);
  const [deploymentResult, setDeploymentResult] = useState<{
    txHash: string;
    blockNumber: number;
    contractPoolId: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    name: '',
    slug: '',
    description: '',
    type: 'SMALL_BUSINESS',
    imageUrl: '',
    featured: false,

    // Step 2: Pool Parameters
    targetSize: '',
    maxSize: '',
    minimumStake: '100',
    managementFee: '2',
    performanceFee: '10',

    // Step 3: Interest Rates
    baseInterestRate: '5',
    riskPremiumMin: '2',
    riskPremiumMax: '15',

    // Step 4: Risk Parameters
    maxLoanToValue: '80',
    minimumCreditScore: '650',
    allowedIndustries: '',

    // Step 5: Smart Contract
    contractAddress: '',
    tokenAddress: '',
    deployNewContract: true,
  });

  const progress = (currentStep / STEPS.length) * 100;

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Auto-generate slug from name
    if (field === 'name') {
      const slug = value
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Save pool to database (creates DRAFT pool)
  const handleSavePool = async (): Promise<string | null> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const poolData = {
        name: formData.name,
        description: formData.description,
        poolType: formData.type,
        poolSize: parseFloat(formData.targetSize || '0'),
        minimumStake: parseFloat(formData.minimumStake || '0'),
        managementFeeRate: parseFloat(formData.managementFee || '0'),
        performanceFeeRate: parseFloat(formData.performanceFee || '0'),
        baseInterestRate: parseFloat(formData.baseInterestRate || '0'),
        riskPremiumMin: parseFloat(formData.riskPremiumMin || '0'),
        riskPremiumMax: parseFloat(formData.riskPremiumMax || '0'),
        minCreditScore: formData.minimumCreditScore
          ? parseInt(formData.minimumCreditScore)
          : null,
        maxLTV: formData.maxLoanToValue ? parseFloat(formData.maxLoanToValue) : null,
        allowedIndustries: formData.allowedIndustries
          ? formData.allowedIndustries.split(',').map(i => i.trim()).filter(Boolean)
          : [],
        imageUrl: formData.imageUrl || null,
        isFeatured: formData.featured,
      };

      const response = await fetch('/api/pools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(poolData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save pool');
      }

      const createdPool = await response.json();
      setSavedPoolId(createdPool.id);
      setIsSubmitting(false);
      return createdPool.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pool');
      setIsSubmitting(false);
      return null;
    }
  };

  // Deploy pool to smart contract
  const handleDeploy = async () => {
    let poolId = savedPoolId;

    // If pool hasn't been saved yet, save it first
    if (!poolId) {
      poolId = await handleSavePool();
      if (!poolId) return;
    }

    setIsDeploying(true);
    setError(null);

    try {
      const response = await fetch(`/api/pools/${poolId}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to deploy pool');
      }

      const result = await response.json();
      setDeploymentResult({
        txHash: result.transaction.hash,
        blockNumber: result.transaction.blockNumber,
        contractPoolId: result.pool.contractPoolId,
      });
      setIsDeploying(false);

      // Auto advance to review step after successful deployment
      if (currentStep === 5) {
        setCurrentStep(6);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy pool');
      setIsDeploying(false);
    }
  };

  // Final submit - just redirect since pool is already saved and deployed
  const handleSubmit = async () => {
    if (savedPoolId) {
      router.push(`/admin/pools/${savedPoolId}`);
    } else {
      // If for some reason pool wasn't saved, save it now
      const poolId = await handleSavePool();
      if (poolId) {
        router.push(`/admin/pools/${poolId}`);
      }
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <Link href="/admin/pools">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Pools
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Create New Loan Pool</h1>
          <p className="text-muted-foreground mt-2">
            Follow the steps below to configure and launch your investment pool
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Step {currentStep} of {STEPS.length}
            </span>
            <span className="text-muted-foreground">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicators */}
        <div className="grid grid-cols-6 gap-2">
          {STEPS.map(step => (
            <div
              key={step.id}
              className={`text-center p-2 rounded-lg border-2 transition-colors ${
                step.id === currentStep
                  ? 'border-primary bg-primary/10'
                  : step.id < currentStep
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-center mb-1">
                {step.id < currentStep ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-xs font-semibold">{step.id}</span>
                )}
              </div>
              <p className="text-xs font-medium hidden lg:block">{step.name}</p>
            </div>
          ))}
        </div>

        {/* Form Steps */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].name}</CardTitle>
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Pool Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Small Business Growth Pool"
                    value={formData.name}
                    onChange={e => handleInputChange('name', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug *</Label>
                  <Input
                    id="slug"
                    placeholder="small-business-growth-pool"
                    value={formData.slug}
                    onChange={e => handleInputChange('slug', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Will be used in URL: /explore/pools/{formData.slug || 'your-slug'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Pool Type *</Label>
                  <Select value={formData.type} onValueChange={value => handleInputChange('type', value)}>
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
                    placeholder="https://images.unsplash.com/photo-..."
                    value={formData.imageUrl}
                    onChange={e => handleInputChange('imageUrl', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste a URL from Unsplash, Imgur, or other image hosting service
                  </p>

                  {/* Image Preview */}
                  {formData.imageUrl && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Preview:</p>
                      <div className="relative w-full h-32 rounded-lg border overflow-hidden bg-muted">
                        <img
                          src={formData.imageUrl}
                          alt="Pool preview"
                          className="w-full h-full object-cover"
                          onError={e => {
                            e.currentTarget.style.display = 'none';
                            const errorDiv = e.currentTarget.nextElementSibling as HTMLElement;
                            if (errorDiv) errorDiv.classList.remove('hidden');
                          }}
                          onLoad={e => {
                            e.currentTarget.style.display = 'block';
                            const errorDiv = e.currentTarget.nextElementSibling as HTMLElement;
                            if (errorDiv) errorDiv.classList.add('hidden');
                          }}
                        />
                        <div className="hidden absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-muted">
                          Failed to load image
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Pool Parameters */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetSize">Target Pool Size (USDC) *</Label>
                    <Input
                      id="targetSize"
                      type="number"
                      placeholder="1000000"
                      value={formData.targetSize}
                      onChange={e => handleInputChange('targetSize', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Target amount to raise</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxSize">Maximum Pool Size (USDC)</Label>
                    <Input
                      id="maxSize"
                      type="number"
                      placeholder="5000000"
                      value={formData.maxSize}
                      onChange={e => handleInputChange('maxSize', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Optional cap on pool size</p>
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
                  <p className="text-xs text-muted-foreground">
                    Minimum amount an investor can stake
                  </p>
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
                    <p className="text-xs text-muted-foreground">Annual management fee</p>
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
                    <p className="text-xs text-muted-foreground">Fee on profits</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Interest Rates */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="baseInterestRate">Base Interest Rate (%) *</Label>
                  <Input
                    id="baseInterestRate"
                    type="number"
                    step="0.1"
                    value={formData.baseInterestRate}
                    onChange={e => handleInputChange('baseInterestRate', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Base APY for the safest loans
                  </p>
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
                    <p className="text-xs text-muted-foreground">Added for low-risk borrowers</p>
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
                    <p className="text-xs text-muted-foreground">Added for high-risk borrowers</p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900">Expected APY Range</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    {(parseFloat(formData.baseInterestRate) + parseFloat(formData.riskPremiumMin)).toFixed(1)}% -{' '}
                    {(parseFloat(formData.baseInterestRate) + parseFloat(formData.riskPremiumMax)).toFixed(1)}%
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Investors will see this range on the pool details page
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Risk Parameters */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maxLoanToValue">Maximum Loan-to-Value Ratio (%) *</Label>
                  <Input
                    id="maxLoanToValue"
                    type="number"
                    step="1"
                    value={formData.maxLoanToValue}
                    onChange={e => handleInputChange('maxLoanToValue', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum percentage of collateral value that can be loaned
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minimumCreditScore">Minimum Credit Score *</Label>
                  <Input
                    id="minimumCreditScore"
                    type="number"
                    value={formData.minimumCreditScore}
                    onChange={e => handleInputChange('minimumCreditScore', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Borrowers must have at least this credit score
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allowedIndustries">Allowed Industries (optional)</Label>
                  <Textarea
                    id="allowedIndustries"
                    placeholder="E.g., Technology, Healthcare, Retail (comma-separated)"
                    rows={3}
                    value={formData.allowedIndustries}
                    onChange={e => handleInputChange('allowedIndustries', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to allow all industries
                  </p>
                </div>
              </div>
            )}

            {/* Step 5: Smart Contract */}
            {currentStep === 5 && (
              <div className="space-y-6">
                {/* Deployment Status */}
                {deploymentResult ? (
                  <div className="space-y-4 p-4 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <p className="text-sm font-medium text-green-900">Pool Deployed Successfully!</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-green-700">Contract Pool ID:</span>
                        <code className="text-xs bg-green-100 px-2 py-1 rounded font-mono">
                          {deploymentResult.contractPoolId.slice(0, 10)}...{deploymentResult.contractPoolId.slice(-8)}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-green-700">Transaction:</span>
                        <a
                          href={`https://sepolia.arbiscan.io/tx/${deploymentResult.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-green-600 hover:underline"
                        >
                          View on Arbiscan
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-green-700">Block:</span>
                        <span className="font-mono">{deploymentResult.blockNumber}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Pre-deployment info */}
                    <div className="space-y-4 p-4 border rounded-lg bg-blue-50 border-blue-200">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-blue-600" />
                        <p className="text-sm font-medium text-blue-900">Deploy to Arbitrum Sepolia</p>
                      </div>
                      <p className="text-sm text-blue-800">
                        This will create a new pool in the StakingPool smart contract. The pool will be
                        immediately available for investors to stake in.
                      </p>
                      <div className="text-sm text-blue-700 space-y-1">
                        <p><strong>Network:</strong> Arbitrum Sepolia (Testnet)</p>
                        <p><strong>Contract:</strong> StakingPool</p>
                        <p><strong>Minimum Stake:</strong> {formData.minimumStake} USDC</p>
                        <p><strong>Management Fee:</strong> {formData.managementFee}%</p>
                      </div>
                    </div>

                    {/* Deploy Button */}
                    <div className="flex flex-col items-center gap-4 py-4">
                      <Button
                        size="lg"
                        onClick={handleDeploy}
                        disabled={isDeploying || isSubmitting}
                        className="gap-2 px-8"
                      >
                        {isDeploying ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Deploying to Blockchain...
                          </>
                        ) : isSubmitting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Saving Pool...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-5 w-5" />
                            Deploy Pool to Blockchain
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center max-w-md">
                        {savedPoolId
                          ? 'Your pool configuration has been saved. Click above to deploy it to the blockchain.'
                          : 'This will save your pool configuration and deploy it to the blockchain in one step.'}
                      </p>
                    </div>

                    {/* Skip deployment option */}
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">
                        Or save without deploying (you can deploy later from the pool management page):
                      </p>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const poolId = await handleSavePool();
                          if (poolId) {
                            setCurrentStep(6);
                          }
                        }}
                        disabled={isSubmitting || isDeploying || !!savedPoolId}
                      >
                        {savedPoolId ? 'Pool Saved' : 'Save as Draft'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 6: Review & Launch */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Review Pool Configuration</h3>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <p className="text-muted-foreground">Pool Name</p>
                      <p className="font-medium">{formData.name || 'Not set'}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium">
                        {POOL_TYPES.find(t => t.value === formData.type)?.label || 'Not set'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">Target Size</p>
                      <p className="font-medium">
                        {formData.targetSize ? parseInt(formData.targetSize).toLocaleString() : 'Not set'} USDC
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">Minimum Stake</p>
                      <p className="font-medium">
                        {formData.minimumStake ? parseInt(formData.minimumStake).toLocaleString() : 'Not set'} USDC
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">Management Fee</p>
                      <p className="font-medium">{formData.managementFee}%</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">Performance Fee</p>
                      <p className="font-medium">{formData.performanceFee}%</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">Expected APY Range</p>
                      <p className="font-medium">
                        {(parseFloat(formData.baseInterestRate) + parseFloat(formData.riskPremiumMin)).toFixed(1)}% -{' '}
                        {(parseFloat(formData.baseInterestRate) + parseFloat(formData.riskPremiumMax)).toFixed(1)}%
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">Max LTV</p>
                      <p className="font-medium">{formData.maxLoanToValue}%</p>
                    </div>
                  </div>

                  {/* Deployment Status in Review */}
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-muted-foreground text-sm">Blockchain Status</p>
                    {deploymentResult ? (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-700">Deployed to Arbitrum Sepolia</span>
                        <a
                          href={`https://sepolia.arbiscan.io/tx/${deploymentResult.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          View Tx <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : savedPoolId ? (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-yellow-700">Saved as Draft (Not deployed)</span>
                      </div>
                    ) : (
                      <p className="font-medium text-muted-foreground">Not yet saved</p>
                    )}
                  </div>
                </div>

                {deploymentResult ? (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-medium text-green-900">✓ Pool Deployed Successfully</p>
                    <p className="text-sm text-green-800 mt-1">
                      Your pool is now live on Arbitrum Sepolia. Investors can start staking immediately.
                      Click "View Pool" to go to the management page.
                    </p>
                  </div>
                ) : savedPoolId ? (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm font-medium text-yellow-900">Pool Saved as Draft</p>
                    <p className="text-sm text-yellow-800 mt-1">
                      Your pool has been saved but is not yet deployed to the blockchain.
                      You can deploy it later from the pool management page.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-900">Ready to Save</p>
                    <p className="text-sm text-blue-800 mt-1">
                      Click "Save Pool" to save your configuration. You can deploy to the blockchain later.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 1 || isSubmitting}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Step {currentStep} of {STEPS.length}
          </div>

          {currentStep < STEPS.length ? (
            <Button onClick={nextStep} disabled={isSubmitting}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Create Pool
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
