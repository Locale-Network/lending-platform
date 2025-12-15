'use client';

import { Suspense, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { User, Bell, Wallet, Check, Copy, ExternalLink, Download, Pencil, X, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { updateEmailAction, getAccountEmailAction } from '@/app/actions/account';
import { getInvestorVerificationStatusAction } from '@/app/actions/settings';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and settings</p>
      </div>

      <div className="grid gap-6">
        <Suspense fallback={<SettingsSkeleton />}>
          <AccountSettings />
        </Suspense>

        <Suspense fallback={<SettingsSkeleton />}>
          <InvestorVerificationSettings />
        </Suspense>

        <Suspense fallback={<SettingsSkeleton />}>
          <NotificationSettings />
        </Suspense>

        <Suspense fallback={<SettingsSkeleton />}>
          <WalletSettings />
        </Suspense>
      </div>
    </div>
  );
}

function AccountSettings() {
  const { address, email, isConnected } = useWalletAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Email change flow states
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [dbEmail, setDbEmail] = useState<string | null>(null);
  const [isLoadingDbEmail, setIsLoadingDbEmail] = useState(true);
  const [isSavingDbEmail, setIsSavingDbEmail] = useState(false);

  // Load email from database
  useEffect(() => {
    async function loadDbEmail() {
      if (address) {
        setIsLoadingDbEmail(true);
        const fetchedEmail = await getAccountEmailAction();
        setDbEmail(fetchedEmail);
        setIsLoadingDbEmail(false);
      } else {
        setIsLoadingDbEmail(false);
      }
    }
    loadDbEmail();
  }, [address]);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Wallet address copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Save email directly to database
  const handleSaveDbEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingDbEmail(true);
    const result = await updateEmailAction(newEmail);
    setIsSavingDbEmail(false);

    if (result.success) {
      setDbEmail(result.email ?? null);
      setIsEditingEmail(false);
      setNewEmail('');
      toast({
        title: 'Success',
        description: result.message,
      });
    } else {
      toast({
        title: 'Error',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  const handleCancelEdit = () => {
    setNewEmail('');
    setIsEditingEmail(false);
  };

  // Current email - from Privy or DB
  const currentEmail = email || dbEmail;

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Account Information</CardTitle>
          </div>
          <CardDescription>Please connect your wallet to view account details</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No wallet connected
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5" />
          <CardTitle>Account Information</CardTitle>
        </div>
        <CardDescription>View and manage your account details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          {isLoadingDbEmail ? (
            <div className="flex items-center gap-2 h-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : isEditingEmail ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter your email address"
                  disabled={isSavingDbEmail}
                />
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleSaveDbEmail}
                  disabled={isSavingDbEmail || !newEmail}
                >
                  {isSavingDbEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCancelEdit}
                  disabled={isSavingDbEmail}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your email for notifications.
              </p>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                value={currentEmail || 'Not provided'}
                disabled
                className="bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsEditingEmail(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
          {!isEditingEmail && !isLoadingDbEmail && (
            <p className="text-xs text-muted-foreground">
              {currentEmail
                ? 'Email saved for notifications.'
                : 'Add an email to receive notifications.'}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="wallet">Wallet Address</Label>
          <div className="flex gap-2">
            <Input
              id="wallet"
              value={address || ''}
              disabled
              className="bg-muted font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={copyAddress}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              asChild
            >
              <a
                href={`https://sepolia.arbiscan.io/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="provider">Authentication Provider</Label>
          <Input
            id="provider"
            value="Privy"
            disabled
            className="bg-muted"
          />
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium">Account Status</p>
            <p className="text-xs text-muted-foreground">Your account is active and verified</p>
          </div>
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
            Active
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function InvestorVerificationSettings() {
  const { address, isConnected } = useWalletAuth();
  const { toast } = useToast();
  const [verificationStatus, setVerificationStatus] = useState<{
    isVerified: boolean;
    tokenId: string | null;
    kycStatus: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function loadVerificationStatus() {
      if (!address) {
        setLoading(false);
        return;
      }

      try {
        const status = await getInvestorVerificationStatusAction();
        setVerificationStatus(status);
      } catch (error) {
        console.error('Failed to load verification status:', error);
      } finally {
        setLoading(false);
      }
    }

    loadVerificationStatus();
  }, [address]);

  const handleStartVerification = async () => {
    setVerifying(true);
    try {
      const response = await fetch('/api/investor/verify', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVerificationStatus({
            isVerified: true,
            tokenId: data.tokenId,
            kycStatus: 'success',
          });
          toast({
            title: 'Verification Complete!',
            description: 'Your Investor Credential has been issued.',
          });
        } else {
          toast({
            title: 'Verification Started',
            description: data.message || 'Please complete the verification process.',
          });
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Verification Failed',
          description: error.error || 'Please try again later.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start verification. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Investor Verification</CardTitle>
          </div>
          <CardDescription>Please connect your wallet to view verification status</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No wallet connected
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Investor Verification</CardTitle>
          </div>
          <CardDescription>Loading verification status...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <CardTitle>Investor Verification</CardTitle>
        </div>
        <CardDescription>
          Verify your identity to receive your Investor Credential (SBT)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verificationStatus?.isVerified ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-green-900">Verified Investor</h4>
                <p className="text-sm text-green-700 mt-1">
                  Your Investor Credential has been issued. You can now stake in all available pools.
                </p>
                {verificationStatus.tokenId && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Token ID: {verificationStatus.tokenId}
                    </Badge>
                    <a
                      href={`https://sepolia.arbiscan.io/token/${process.env.NEXT_PUBLIC_INVESTOR_CREDENTIAL_ADDRESS}?a=${verificationStatus.tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:underline flex items-center gap-1"
                    >
                      View on Arbiscan
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-yellow-900">Verification Required</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Complete identity verification to receive your Investor Credential.
                    This soulbound token (SBT) proves you're a verified investor.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Benefits of Verification:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Stake in all available lending pools
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Receive returns from verified borrowers
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  On-chain proof of investor status
                </li>
              </ul>
            </div>

            <Button
              onClick={handleStartVerification}
              disabled={verifying}
              className="w-full"
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Verification...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Get Verified
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Verification is quick and secure. Your data is never shared.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  const { isConnected } = useWalletAuth();

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>Please connect your wallet to manage notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No wallet connected
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
        </div>
        <CardDescription>Choose what notifications you want to receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between opacity-60">
          <div className="space-y-0.5">
            <Label htmlFor="email-notifications">Email Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications via email
            </p>
          </div>
          <Switch
            id="email-notifications"
            checked={false}
            disabled
            className="opacity-100"
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium opacity-60">Investment Notifications</p>

          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="investment-updates">Investment Updates</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about your active investments
              </p>
            </div>
            <Switch
              id="investment-updates"
              checked={false}
              disabled
              className="opacity-100"
            />
          </div>

          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="earnings-alerts">Earnings Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Notifications when you earn interest
              </p>
            </div>
            <Switch
              id="earnings-alerts"
              checked={false}
              disabled
              className="opacity-100"
            />
          </div>

          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="pool-updates">Pool Updates</Label>
              <p className="text-sm text-muted-foreground">
                Updates about new pools and pool changes
              </p>
            </div>
            <Switch
              id="pool-updates"
              checked={false}
              disabled
              className="opacity-100"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium opacity-60">Other Notifications</p>

          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="marketing">Marketing Emails</Label>
              <p className="text-sm text-muted-foreground">
                Promotional content and special offers
              </p>
            </div>
            <Switch
              id="marketing"
              checked={false}
              disabled
              className="opacity-100"
            />
          </div>

          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="security-alerts">Security Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Important security and account notifications
              </p>
            </div>
            <Switch
              id="security-alerts"
              checked={false}
              disabled
              className="opacity-100"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button disabled className="opacity-60">
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function WalletSettings() {
  const { address, isConnected, logout } = useWalletAuth();
  const { toast } = useToast();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await logout();
      toast({
        title: 'Disconnected',
        description: 'Your wallet has been disconnected',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect wallet',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Wallet address copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            <CardTitle>Wallet Settings</CardTitle>
          </div>
          <CardDescription>Please connect your wallet to view settings</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No wallet connected
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          <CardTitle>Wallet Settings</CardTitle>
        </div>
        <CardDescription>Manage your connected wallet</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet Address Section */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Connected Wallet</Label>
          <p className="text-sm text-muted-foreground">
            Your wallet address for all on-chain interactions.
          </p>
          <div className="rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1 mr-4">
                <p className="font-mono text-sm break-all">{address}</p>
                <p className="text-xs text-muted-foreground">
                  Arbitrum Sepolia
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyAddress}
                  disabled={!address}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                >
                  <a
                    href={`https://sepolia.arbiscan.io/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Quick Actions</p>
            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
          </div>

          <div className="grid gap-2 opacity-50">
            <Button
              variant="outline"
              className="justify-start"
              disabled
            >
              <Download className="mr-2 h-4 w-4" />
              Export Transaction History
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              disabled
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View All Transactions
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Disconnect Wallet</p>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Sign out and disconnect your wallet from this session
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900"
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
