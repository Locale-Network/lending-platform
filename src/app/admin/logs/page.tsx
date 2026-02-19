'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import LoadingDots from '@/components/ui/loading-dots';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Action badge colors - neutral styling
const actionColors: Record<string, string> = {
  sync: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  verify: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  submit: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  relay: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

// Status badge component - neutral styling
const StatusBadge = ({ success }: { success: boolean }) => (
  <Badge
    className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  >
    {success ? (
      <CheckCircle className="h-3 w-3 mr-1" />
    ) : (
      <XCircle className="h-3 w-3 mr-1" />
    )}
    {success ? 'Success' : 'Failed'}
  </Badge>
);

// Format timestamp
const formatTime = (date: string) => {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Truncate hash for display
const truncateHash = (hash: string | null, length = 8) => {
  if (!hash) return '—';
  return `${hash.slice(0, length)}...${hash.slice(-4)}`;
};

export default function ZkFetchLogsPage() {
  const [activeTab, setActiveTab] = useState('logs');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProof, setSelectedProof] = useState<Record<string, unknown> | null>(null);
  const { toast } = useToast();

  // Fetch stats
  const { data: statsData } = useSWR('/api/admin/zkfetch-logs?view=stats', fetcher, {
    refreshInterval: 30000, // Refresh every 30s
  });

  // Build logs URL with filters
  const logsUrl = `/api/admin/zkfetch-logs?view=logs&page=${page}&limit=25${
    actionFilter !== 'all' ? `&action=${actionFilter}` : ''
  }${statusFilter !== 'all' ? `&success=${statusFilter}` : ''}`;

  // Fetch logs
  const { data: logsData, isLoading: logsLoading, mutate: mutateLogs } = useSWR(
    activeTab === 'logs' ? logsUrl : null,
    fetcher
  );

  // Fetch proofs
  const proofsUrl = `/api/admin/zkfetch-logs?view=proofs&page=${page}&limit=25`;
  const { data: proofsData, isLoading: proofsLoading } = useSWR(
    activeTab === 'proofs' ? proofsUrl : null,
    fetcher
  );

  const stats = statsData?.stats;
  const logs = logsData?.logs || [];
  const proofs = proofsData?.proofs || [];
  const pagination = activeTab === 'logs' ? logsData?.pagination : proofsData?.pagination;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard', description: text.slice(0, 50) + '...' });
  };

  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            zkFetch Logs
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor zero-knowledge proof generation and verification operations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutateLogs()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Operations
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalLogs.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.last24Hours} in last 24h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Proofs Stored
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalProofs.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                For audit trail
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.successRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.successfulOps} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Failed Ops
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.failedOps}
              </div>
              <p className="text-xs text-muted-foreground">
                Needs attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Last 7 Days
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.last7Days}
              </div>
              <p className="text-xs text-muted-foreground">
                Operations
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Breakdown */}
      {stats?.actionBreakdown && Object.keys(stats.actionBreakdown).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Operations by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(stats.actionBreakdown).map(([action, count]) => (
                <div
                  key={action}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50"
                >
                  <Badge className={actionColors[action] || 'bg-gray-100 text-gray-800'}>
                    {action}
                  </Badge>
                  <span className="font-semibold">{(count as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
        <div className="flex items-center justify-between">
          <TabsList className="grid w-[400px] grid-cols-2">
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="h-4 w-4" />
              Operation Logs
            </TabsTrigger>
            <TabsTrigger value="proofs" className="gap-2">
              <Shield className="h-4 w-4" />
              Stored Proofs
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-6 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by loan ID or address..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="sync">Sync</SelectItem>
                    <SelectItem value="verify">Verify</SelectItem>
                    <SelectItem value="submit">Submit</SelectItem>
                    <SelectItem value="relay">Relay</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="true">Success</SelectItem>
                    <SelectItem value="false">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Operation Logs</CardTitle>
              <CardDescription>
                {pagination
                  ? `Showing ${(page - 1) * 25 + 1}-${Math.min(page * 25, pagination.total)} of ${pagination.total} logs`
                  : 'Loading...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingDots size="md" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No logs found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">Time</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">Action</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">Status</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">Loan</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">Proof Hash</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">Duration</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log: Record<string, unknown>) => (
                        <tr
                          key={log.id as string}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                            {formatTime(log.createdAt as string)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={actionColors[log.action as string] || 'bg-gray-100'}>
                              {log.action as string}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge success={log.success as boolean} />
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              href={`/admin/loans/${log.loanId}`}
                              className="text-primary hover:underline font-mono text-xs"
                            >
                              {truncateHash(log.loanId as string, 8)}
                            </Link>
                            {(log.loan as { businessLegalName?: string })?.businessLegalName && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {(log.loan as { businessLegalName: string }).businessLegalName}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {log.proofHash ? (
                              <div className="flex items-center gap-1">
                                <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                  {truncateHash(log.proofHash as string)}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => copyToClipboard(log.proofHash as string)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {log.durationMs ? (
                              <span className="font-mono text-xs">
                                {(log.durationMs as number).toLocaleString()}ms
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 text-xs">
                              {log.transactionCount !== null && (
                                <span>{log.transactionCount as number} txns</span>
                              )}
                              {log.dscrValue !== null && (
                                <span>DSCR: {(log.dscrValue as number).toFixed(2)}</span>
                              )}
                              {typeof log.errorMessage === 'string' && log.errorMessage && (
                                <span className="text-red-600 truncate max-w-[150px]" title={log.errorMessage}>
                                  {String(log.errorCode ?? '')}: {log.errorMessage.slice(0, 30)}...
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proofs Tab */}
        <TabsContent value="proofs" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stored Proofs</CardTitle>
              <CardDescription>
                Zero-knowledge proofs stored for audit trail and dispute resolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {proofsLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingDots size="md" />
                </div>
              ) : proofs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No proofs stored yet</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {proofs.map((proof: Record<string, unknown>) => (
                    <div
                      key={proof.id as string}
                      className="border rounded-lg p-4 hover:border-primary/50 transition-colors bg-gradient-to-r from-transparent to-muted/20"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-primary" />
                            <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                              {truncateHash(proof.proofHash as string, 12)}
                            </code>
                            {proof.verifiedAt != null && (
                              <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Loan</p>
                              <Link
                                href={`/admin/loans/${proof.loanId}`}
                                className="text-primary hover:underline font-mono text-xs"
                              >
                                {truncateHash(proof.loanId as string)}
                              </Link>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Provider</p>
                              <p className="font-medium">{proof.provider as string || 'http'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Signatures</p>
                              <p className="font-medium">{proof.signaturesCount as number || 0}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Created</p>
                              <p className="font-medium">{formatTime(proof.createdAt as string)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(proof.proofHash as string)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedProof(proof.proofData as Record<string, unknown>)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Recent Errors Alert */}
      {stats?.recentErrors && stats.recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Errors
            </CardTitle>
            <CardDescription>
              Last {stats.recentErrors.length} failed operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentErrors.slice(0, 5).map((error: Record<string, unknown>) => (
                <div
                  key={error.id as string}
                  className="flex items-start justify-between p-3 rounded-lg bg-muted/50 border"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={actionColors[error.action as string] || 'bg-gray-100'}>
                        {error.action as string}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(error.createdAt as string)}
                      </span>
                    </div>
                    <p className="text-sm">
                      <span className="font-mono">{String(error.errorCode ?? '')}</span>:{' '}
                      {String(error.errorMessage ?? '')}
                    </p>
                  </div>
                  <Link href={`/admin/loans/${error.loanId}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proof Viewer Dialog */}
      <Dialog open={!!selectedProof} onOpenChange={() => setSelectedProof(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Proof Details
            </DialogTitle>
            <DialogDescription>
              Full zero-knowledge proof data for verification and audit
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
              {JSON.stringify(selectedProof, null, 2)}
            </pre>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(JSON.stringify(selectedProof, null, 2))}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy JSON
            </Button>
            <Button variant="default" onClick={() => setSelectedProof(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
