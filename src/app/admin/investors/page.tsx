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
} from 'lucide-react';
import { useState } from 'react';

// Mock investor data
const mockInvestors = [
  {
    id: '1',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    shortAddress: '0x1234...5678',
    totalInvested: 250000,
    activeInvestments: 5,
    totalReturns: 31250,
    avgAPY: 12.5,
    joinedDate: '2024-01-15',
    tier: 'platinum',
    verified: true,
  },
  {
    id: '2',
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    shortAddress: '0xabcd...ef12',
    totalInvested: 150000,
    activeInvestments: 3,
    totalReturns: 16200,
    avgAPY: 10.8,
    joinedDate: '2024-02-20',
    tier: 'gold',
    verified: true,
  },
  {
    id: '3',
    address: '0x9876543210fedcba9876543210fedcba98765432',
    shortAddress: '0x9876...5432',
    totalInvested: 75000,
    activeInvestments: 2,
    totalReturns: 10650,
    avgAPY: 14.2,
    joinedDate: '2024-03-10',
    tier: 'silver',
    verified: false,
  },
  {
    id: '4',
    address: '0xfedcba9876543210fedcba9876543210fedcba98',
    shortAddress: '0xfedc...ba98',
    totalInvested: 500000,
    activeInvestments: 8,
    totalReturns: 55000,
    avgAPY: 11.0,
    joinedDate: '2023-12-05',
    tier: 'platinum',
    verified: true,
  },
  {
    id: '5',
    address: '0x1111222233334444555566667777888899990000',
    shortAddress: '0x1111...0000',
    totalInvested: 25000,
    activeInvestments: 1,
    totalReturns: 2375,
    avgAPY: 9.5,
    joinedDate: '2024-04-01',
    tier: 'bronze',
    verified: false,
  },
];

const tierColors = {
  platinum: 'bg-purple-100 text-purple-800',
  gold: 'bg-yellow-100 text-yellow-800',
  silver: 'bg-gray-100 text-gray-800',
  bronze: 'bg-orange-100 text-orange-800',
};

export default function InvestorsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter investors based on search
  const filteredInvestors = mockInvestors.filter(
    investor =>
      investor.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      investor.shortAddress.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate summary stats
  const totalInvestors = mockInvestors.length;
  const totalInvested = mockInvestors.reduce((sum, inv) => sum + inv.totalInvested, 0);
  const totalReturns = mockInvestors.reduce((sum, inv) => sum + inv.totalReturns, 0);
  const avgInvestment = totalInvested / totalInvestors;

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
            <div className="text-2xl font-bold">{totalInvestors}</div>
            <p className="text-xs text-muted-foreground">
              {mockInvestors.filter(i => i.verified).length} verified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalInvested.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all pools</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalReturns.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Investment</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgInvestment.toLocaleString()}</div>
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
            Showing {filteredInvestors.length} of {totalInvestors} investors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInvestors.map(investor => (
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
                      <p className="font-semibold">${investor.totalInvested.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Active Investments</p>
                      <p className="font-semibold">{investor.activeInvestments}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Returns</p>
                      <p className="font-semibold text-green-600">
                        ${investor.totalReturns.toLocaleString()}
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
