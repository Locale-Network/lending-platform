'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  TrendingUp,
  Users,
  DollarSign,
  Award,
  Mail,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const tierColors = {
  platinum: 'bg-purple-100 text-purple-800',
  gold: 'bg-yellow-100 text-yellow-800',
  silver: 'bg-gray-100 text-gray-800',
  bronze: 'bg-orange-100 text-orange-800',
};

export default function InvestorsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, error, isLoading } = useSWR('/api/admin/investors', fetcher);

  const investors = data?.investors || [];
  const summary = data?.summary || {
    totalInvestors: 0,
    totalInvested: 0,
    totalReturns: 0,
    avgInvestment: 0,
    verifiedCount: 0,
  };

  // Filter investors based on search
  const filteredInvestors = investors.filter(
    (investor: any) =>
      investor.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      investor.shortAddress.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load investor data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Investor Management</h1>
        <p className="text-muted-foreground mt-2">Monitor and manage platform investors</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Investors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalInvestors}</div>
            <p className="text-xs text-muted-foreground">
              {summary.verifiedCount} verified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalInvested.toLocaleString()} USDC</div>
            <p className="text-xs text-muted-foreground">Across all pools</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalReturns.toLocaleString()} USDC</div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Investment</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(summary.avgInvestment).toLocaleString()} USDC</div>
            <p className="text-xs text-muted-foreground">Per investor</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by address..."
              className="pl-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Investors List */}
      <Card>
        <CardHeader>
          <CardTitle>All Investors</CardTitle>
          <CardDescription>
            Showing {filteredInvestors.length} of {summary.totalInvestors} investors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInvestors.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {investors.length === 0 ? 'No investors yet' : 'No investors match your search'}
              </p>
            ) : (
            filteredInvestors.map((investor: any) => (
              <div
                key={investor.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <p className="font-mono font-semibold">{investor.shortAddress}</p>
                    <Badge className={tierColors[investor.tier as keyof typeof tierColors]}>
                      {investor.tier.toUpperCase()}
                    </Badge>
                    {investor.verified && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Verified
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Invested</p>
                      <p className="font-semibold">{investor.totalInvested.toLocaleString()} USDC</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Active Investments</p>
                      <p className="font-semibold">{investor.activeInvestments}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Returns</p>
                      <p className="font-semibold text-green-600">
                        {investor.totalReturns.toLocaleString()} USDC
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg APY</p>
                      <p className="font-semibold">{investor.avgAPY}%</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(investor.joinedDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="ghost" size="icon">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
