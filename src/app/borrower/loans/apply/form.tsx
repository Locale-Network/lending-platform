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
import { Plus, CheckCircle2, Lock, Shield, CreditCard, Building2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
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
import { submitDebtServiceProof, submitLoanApplication } from './actions';
import {
  loanApplicationFormSchema,
  BUSINESS_FOUNDED_YEAR_MAX,
  BUSINESS_FOUNDED_YEAR_MIN,
  FundingUrgency,
  FundingUrgencyLabels,
  LoanPurpose,
  LoanPurposeLabels,
  EstimatedCreditScore,
  CreditScoreLabels,
  LOCALE_DISCLOSURES,
  type FundingUrgencyType,
  type LoanPurposeType,
  type EstimatedCreditScoreType,
} from './form-schema';
import PlaidLink from './plaid-link';
import DscrVerificationStatus from './dscr-verification-status';

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
  const [plaidAccessToken, setPlaidAccessToken] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { toast } = useToast();
  const router = useRouter();

  const totalSteps = 7;

  const form = useForm<z.infer<typeof loanApplicationFormSchema>>({
    resolver: zodResolver(loanApplicationFormSchema),
    defaultValues: {
      applicationId: loanApplicationId,
      accountAddress,
      // Step 1: Business information
      businessLegalName: '',
      businessAddress: '',
      businessState: undefined,
      businessCity: '',
      businessZipCode: '',
      ein: '',
      businessFoundedYear: undefined,
      businessLegalStructure: undefined,
      businessWebsite: '',
      businessPrimaryIndustry: undefined,
      businessDescription: '',
      // Step 2: Loan Details
      requestedLoanAmount: undefined,
      fundingUrgency: undefined,
      loanPurpose: undefined,
      // Step 3: Credit Score
      estimatedCreditScore: undefined,
      // Step 4: Bank Connection
      hasDebtServiceProof: false,
      // Step 5: Current Loans
      hasOutstandingLoans: false,
      outstandingLoans: [],
      // Step 6: Terms Agreement
      agreedToTerms: false,
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

  const agreedToTerms = useWatch({
    control: form.control,
    name: 'agreedToTerms',
  });

  async function onSubmit(values: z.infer<typeof loanApplicationFormSchema>) {
    console.log('Submitting loan application:', values);

    if (!values.hasDebtServiceProof) {
      toast({
        title: 'Please connect your bank account',
        description: 'Bank account verification is required to proceed.',
        variant: 'destructive',
      });
      return;
    }

    if (!values.agreedToTerms) {
      toast({
        title: 'Please agree to the terms',
        description: 'You must agree to the terms and disclosures to continue.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      try {
        await submitLoanApplication({
          formData: values,
          accountAddress,
        });

        setIsSubmitted(true);
        setStep(7); // Go to confirmation screen
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
        return 'Business Information';
      case 2:
        return 'Loan Details';
      case 3:
        return 'Credit Score';
      case 4:
        return 'Link Your Bank Account';
      case 5:
        return 'Current Loans';
      case 6:
        return 'Review & Submit';
      case 7:
        return 'Application Submitted';
      default:
        return 'Loan Application';
    }
  }

  function cardSubtitleForStep(step: number): string {
    switch (step) {
      case 1:
        return 'Tell us about your business';
      case 2:
        return 'How much funding do you need?';
      case 3:
        return 'What is your estimated credit score?';
      case 4:
        return 'Verify your cash flow securely';
      case 5:
        return 'Do you have any outstanding loans?';
      case 6:
        return 'Review your application and agree to terms';
      case 7:
        return 'Thank you for your application!';
      default:
        return '';
    }
  }

  const validateStep = async (currentStep: number): Promise<boolean> => {
    switch (currentStep) {
      case 1: {
        const step1Fields = [
          'businessLegalName',
          'businessAddress',
          'businessState',
          'businessCity',
          'businessZipCode',
          'ein',
          'businessFoundedYear',
          'businessLegalStructure',
          'businessPrimaryIndustry',
          'businessDescription',
        ] as const;
        return await form.trigger(step1Fields);
      }
      case 2: {
        const step2Fields = ['requestedLoanAmount', 'fundingUrgency', 'loanPurpose'] as const;
        return await form.trigger(step2Fields);
      }
      case 3: {
        const step3Fields = ['estimatedCreditScore'] as const;
        return await form.trigger(step3Fields);
      }
      case 4:
        // Bank connection validation - must have proof
        return hasDebtServiceProof;
      case 5:
        // Outstanding loans - always valid (optional)
        return true;
      case 6:
        // Terms agreement
        return agreedToTerms;
      default:
        return true;
    }
  };

  const nextStep = async () => {
    const isValid = await validateStep(step);

    if (!isValid) {
      if (step === 4 && !hasDebtServiceProof) {
        toast({
          title: 'Bank Account Required',
          description: 'Please connect your bank account to continue.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setStep(step => Math.min(step + 1, totalSteps));
  };

  const prevStep = () => setStep(step => Math.max(step - 1, 1));
  const clickStep = (targetStep: number) => {
    if (targetStep <= step) {
      setStep(targetStep);
    }
  };

  const handlePlaidLinkSuccess = (accessToken: string) => {
    console.log('Plaid link success');
    setPlaidAccessToken(accessToken);

    // Get loan amount from form state (Step 2) - needed for Cartesi loan creation
    const requestedLoanAmount = form.getValues('requestedLoanAmount');

    // Submit to zkFetch + Cartesi for DSCR verification
    // Pass loan amount so Cartesi can create the loan BEFORE DSCR calculation
    submitDebtServiceProof({
      accessToken,
      loanApplicationId,
      requestedLoanAmount: requestedLoanAmount?.toString(),
    });
  };

  const handleDscrVerificationComplete = (verified: boolean) => {
    if (verified) {
      form.setValue('hasDebtServiceProof', true);
    }
  };

  // Step 7 - Confirmation Screen
  if (isSubmitted || step === 7) {
    return (
      <Card className="mx-auto w-full max-w-4xl">
        <CardContent className="py-12">
          <div className="flex flex-col items-center space-y-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Application Submitted!</h2>
            <p className="max-w-md text-muted-foreground">
              Thank you! Your loan application has been received and is being processed.
            </p>

            <div className="w-full max-w-md rounded-lg bg-muted p-6 text-left">
              <h3 className="mb-4 font-semibold">What happens next:</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    1
                  </span>
                  <span>We'll verify your information (1-2 hours)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    2
                  </span>
                  <span>You'll receive loan offers via email</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    3
                  </span>
                  <span>Choose the best option for your business</span>
                </li>
              </ol>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              <Lock className="h-4 w-4" />
              <div className="text-left">
                <p className="font-medium">Your data is protected</p>
                <p className="text-xs text-green-600">
                  Encrypted with zkProof technology • Bank-grade security • No credit impact
                </p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button variant="outline" onClick={() => router.push('/borrower/loans')}>
                View My Applications
              </Button>
              <Button onClick={() => router.push('/borrower')}>Return to Dashboard</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          {step <= 6 && <span className="text-sm text-muted-foreground">Step {step} of 6</span>}
        </div>
        <CardTitle>{cardTitleForStep(step)}</CardTitle>
        <CardDescription>{cardSubtitleForStep(step)}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Step Indicator */}
        <div className="mb-10 flex justify-between">
          <div
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            onClick={prevStep}
          >
            <ChevronLeft />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
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
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            onClick={nextStep}
          >
            <ChevronRight />
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Step 1: Business Information */}
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
                              const value = e.target.value.replace(/^0+/, '');
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="businessWebsite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website (optional)</FormLabel>
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
                        <Textarea className="resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2: Loan Details */}
            {step === 2 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="requestedLoanAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How much funding do you need?</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            min={5000}
                            max={500000}
                            className="pl-7"
                            placeholder="50,000"
                            {...field}
                            onChange={e => field.onChange(+e.target.value)}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>$5,000 - $500,000</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fundingUrgency"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>How quickly do you need the money?</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-2"
                        >
                          {Object.entries(FundingUrgencyLabels).map(([value, label]) => (
                            <div
                              key={value}
                              className={`flex cursor-pointer items-center space-x-3 rounded-lg border p-4 transition-colors ${
                                field.value === value
                                  ? 'border-primary bg-primary/5'
                                  : 'hover:bg-muted'
                              }`}
                              onClick={() => field.onChange(value)}
                            >
                              <RadioGroupItem value={value} id={value} />
                              <label htmlFor={value} className="flex-1 cursor-pointer">
                                {label}
                              </label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="loanPurpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What are you getting the financing for?</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select purpose..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(LoanPurposeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 3: Credit Score */}
            {step === 3 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="estimatedCreditScore"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>What's your estimated personal credit score?</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-2"
                        >
                          {Object.entries(CreditScoreLabels).map(([value, label]) => (
                            <div
                              key={value}
                              className={`flex cursor-pointer items-center space-x-3 rounded-lg border p-4 transition-colors ${
                                field.value === value
                                  ? 'border-primary bg-primary/5'
                                  : 'hover:bg-muted'
                              }`}
                              onClick={() => field.onChange(value)}
                            >
                              <RadioGroupItem value={value} id={`credit-${value}`} />
                              <label htmlFor={`credit-${value}`} className="flex-1 cursor-pointer">
                                {label}
                              </label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormDescription className="text-center text-muted-foreground">
                        (We have lenders who can help all credit scenarios.)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 4: Bank Account Connection */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="flex flex-col items-center space-y-6">
                  <p className="max-w-md text-center text-muted-foreground">
                    Connect your business bank account to verify your cash flow. This helps us find
                    the best rates for your business.
                  </p>

                  {!plaidAccessToken && (
                    <PlaidLink
                      linkToken={linkToken}
                      loanApplicationId={loanApplicationId}
                      accountAddress={accountAddress}
                      onSuccess={handlePlaidLinkSuccess}
                    />
                  )}

                  {/* DSCR Verification Status - simplified display */}
                  <DscrVerificationStatus
                    loanApplicationId={loanApplicationId}
                    accessToken={plaidAccessToken}
                    onVerificationComplete={handleDscrVerificationComplete}
                  />

                  {/* Security assurances */}
                  <div className="grid w-full max-w-md grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span>Securely encrypted</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="h-4 w-4 text-green-600" />
                      <span>Bank-grade security</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-4 w-4 text-green-600" />
                      <span>Read-only access</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>No credit impact</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <span>Secured by zkProof Technology (Privacy-preserving verification)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Current Loans */}
            {step === 5 && (
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
                              type="button"
                              onClick={() => {
                                const updatedLoans = outstandingLoans.filter((_, i) => i !== index);
                                form.setValue('outstandingLoans', updatedLoans);
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

            {/* Step 6: Review & Disclosures */}
            {step === 6 && (
              <div className="space-y-6">
                {/* Application Summary */}
                <div className="rounded-lg border bg-muted/30 p-6">
                  <h3 className="mb-4 font-semibold">Application Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Business</p>
                      <p className="font-medium">{form.getValues('businessLegalName')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Loan Amount</p>
                      <p className="font-medium">
                        ${form.getValues('requestedLoanAmount')?.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Purpose</p>
                      <p className="font-medium">
                        {LoanPurposeLabels[form.getValues('loanPurpose') as LoanPurposeType]}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Urgency</p>
                      <p className="font-medium">
                        {FundingUrgencyLabels[form.getValues('fundingUrgency') as FundingUrgencyType]}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Credit Score</p>
                      <p className="font-medium">
                        {
                          CreditScoreLabels[
                            form.getValues('estimatedCreditScore') as EstimatedCreditScoreType
                          ]
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bank Account</p>
                      <p className="font-medium text-green-600">
                        {hasDebtServiceProof ? '✓ Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Terms Agreement */}
                <FormField
                  control={form.control}
                  name="agreedToTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>I agree to the Terms and Disclosures below</FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                {/* Disclosures */}
                <div className="rounded-lg border bg-muted/20 p-4">
                  <h4 className="mb-2 text-sm font-semibold">Disclosures</h4>
                  <div className="max-h-48 overflow-y-auto text-xs text-muted-foreground">
                    <pre className="whitespace-pre-wrap font-sans">{LOCALE_DISCLOSURES}</pre>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between">
        {step > 1 && step < 7 && (
          <Button onClick={prevStep} variant="outline">
            Previous
          </Button>
        )}
        {step === 1 && <div />}
        {step < 6 && <Button onClick={nextStep}>Continue</Button>}
        {step === 6 && (
          <Button disabled={isPending || !agreedToTerms} onClick={form.handleSubmit(onSubmit)}>
            {isPending ? 'Submitting...' : 'Submit Application'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
