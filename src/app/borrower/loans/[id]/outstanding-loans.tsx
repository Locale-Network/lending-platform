'use client';

import * as React from 'react';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { type CarouselApi } from '@/components/ui/carousel';
import { OutstandingLoan } from '@prisma/client';

interface Props {
  loans: OutstandingLoan[];
}

export default function OutstandingLoans({ loans }: Props) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (api) {
      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap() + 1);

      api.on('select', () => {
        setCurrent(api.selectedScrollSnap() + 1);
      });
    }
  }, [api]);

  if (loans.length === 0) {
    return null;
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Outstanding Loans</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="h-6" />
          <Carousel setApi={setApi}>
            <CarouselContent>
              {loans.map((loan, index) => (
                <CarouselItem key={index}>
                  <Card className="border-2 bg-muted/50">
                    <CardContent className="grid gap-4 pt-6">
                      <div className="space-y-1">
                        <h3 className="font-semibold">{loan.lenderName}</h3>
                        <p className="text-sm text-muted-foreground">{loan.loanType}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                          <p className="font-medium">{loan.outstandingBalance.toLocaleString()} USDC</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Payment</p>
                          <p className="font-medium">{loan.monthlyPayment.toLocaleString()} USDC</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Remaining Months</p>
                          <p className="font-medium">{loan.remainingMonths}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Interest Rate</p>
                          <p className="font-medium">{loan.annualInterestRate}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute -top-6 left-0" />
            <CarouselNext className="absolute -top-6 right-0" />
          </Carousel>
        </div>
      </CardContent>
      <CardFooter>
        <span className="text-sm text-muted-foreground">
          Loan {current} of {count}
        </span>
      </CardFooter>
    </Card>
  );
}
