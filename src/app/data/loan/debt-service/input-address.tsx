'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function AddressInput() {
  const router = useRouter();
  const [address, setAddress] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/data/loan/debt-service?accountAddress=${address}`);
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Enter account address</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Enter your account address"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
            <Button type="submit" className="w-full">
              Use account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
