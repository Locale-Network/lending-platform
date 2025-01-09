'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  StateMajorCities,
  USState,
  BusinessLegalStructure,
  BusinessIndustry,
} from '@/types/business';
import QRCode from 'react-qr-code';
import { submitDebtServiceProof, submitLoanApplication } from './actions';
import {
  loanApplicationFormSchema,
  BUSINESS_FOUNDED_YEAR_MAX,
  BUSINESS_FOUNDED_YEAR_MIN,
} from './form-schema';
import PlaidLink from './plaid-link';

interface LoanApplicationFormProps {
  loanApplicationId: string;
  accountAddress: string;
  linkToken: string;
}
export default function LoanApplicationForm({
  loanApplicationId,
  accountAddress,
  linkToken,
}: LoanApplicationFormProps) {
  const [debtServiceRequestUrl, setDebtServiceRequestUrl] = useState<string | null>(null);

  const [step, setStep] = useState(1);

  const [isPending, startTransition] = useTransition();

  const { toast } = useToast();
  const router = useRouter();

  const totalSteps = 4;

  const form = useForm<z.infer<typeof loanApplicationFormSchema>>({
    resolver: zodResolver(loanApplicationFormSchema),
    defaultValues: {
      applicationId: loanApplicationId,
      accountAddress,
      hasOutstandingLoans: false,
      outstandingLoans: [],
      hasDebtServiceProof: false,
      hasCreditScoreProof: true,
    },
  });

  const businessState = useWatch({
    control: form.control,
    name: 'businessState',
  });

  const hasOutstandingLoans = useWatch({
    control: form.control,
    name: 'hasOutstandingLoans',
  });

  const outstandingLoans = useWatch({
    control: form.control,
    name: 'outstandingLoans',
  });

  const hasDebtServiceProof = useWatch({
    control: form.control,
    name: 'hasDebtServiceProof',
  });

  const hasCreditScoreProof = useWatch({
    control: form.control,
    name: 'hasCreditScoreProof',
  });

  async function onSubmit(values: z.infer<typeof loanApplicationFormSchema>) {
    console.log('values', values);

    if (!values.hasDebtServiceProof || !values.hasCreditScoreProof) {
      return;
    }
    // if (!values.hasDebtServiceProof) {
    //   form.setError('hasDebtServiceProof', {
    //     type: 'manual',
    //     message: 'Please connect your bank account to calculate your debt service score',
    //   });
    //   return;
    // }

    // if (!values.hasCreditScoreProof) {
    //   form.setError('hasCreditScoreProof', {
    //     type: 'manual',
    //     message: 'Please connect your Credit Karma account to calculate your credit score',
    //   });
    //   return;
    // }

    startTransition(async () => {
      try {
        await submitLoanApplication({
          formData: values,
          accountAddress,
        });

        toast({
          title: 'Loan application submitted',
          variant: 'success',
        });
        router.push('/borrower/loans');
      } catch (error) {
        toast({
          title: 'Error submitting loan application',
          variant: 'destructive',
        });
      }
    });
  }

  function cardTitleForStep(step: number): string {
    switch (step) {
      case 1:
        return 'Business information';
      case 2:
        return 'Calculate your debt service';
      case 3:
        return 'Calculate your credit score';
      case 4:
        return 'Current loans';
      default:
        return 'Loan Application';
    }
  }

  const nextStep = async () => {
    if (step === 1) {
      const step1Fields = [
        'businessLegalName',
        'businessAddress',
        'businessState',
        'businessCity',
        'businessZipCode',
        'ein',
        'businessFoundedYear',
        'businessLegalStructure',
        'businessWebsite',
        'businessPrimaryIndustry',
        'businessDescription',
      ] as const;

      const result = await form.trigger(step1Fields);

      if (!result) {
        toast({
          title: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }
    }

    setStep(step => Math.min(step + 1, totalSteps));
  };

  const prevStep = () => setStep(step => Math.max(step - 1, 1));
  const clickStep = (step: number) => setStep(step);

  const handlePlaidLinkSuccess = (accessToken: string) => {
    console.log('handlePlaidLinkSuccess');
    console.log('accessToken', accessToken);
    form.setValue('hasDebtServiceProof', true);

    // make request
    submitDebtServiceProof({
      accessToken,
      loanApplicationId,
    });
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const pollCreditKarmaStatus = async () => {
      // TODO: once we have a sandbox
      // try {
      //   const response = await fetch(reclaimCreditKarmaStatusUrl);
      //   const data = await response.json();

      //   if (data?.session?.statusV2 === 'PROOF_SUBMITTED') {
      //     form.setValue('hasCreditScoreProof', true);
      //     clearInterval(intervalId);
      //   }
      // } catch (error) {
      //   console.error('Error polling Plaid status:', error);
      // }
      form.setValue('hasCreditScoreProof', true);
      clearInterval(intervalId);
    };

    if (step === 3 && !hasCreditScoreProof) {
      // Poll every 3 seconds
      intervalId = setInterval(pollCreditKarmaStatus, 3000);

      // Initial check
      pollCreditKarmaStatus();
    }

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [step, hasCreditScoreProof, form, loanApplicationId]);

  return (
    <Card className="mx-auto w-full max-w-4xl">
      <CardHeader>
        <CardTitle>{cardTitleForStep(step)}</CardTitle>
        <CardDescription>Loan ID: {loanApplicationId}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-10 flex justify-between">
          <div
            className={`'bg-secondary text-secondary-foreground' flex h-8 w-8 items-center justify-center rounded-full`}
            onClick={prevStep}
          >
            <ChevronLeft />
          </div>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-80 ${
                i + 1 <= step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
              onClick={() => clickStep(i + 1)}
            >
              {i + 1}
            </div>
          ))}

          <div
            className={`'bg-secondary text-secondary-foreground' flex h-8 w-8 items-center justify-center rounded-full`}
            onClick={nextStep}
          >
            <ChevronRight />
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="businessLegalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="businessState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(USState).map(state => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {businessState &&
                              StateMajorCities[businessState as USState].map(city => (
                                <SelectItem key={city} value={city}>
                                  {city}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the state first, then select the city.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="businessZipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip code</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ein"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EIN</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessFoundedYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Founded year</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={BUSINESS_FOUNDED_YEAR_MIN}
                            max={BUSINESS_FOUNDED_YEAR_MAX}
                            {...field}
                            onChange={e => {
                              const value = e.target.value.replace(/^0+/, ''); // Remove leading zeros
                              field.onChange(value ? +value : '');
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessLegalStructure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal structure</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(BusinessLegalStructure).map(structure => (
                              <SelectItem key={structure} value={structure}>
                                {structure}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="businessWebsite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input type="url" placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessPrimaryIndustry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary industry</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(BusinessIndustry).map(industry => (
                              <SelectItem key={industry} value={industry}>
                                {industry}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="businessDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description of your business</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Textarea className="resize-none" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="hasDebtServiceProof"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex flex-col items-center space-y-4">
                          <p className="text-center">Link your bank account</p>
                          {hasDebtServiceProof ? (
                            <div className="flex items-center space-x-2 rounded-lg bg-green-100 p-3 text-green-700">
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              <p className="font-medium">Bank account connected</p>
                            </div>
                          ) : (
                            <PlaidLink
                              linkToken={linkToken}
                              loanApplicationId={loanApplicationId}
                              accountAddress={accountAddress}
                              onSuccess={handlePlaidLinkSuccess}
                            />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="hasCreditScoreProof"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex flex-col items-center space-y-4">
                          <p className="text-center">
                            Scan the QR code to link your credit karma account
                          </p>
                          {hasCreditScoreProof ? (
                            <div className="flex items-center space-x-2 rounded-lg bg-green-100 p-3 text-green-700">
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              <p className="font-medium">Credit karma connected</p>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <p className="animate-pulse">Waiting for completion...</p>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="hasOutstandingLoans"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Does your business currently have outstanding loans?</FormLabel>
                      <FormDescription>
                        (ex: term loans, revolving credit, equipment financing, etc.)
                      </FormDescription>
                      <Select
                        onValueChange={value => {
                          field.onChange(value === 'yes');
                          // Add this block to handle automatic loan item creation
                          if (value === 'yes' && form.getValues('outstandingLoans').length === 0) {
                            form.setValue('outstandingLoans', [
                              {
                                lenderName: '',
                                loanType: '',
                                outstandingBalance: 0,
                                monthlyPayment: 0,
                                remainingMonths: 0,
                                annualInterestRate: 0,
                              },
                            ]);
                          }
                        }}
                        value={field.value ? 'yes' : 'no'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {hasOutstandingLoans && (
                  <FormField
                    control={form.control}
                    name="outstandingLoans"
                    render={({ field }) => (
                      <div className="space-y-4">
                        {field.value.map((loan, index) => (
                          <div key={index} className="rounded-lg border p-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <FormField
                                control={form.control}
                                name={`outstandingLoans.${index}.lenderName`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Lender name</FormLabel>
                                    <FormDescription>
                                      The financial institution that providing the loan.
                                    </FormDescription>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`outstandingLoans.${index}.loanType`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Loan type</FormLabel>
                                    <FormDescription>
                                      i.e. a term loan, revolving credit, equipment financing, etc.
                                    </FormDescription>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`outstandingLoans.${index}.outstandingBalance`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Outstanding balance ($)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        {...field}
                                        onChange={e => field.onChange(+e.target.value)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`outstandingLoans.${index}.monthlyPayment`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Monthly payment ($)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        {...field}
                                        onChange={e => field.onChange(+e.target.value)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`outstandingLoans.${index}.remainingMonths`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Loan term remaining (months)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        {...field}
                                        onChange={e => field.onChange(+e.target.value)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`outstandingLoans.${index}.annualInterestRate`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Annual interest rate (%)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        {...field}
                                        onChange={e => field.onChange(+e.target.value)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <Button
                              variant="destructive"
                              className="mt-4"
                              onClick={() => {
                                const updatedLoans = outstandingLoans.filter((_, i) => i !== index);
                                form.setValue('outstandingLoans', updatedLoans);

                                // If there are no more loans, set hasOutstandingLoans to false
                                if (updatedLoans.length === 0) {
                                  form.setValue('hasOutstandingLoans', false);
                                }
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const currentLoans = form.getValues('outstandingLoans');
                            form.setValue('outstandingLoans', [
                              ...currentLoans,
                              {
                                lenderName: '',
                                loanType: '',
                                outstandingBalance: 0,
                                monthlyPayment: 0,
                                remainingMonths: 0,
                                annualInterestRate: 0,
                              },
                            ]);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" /> Add Loan
                        </Button>
                      </div>
                    )}
                  />
                )}
              </div>
            )}
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between">
        {step > 1 && (
          <Button onClick={prevStep} variant="outline">
            Previous
          </Button>
        )}
        {step < totalSteps && <Button onClick={nextStep}>Next</Button>}
        {step === totalSteps && (
          <Button disabled={isPending} onClick={form.handleSubmit(onSubmit)}>
            {isPending ? 'Submitting...' : 'Submit Application'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center">
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);
