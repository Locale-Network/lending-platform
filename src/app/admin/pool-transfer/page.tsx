'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowRight,
  Loader2,
  Wallet,
  Building2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ArrowDownUp,
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { getExplorerUrl } from '@/lib/explorer';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function PoolTransferPage() {
  const [amount, setAmount] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; txHash?: string } | null>(null);

  const { data, error, isLoading } = useSWR('/api/admin/pool-transfer', fetcher, {
    refreshInterval: 15000,
  });

  const balances = data?.balances;
  const recentTransfers = data?.recentTransfers || [];

  async function handleTransfer() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setResult({ success: false, message: 'Please enter a valid amount' });
      return;
    }

    const amountInSmallestUnit = BigInt(Math.round(Number(amount) * 1e6)).toString();

    setTransferring(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/pool-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountInSmallestUnit }),
      });

      const data = await res.json();

      if (data.success) {
        setResult({
          success: true,
          message: `Transferred ${amount} lUSD to Loan Pool`,
          txHash: data.transfer?.txHash,
        });
        setAmount('');
        mutate('/api/admin/pool-transfer');
      } else {
        setResult({ success: false, message: data.error || 'Transfer failed' });
      }
    } catch (err) {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pool Fund Transfer</h1>
        <p className="text-muted-foreground mt-2">
          Transfer funds between StakingPool and Loan Pool for loan disbursements
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staking Pool</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : error ? (
              <p className="text-sm text-destructive">Failed to load</p>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {Number(balances?.stakingPoolBalance || 0).toLocaleString()} lUSD
                </div>
                <p className="text-xs text-muted-foreground mt-1">Available for transfer</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="flex items-center justify-center">
          <ArrowRight className="h-8 w-8 text-muted-foreground" />
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loan Pool</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : error ? (
              <p className="text-sm text-destructive">Failed to load</p>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {Number(balances?.simpleLoanPoolBalance || 0).toLocaleString()} lUSD
                </div>
                <p className="text-xs text-muted-foreground mt-1">Available for disbursement</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Total Transferred */}
      {balances && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4" />
          Total transferred to Loan Pool: {Number(balances.totalTransferred || 0).toLocaleString()} lUSD
        </div>
      )}

      {/* Transfer Form */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Funds</CardTitle>
          <CardDescription>
            Move funds from the Staking Pool to the Loan Pool for loan disbursements.
            The server-side admin key executes the on-chain transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="amount" className="text-sm font-medium mb-2 block">
                Amount (lUSD)
              </label>
              <Input
                id="amount"
                type="number"
                placeholder="e.g. 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                disabled={transferring}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleTransfer}
                disabled={transferring || !amount}
                className="gap-2"
              >
                {transferring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Transfer
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick amount buttons */}
          <div className="flex gap-2">
            {[1000, 5000, 10000, 25000].map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                onClick={() => setAmount(preset.toString())}
                disabled={transferring}
              >
                {preset.toLocaleString()}
              </Button>
            ))}
            {balances && Number(balances.stakingPoolBalance) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAmount(balances.stakingPoolBalance)}
                disabled={transferring}
              >
                Max ({Number(balances.stakingPoolBalance).toLocaleString()})
              </Button>
            )}
          </div>

          {/* Result Message */}
          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.message}
                {result.txHash && (
                  <a
                    href={getExplorerUrl('tx', result.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    View tx
                  </a>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recent Transfers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Transfers</CardTitle>
              <CardDescription>History of fund transfers between pools</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate('/api/admin/pool-transfer')}
              className="gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransfers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transfers yet</p>
          ) : (
            <div className="space-y-3">
              {recentTransfers.map((transfer: any) => (
                <div
                  key={transfer.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">
                        {transfer.fromPool} → {transfer.toPool}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          transfer.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {transfer.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transfer.createdAt).toLocaleString()}
                      {transfer.transactionHash && (
                        <a
                          href={getExplorerUrl('tx', transfer.transactionHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-600 hover:underline"
                        >
                          {transfer.transactionHash.slice(0, 10)}...
                        </a>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {(Number(transfer.amount) / 1e6).toLocaleString()} lUSD
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
