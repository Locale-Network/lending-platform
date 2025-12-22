'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Users,
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import LoadingDots from '@/components/ui/loading-dots';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  ADDITIONAL_INFO_NEEDED: 'bg-orange-100 text-orange-800',
  APPROVED: 'bg-green-100 text-green-800',
  DISBURSED: 'bg-emerald-100 text-emerald-800',
  ACTIVE: 'bg-teal-100 text-teal-800',
  REPAID: 'bg-purple-100 text-purple-800',
  REJECTED: 'bg-red-100 text-red-800',
  DEFAULTED: 'bg-red-200 text-red-900',
};

const kycStatusColors: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  active: 'bg-blue-100 text-blue-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
  canceled: 'bg-gray-100 text-gray-800',
  not_started: 'bg-gray-100 text-gray-600',
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'APPROVED':
    case 'DISBURSED':
    case 'ACTIVE':
    case 'REPAID':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'REJECTED':
    case 'DEFAULTED':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'PENDING':
    case 'SUBMITTED':
    case 'ADDITIONAL_INFO_NEEDED':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
  }
};

export default function BorrowersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedBorrower, setExpandedBorrower] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR('/api/admin/borrowers', fetcher);

  const borrowers = data?.borrowers || [];
  const summary = data?.summary || {
    totalBorrowers: 0,
    totalActiveLoans: 0,
    totalPendingLoans: 0,
    totalBorrowed: 0,
    verifiedCount: 0,
  };

  // Filter borrowers
  const filteredBorrowers = borrowers.filter((borrower: any) => {
    const matchesSearch =
      borrower.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrower.shortAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrower.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrower.loanApplications.some((loan: any) =>
        loan.businessName?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesStatus =
      statusFilter === 'all' ||
      borrower.loanApplications.some((loan: any) => loan.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingDots size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load borrower data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Borrower Management</h1>
        <p className="text-muted-foreground mt-2">View and manage all borrowers and their loan applications</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Borrowers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalBorrowers}</div>
            <p className="text-xs text-muted-foreground">{summary.verifiedCount} verified</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalActiveLoans}</div>
            <p className="text-xs text-muted-foreground">Currently disbursed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Loans</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalPendingLoans}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Borrowed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalBorrowed.toLocaleString()} USDC</div>
            <p className="text-xs text-muted-foreground">Across all loans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {borrowers.reduce((sum: number, b: any) => sum + b.totalLoans, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total submitted</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by address, email, or business name..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="DISBURSED">Disbursed</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="REPAID">Repaid</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Borrowers List */}
      <Card>
        <CardHeader>
          <CardTitle>All Borrowers</CardTitle>
          <CardDescription>
            Showing {filteredBorrowers.length} of {summary.totalBorrowers} borrowers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredBorrowers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {borrowers.length === 0 ? 'No borrowers yet' : 'No borrowers match your filters'}
              </p>
            ) : (
              filteredBorrowers.map((borrower: any) => (
                <div
                  key={borrower.id}
                  className="border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
                >
                  {/* Borrower Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50"
                    onClick={() =>
                      setExpandedBorrower(expandedBorrower === borrower.id ? null : borrower.id)
                    }
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <p className="font-mono font-semibold">{borrower.shortAddress}</p>
                        <Badge className={kycStatusColors[borrower.kycStatus]}>
                          KYC: {borrower.kycStatus.replace('_', ' ')}
                        </Badge>
                        {borrower.email && (
                          <span className="text-sm text-muted-foreground">{borrower.email}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Loans</p>
                          <p className="font-semibold">{borrower.totalLoans}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Active</p>
                          <p className="font-semibold text-green-600">{borrower.activeLoans}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pending</p>
                          <p className="font-semibold text-yellow-600">{borrower.pendingLoans}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Borrowed</p>
                          <p className="font-semibold">{borrower.totalBorrowed.toLocaleString()} USDC</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" asChild onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`https://arbiscan.io/address/${borrower.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      {expandedBorrower === borrower.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Applications - Filter out DRAFT status */}
                  {expandedBorrower === borrower.id && (
                    <div className="border-t bg-muted/30 p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Applications
                      </h4>
                      {borrower.loanApplications.filter((loan: any) => loan.status !== 'DRAFT').length === 0 ? (
                        <p className="text-sm text-muted-foreground">No submitted applications</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="py-2 px-3 text-left font-medium text-muted-foreground">Application ID</th>
                                <th className="py-2 px-3 text-left font-medium text-muted-foreground">Status</th>
                                <th className="py-2 px-3 text-left font-medium text-muted-foreground">Application Date</th>
                                <th className="py-2 px-3 text-left font-medium text-muted-foreground">Updated Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {borrower.loanApplications
                                .filter((loan: any) => loan.status !== 'DRAFT')
                                .map((loan: any) => (
                                  <tr
                                    key={loan.id}
                                    className="border-b last:border-0 hover:bg-accent/50 transition-colors"
                                  >
                                    <td className="py-2 px-3">
                                      <Link
                                        href={`/admin/loans/${loan.id}`}
                                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                      >
                                        {loan.id.slice(0, 8)}...
                                      </Link>
                                    </td>
                                    <td className="py-2 px-3">
                                      <Badge className={statusColors[loan.status]}>{loan.status}</Badge>
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground">
                                      {new Date(loan.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground">
                                      {new Date(loan.updatedAt).toLocaleDateString()}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
