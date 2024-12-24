'use client';

import { DebtService } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { formatCurrencyToUSD } from '@/utils/number';

interface Props {
  debtService: DebtService | null;
}

export default function DebtServiceInformation({ debtService }: Props) {
  if (!debtService) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Debt Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-muted-foreground">
            No debt service information available
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="mx-auto w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Debt Service</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <DebtServiceItem
            label="Transaction Count"
            value={debtService.transactionCount.toString()}
            highlight
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface DebtServiceItemProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function DebtServiceItem({ label, value, highlight = false }: DebtServiceItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-sm font-medium text-gray-500">{label}</Label>
      <p className={`text-lg font-semibold ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}
