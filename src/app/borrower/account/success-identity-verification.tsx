'use client';

import { useState, useEffect } from 'react';
import { IdentityVerificationGetResponse } from 'plaid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Bell,
  Wallet,
  Check,
  Copy,
  ExternalLink,
  Pencil,
  X,
  Loader2,
  ShieldCheck,
  CreditCard,
  Building2,
  Calendar,
} from 'lucide-react';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { updateEmailAction, getAccountEmailAction } from '@/app/actions/account';
import { getExplorerUrl } from '@/lib/explorer';

interface SuccessIdentityVerificationProps {
  accountAddress: string;
  identityVerificationData: IdentityVerificationGetResponse;
  borrowerNFTTokenId?: string | null;
  borrowerCredentialAddress?: string;
}

export default function SuccessIdentityVerification(props: SuccessIdentityVerificationProps) {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your borrower account preferences and settings</p>
      </div>

      <div className="grid gap-6">
        <VerificationStatusCard
          identityVerificationData={props.identityVerificationData}
          borrowerNFTTokenId={props.borrowerNFTTokenId}
          borrowerCredentialAddress={props.borrowerCredentialAddress}
        />
        <AccountSettings accountAddress={props.accountAddress} />
        <PaymentMethodsCard />
        <NotificationSettings />
        <WalletSettings />
      </div>
    </div>
  );
}

function VerificationStatusCard({
  identityVerificationData,
  borrowerNFTTokenId,
  borrowerCredentialAddress,
}: {
  identityVerificationData: IdentityVerificationGetResponse;
  borrowerNFTTokenId?: string | null;
  borrowerCredentialAddress?: string;
}) {
  const verifiedAt = identityVerificationData.completed_at;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <CardTitle>Identity Verification</CardTitle>
        </div>
        <CardDescription>Your identity has been verified</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-green-900">Verified Borrower</h4>
              <p className="text-sm text-green-700 mt-1">
                Your identity has been verified. You can now apply for loans and access all borrower features.
              </p>
              {verifiedAt && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                  <Calendar className="h-3 w-3" />
                  Verified on {new Date(verifiedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {borrowerNFTTokenId && borrowerCredentialAddress && (
          <>
            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Borrower Credential (SBT)</h4>
              <p className="text-sm text-muted-foreground">
                Your on-chain soulbound token proves your verified borrower status.
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Token ID: {borrowerNFTTokenId}
                </Badge>
                <a
                  href={`${getExplorerUrl('token', borrowerCredentialAddress)}?a=${borrowerNFTTokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View on Arbiscan
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AccountSettings({ accountAddress }: { accountAddress: string }) {
  const { email } = useWalletAuth();
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
      if (accountAddress) {
        setIsLoadingDbEmail(true);
        const fetchedEmail = await getAccountEmailAction();
        setDbEmail(fetchedEmail);
        setIsLoadingDbEmail(false);
      } else {
        setIsLoadingDbEmail(false);
      }
    }
    loadDbEmail();
  }, [accountAddress]);

  const copyAddress = () => {
    if (accountAddress) {
      navigator.clipboard.writeText(accountAddress);
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
            <div className="flex items-center h-10">
              <Loader2 className="h-4 w-4 animate-spin" />
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
                Enter your email for loan notifications and payment reminders.
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
                ? 'Email saved for loan notifications.'
                : 'Add an email to receive loan notifications and payment reminders.'}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="wallet">Wallet Address</Label>
          <div className="flex gap-2">
            <Input
              id="wallet"
              value={accountAddress || ''}
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
                href={getExplorerUrl('address', accountAddress)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium">Account Status</p>
            <p className="text-xs text-muted-foreground">Your borrower account is active and verified</p>
          </div>
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
            Verified Borrower
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentMethodsCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Payment Methods</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
        </div>
        <CardDescription>Manage your bank accounts for loan repayments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h4 className="text-sm font-medium mb-1">No payment methods connected</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Connect a bank account to enable automatic loan repayments
          </p>
          <Button variant="outline" disabled>
            <CreditCard className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Repayment Preferences</h4>

          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="auto-repay">Automatic Repayments</Label>
              <p className="text-sm text-muted-foreground">
                Automatically repay loans on due dates
              </p>
            </div>
            <Switch
              id="auto-repay"
              checked={false}
              disabled
            />
          </div>

          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="early-repay">Early Repayment Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about early repayment options
              </p>
            </div>
            <Switch
              id="early-repay"
              checked={false}
              disabled
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
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
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium opacity-60">Loan Notifications</p>

          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="loan-status">Loan Status Updates</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when your loan application status changes
              </p>
            </div>
            <Switch
              id="loan-status"
              checked={false}
              disabled
            />
          </div>

          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="payment-reminders">Payment Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Reminders before your payment is due
              </p>
            </div>
            <Switch
              id="payment-reminders"
              checked={false}
              disabled
            />
          </div>

          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="payment-confirmation">Payment Confirmations</Label>
              <p className="text-sm text-muted-foreground">
                Confirmation when payments are processed
              </p>
            </div>
            <Switch
              id="payment-confirmation"
              checked={false}
              disabled
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
            Your wallet address for loan disbursements and repayments.
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
                    href={getExplorerUrl('address', address)}
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
