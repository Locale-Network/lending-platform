'use client';

import { Suspense, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { User, Bell, Shield, Mail, Wallet, Check, Copy, ExternalLink, Download } from 'lucide-react';
import { useUser, useLogout } from '@account-kit/react';

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
          <NotificationSettings />
        </Suspense>

        <Suspense fallback={<SettingsSkeleton />}>
          <SecuritySettings />
        </Suspense>

        <Suspense fallback={<SettingsSkeleton />}>
          <WalletSettings />
        </Suspense>
      </div>
    </div>
  );
}

function AccountSettings() {
  const user = useUser();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (user?.address) {
      navigator.clipboard.writeText(user.address);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Wallet address copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!user) {
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

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
          <Input
            id="email"
            type="email"
            value={user.email || 'Not provided'}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Email cannot be changed. Contact support if you need assistance.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wallet">Wallet Address</Label>
          <div className="flex gap-2">
            <Input
              id="wallet"
              value={user.address || ''}
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
                href={`https://arbiscan.io/address/${user.address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="provider">Account Type</Label>
            <Input
              id="provider"
              value={user.email ? 'Embedded Wallet' : 'External Wallet'}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="orgId">Organization ID</Label>
            <Input
              id="orgId"
              value={user.orgId || 'N/A'}
              disabled
              className="bg-muted font-mono text-xs"
            />
          </div>
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

function NotificationSettings() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    investmentUpdates: true,
    earningsAlerts: true,
    poolUpdates: false,
    marketingEmails: false,
    securityAlerts: true,
  });
  const [saving, setSaving] = useState(false);

  const updateNotification = (key: keyof typeof notifications, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const savePreferences = async () => {
    setSaving(true);
    // TODO: Save to database
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    setSaving(false);
    toast({
      title: 'Saved!',
      description: 'Your notification preferences have been updated',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>Notification Preferences</CardTitle>
        </div>
        <CardDescription>Choose what notifications you want to receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email-notifications">Email Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications via email
            </p>
          </div>
          <Switch
            id="email-notifications"
            checked={notifications.emailNotifications}
            onCheckedChange={(checked) => updateNotification('emailNotifications', checked)}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium">Investment Notifications</p>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="investment-updates">Investment Updates</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about your active investments
              </p>
            </div>
            <Switch
              id="investment-updates"
              checked={notifications.investmentUpdates}
              onCheckedChange={(checked) => updateNotification('investmentUpdates', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="earnings-alerts">Earnings Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Notifications when you earn interest
              </p>
            </div>
            <Switch
              id="earnings-alerts"
              checked={notifications.earningsAlerts}
              onCheckedChange={(checked) => updateNotification('earningsAlerts', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pool-updates">Pool Updates</Label>
              <p className="text-sm text-muted-foreground">
                Updates about new pools and pool changes
              </p>
            </div>
            <Switch
              id="pool-updates"
              checked={notifications.poolUpdates}
              onCheckedChange={(checked) => updateNotification('poolUpdates', checked)}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium">Other Notifications</p>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing">Marketing Emails</Label>
              <p className="text-sm text-muted-foreground">
                Promotional content and special offers
              </p>
            </div>
            <Switch
              id="marketing"
              checked={notifications.marketingEmails}
              onCheckedChange={(checked) => updateNotification('marketingEmails', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="security-alerts">Security Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Important security and account notifications (always enabled)
              </p>
            </div>
            <Switch
              id="security-alerts"
              checked={notifications.securityAlerts}
              disabled
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={savePreferences} disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SecuritySettings() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <CardTitle>Security Settings</CardTitle>
        </div>
        <CardDescription>Manage your account security and authentication</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <Button variant="outline">Enable 2FA</Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Connected Devices</p>
              <p className="text-sm text-muted-foreground">
                View and manage devices that have access to your account
              </p>
            </div>
            <Button variant="outline">Manage Devices</Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Login History</p>
              <p className="text-sm text-muted-foreground">
                Review recent login activity on your account
              </p>
            </div>
            <Button variant="outline">View History</Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium text-destructive">Danger Zone</p>

          <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Close Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Close Account
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WalletSettings() {
  const user = useUser();
  const { logout } = useLogout();
  const { toast } = useToast();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

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

  const exportTransactions = async () => {
    toast({
      title: 'Coming Soon',
      description: 'Transaction export will be available soon',
    });
  };

  if (!user) {
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
        <CardDescription>Manage your connected wallet and assets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Connected Wallet</Label>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1 flex-1 mr-4">
                <p className="font-mono text-sm break-all">{user.address}</p>
                <p className="text-xs text-muted-foreground">
                  Arbitrum Network
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Wallet balances are displayed on the blockchain and updated in real-time from Alchemy.
            </p>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={`https://arbiscan.io/address/${user.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center"
              >
                View on Arbiscan
                <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium">Quick Actions</p>

          <div className="grid gap-2">
            <Button
              variant="outline"
              className="justify-start"
              onClick={exportTransactions}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Transaction History
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              asChild
            >
              <a
                href="/explore/transactions"
                className="inline-flex items-center"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View All Transactions
              </a>
            </Button>
          </div>
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
