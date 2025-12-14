'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useMemo } from 'react';

type PortfolioPerformanceChartProps = {
  stakes: any[];
};

export function PortfolioPerformanceChart({ stakes }: PortfolioPerformanceChartProps) {
  // Generate mock historical data for demonstration
  // In production, this would come from actual historical records
  const performanceData = useMemo(() => {
    if (!stakes || stakes.length === 0) return [];

    const today = new Date();
    const data = [];

    // Generate data for the last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Calculate portfolio value for this day
      let portfolioValue = 0;
      let investedAmount = 0;

      stakes.forEach((stake) => {
        const stakeDate = new Date(stake.stakedAt || stake.created_at);
        if (stakeDate <= date) {
          // Calculate how many days the stake has been active
          const daysActive = Math.floor((date.getTime() - stakeDate.getTime()) / (1000 * 60 * 60 * 24));
          const apy = stake.pool?.annualizedReturn || 12;
          const dailyReturn = (apy / 365 / 100);
          const rewards = stake.amount * dailyReturn * daysActive;

          portfolioValue += stake.amount + rewards;
          investedAmount += stake.amount;
        }
      });

      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.round(portfolioValue),
        invested: Math.round(investedAmount),
        earnings: Math.round(portfolioValue - investedAmount),
      });
    }

    return data;
  }, [stakes]);

  if (!stakes || stakes.length === 0) {
    return null;
  }

  const currentValue = performanceData[performanceData.length - 1]?.value || 0;
  const initialValue = performanceData[0]?.value || 0;
  const totalGain = currentValue - initialValue;
  const gainPercentage = initialValue > 0 ? ((totalGain / initialValue) * 100).toFixed(2) : '0.00';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Portfolio Performance</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{currentValue.toLocaleString()} USDC</p>
            <p className={`text-sm ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalGain >= 0 ? '+' : ''}{totalGain.toLocaleString()} USDC ({gainPercentage}%)
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => `${value.toLocaleString()} USDC`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Portfolio Value"
              />
              <Line
                type="monotone"
                dataKey="invested"
                stroke="#6b7280"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Invested Amount"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
