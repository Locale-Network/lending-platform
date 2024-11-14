'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import {
  BusinessLegalStructure,
  BusinessIndustry,
  USState,
  StateMajorCities,
} from '@/types/business';
import {
  Designation,
  EthnicIdentification,
  Gender,
  Pronoun,
  RacialIdentification,
} from '@/types/borrower';

// TODO: terms and privacy links
// TODO: form submit
// TODO: file upload to vercel blod

const loanSchema = z.object({
  lenderName: z.string().min(1, 'Lender name is required'),
  loanType: z.string().min(1, 'Loan type is required'),
  outstandingBalance: z.number().min(0, 'Balance cannot be negative'),
  monthlyPayment: z.number().min(0, 'Monthly payment cannot be negative'),
  remainingMonths: z.number().min(0, 'Remaining months cannot be negative').int(),
  annualInterestRate: z
    .number()
    .min(0, 'Interest rate cannot be negative')
    .max(100, 'Interest rate cannot exceed 100%'),
});

const formSchema = z.object({
  // Step 1: Business information
  businessLegalName: z.string().min(2, { message: 'Enter the legal name of the business.' }),
  businessAddress: z.string().min(2, { message: 'Enter the address of the business.' }),
  businessState: z.nativeEnum(USState),
  businessCity: z.string().min(2, { message: 'Enter the city of the business.' }),
  businessZipCode: z.string().regex(/^\d{5}(-\d{4})?$/, {
    message: 'Enter a valid US zip code (e.g., 12345 or 12345-6789)',
  }),
  ein: z.string().min(9, { message: 'Enter the EIN of the business.' }),
  businessFoundedYear: z
    .number()
    .min(1800, { message: 'Year must be 1800 or later.' })
    .max(new Date().getFullYear(), { message: 'Year cannot be in the future.' })
    .int()
    .transform(val => parseInt(val.toString().replace(/^0+/, ''), 10)),
  businessLegalStructure: z.nativeEnum(BusinessLegalStructure),
  businessWebsite: z
    .string()
    .refine(val => !val || val.startsWith('https://'), {
      message: 'Website URL must start with https://',
    })
    .optional(),
  businessPrimaryIndustry: z.nativeEnum(BusinessIndustry),
  businessDescription: z
    .string()
    .min(70, { message: 'Description must be at least 70 characters.' })
    .max(100, { message: 'Description must not exceed 100 characters.' }),
  // Step 1: Business information

  // Step 2: Individual information
  borrowerDesignation: z.nativeEnum(Designation),
  borrowerFirstName: z.string().min(2, { message: 'First name must be at least 2 characters.' }),
  borrowerLastName: z.string().min(2, { message: 'Last name must be at least 2 characters.' }),
  borrowerGender: z.nativeEnum(Gender),
  borrowerPronoun: z.nativeEnum(Pronoun),
  borrowerRacialIdentification: z.nativeEnum(RacialIdentification),
  borrowerEthnicIdentification: z.nativeEnum(EthnicIdentification),
  borrowerResidentialAddress: z
    .string()
    .min(2, { message: 'Residential address must be at least 2 characters.' }),
  // Step 2: Individual information

  // Step 5: Current loans
  hasOutstandingLoans: z.boolean(),
  outstandingLoans: z.array(loanSchema),

  // Step 5: Current loans

  // Step 6: Supporting Documents
  governmentId: z.instanceof(File).optional(),
  proofOfAddress: z.instanceof(File).optional(),
  // Step 6: Supporting Documents

  // Step 7: User Acknowledgments
  termsAgreement: z
    .boolean()
    .refine(val => val === true, { message: 'You must agree to the terms of service.' }),
  riskAcknowledgment: z
    .boolean()
    .refine(val => val === true, { message: 'You must acknowledge the risks involved.' }),
});

export default function LoanApplicationForm() {
  const [step, setStep] = useState(1);
  const totalSteps = 7;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hasOutstandingLoans: false,
      outstandingLoans: [],
      termsAgreement: false,
      riskAcknowledgment: false,
    },
  });

  const hasOutstandingLoans = useWatch({
    control: form.control,
    name: 'hasOutstandingLoans',
  });

  const outstandingLoans = useWatch({
    control: form.control,
    name: 'outstandingLoans',
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    // Here you would typically send the form data to your backend
    alert('Form submitted successfully!');
  }

  function cardTitleForStep(step: number): string {
    switch (step) {
      case 1:
        return 'Business information';
      case 2:
        return 'Personal information';
      case 3:
        return 'Identity verification';
      case 4:
        return 'Cash flow verification';
      case 5:
        return 'Current loans';
      case 6:
        return 'Supporting documents';
      case 7:
        return 'User acknowledgments';
      default:
        return 'Loan Application';
    }
  }

  const nextStep = () => setStep(step => Math.min(step + 1, totalSteps));
  const prevStep = () => setStep(step => Math.max(step - 1, 1));
  const clickStep = (step: number) => setStep(step);

  return (
    <Card className="mx-auto w-full max-w-4xl">
      <CardHeader>
        <CardTitle>{cardTitleForStep(step)}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex justify-between">
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
                    name="businessState"
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
                            {form.getValues('businessState') &&
                              StateMajorCities[form.getValues('businessState') as USState].map(
                                city => (
                                  <SelectItem key={city} value={city}>
                                    {city}
                                  </SelectItem>
                                )
                              )}
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
                            min={1800}
                            max={new Date().getFullYear()}
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
                        <Textarea className="resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="borrowerDesignation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Designation</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(Designation).map(designation => (
                              <SelectItem key={designation} value={designation}>
                                {designation}
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
                    name="borrowerFirstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="borrowerLastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="borrowerGender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Which gender do you identify with?</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(Gender).map(gender => (
                              <SelectItem key={gender} value={gender}>
                                {gender}
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
                    name="borrowerPronoun"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Which pronoun do you prefer?</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(Pronoun).map(pronoun => (
                              <SelectItem key={pronoun} value={pronoun}>
                                {pronoun}
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
                    name="borrowerRacialIdentification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Racial identification</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(RacialIdentification).map(race => (
                              <SelectItem key={race} value={race}>
                                {race}
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
                    name="borrowerEthnicIdentification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ethnic identification</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(EthnicIdentification).map(ethnic => (
                              <SelectItem key={ethnic} value={ethnic}>
                                {ethnic}
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
                  name="borrowerResidentialAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residential address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {step === 3 && <div className="space-y-4"></div>}

            {step === 4 && <div className="space-y-4"></div>}

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
                              Remove {index}
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

            {step === 6 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="governmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Government ID</FormLabel>
                      <FormControl>
                        <Input type="file" {...field} value={field.value?.name} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proofOfAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proof of address</FormLabel>
                      <FormControl>
                        <Input type="file" {...field} value={field.value?.name} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="termsAgreement"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>I agree to the terms of service</FormLabel>
                        <FormDescription>
                          You agree to our{' '}
                          <Link href="#" className="text-blue-500 hover:text-blue-600">
                            Terms of Service
                          </Link>{' '}
                          and{' '}
                          <Link className="text-blue-500 hover:text-blue-600" href="#">
                            Privacy Policy
                          </Link>
                          .
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="riskAcknowledgment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>I acknowledge the risks involved</FormLabel>
                        <FormDescription>
                          You understand and accept the risks associated with decentralized lending.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
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
          <Button onClick={form.handleSubmit(onSubmit)}>Submit Application</Button>
        )}
      </CardFooter>
    </Card>
  );
}
