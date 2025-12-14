'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function PortfolioQuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Manage your investments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link href="/explore/pools">
          <Button className="w-full justify-between" size="lg">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Invest in New Pool</span>
            </div>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
