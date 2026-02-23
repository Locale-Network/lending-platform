'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Search, Loader2, UserCheck, AlertCircle } from 'lucide-react';

type InvestorInfo = {
  address: string;
  status: number;
  statusLabel: string;
  hasInvested: boolean;
  canInvest: boolean;
  reason: string;
};

type RegistryStats = {
  nonAccreditedCount: number;
  maxNonAccredited: number;
};

const STATUS_OPTIONS = [
  { value: 1, label: 'Accredited', description: 'No limit on count' },
  { value: 2, label: 'Non-Accredited', description: 'Counts toward 35 cap' },
  { value: 0, label: 'Ineligible', description: 'Cannot invest' },
];

function statusBadge(status: number, label: string) {
  switch (status) {
    case 1:
      return <Badge className="bg-green-100 text-green-800">{label}</Badge>;
    case 2:
      return <Badge className="bg-yellow-100 text-yellow-800">{label}</Badge>;
    default:
      return <Badge variant="secondary">{label}</Badge>;
  }
}

export default function InvestorEligibilityPage() {
  const { toast } = useToast();

  // Stats
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Set status form
  const [setAddress, setSetAddress] = useState('');
  const [setStatus, setSetStatus] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  // Check status form
  const [checkAddress, setCheckAddress] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkedInvestor, setCheckedInvestor] = useState<InvestorInfo | null>(null);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/investor-eligibility');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load registry stats', variant: 'destructive' });
    } finally {
      setStatsLoading(false);
    }
  };

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const handleSetStatus = async () => {
    if (!setAddress.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/investor-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: setAddress.trim(), status: setStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Status Updated',
          description: `Set ${setAddress.slice(0, 6)}...${setAddress.slice(-4)} to ${data.statusLabel}. Tx: ${data.txHash?.slice(0, 10)}...`,
        });
        setSetAddress('');
        await loadStats();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!checkAddress.trim()) return;
    setChecking(true);
    setCheckedInvestor(null);
    try {
      const res = await fetch(
        `/api/admin/investor-eligibility?addresses=${checkAddress.trim()}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.investors.length > 0) {
          setCheckedInvestor(data.investors[0]);
          setStats(data.stats);
        } else {
          toast({ title: 'Not Found', description: 'No data for this address', variant: 'destructive' });
        }
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Investor Eligibility</h1>
        <p className="text-muted-foreground">
          Manage investor whitelist for Reg D 506(b) compliance
        </p>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle className="text-lg">Registry Stats</CardTitle>
          </div>
          <CardDescription>Non-accredited investor count vs. regulatory limit</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading || !stats ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{stats.nonAccreditedCount}</div>
                <div className="text-xs text-muted-foreground">Non-Accredited</div>
              </div>
              <div className="text-2xl text-muted-foreground">/</div>
              <div className="text-center">
                <div className="text-3xl font-bold">{stats.maxNonAccredited}</div>
                <div className="text-xs text-muted-foreground">Max Allowed</div>
              </div>
              <div className="ml-4">
                {stats.nonAccreditedCount >= stats.maxNonAccredited ? (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Limit Reached
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800">
                    {stats.maxNonAccredited - stats.nonAccreditedCount} slots remaining
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Set Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            <CardTitle className="text-lg">Set Investor Status</CardTitle>
          </div>
          <CardDescription>
            Whitelist an investor address as Accredited or Non-Accredited (on-chain transaction)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Wallet Address</label>
              <input
                type="text"
                placeholder="0x..."
                value={setAddress}
                onChange={(e) => setSetAddress(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select
                value={setStatus}
                onChange={(e) => setSetStatus(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} - {opt.description}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleSetStatus}
              disabled={!setAddress.trim() || submitting}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting Transaction...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Set Status
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Check Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <CardTitle className="text-lg">Check Investor Status</CardTitle>
          </div>
          <CardDescription>Look up the current on-chain eligibility for an address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="0x..."
                value={checkAddress}
                onChange={(e) => setCheckAddress(e.target.value)}
                className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              <Button onClick={handleCheckStatus} disabled={!checkAddress.trim() || checking}>
                {checking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Check
                  </>
                )}
              </Button>
            </div>

            {checkedInvestor && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-muted-foreground">
                    {checkedInvestor.address.slice(0, 6)}...{checkedInvestor.address.slice(-4)}
                  </span>
                  {statusBadge(checkedInvestor.status, checkedInvestor.statusLabel)}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Can Invest:</span>{' '}
                    {checkedInvestor.canInvest ? (
                      <Badge className="bg-green-100 text-green-800">Yes</Badge>
                    ) : (
                      <Badge variant="destructive">No</Badge>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Has Invested:</span>{' '}
                    {checkedInvestor.hasInvested ? (
                      <Badge className="bg-blue-100 text-blue-800">Yes</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </div>
                </div>
                {checkedInvestor.reason && (
                  <div className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {checkedInvestor.reason}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
