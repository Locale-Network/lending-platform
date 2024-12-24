import * as z from 'zod';
import { BusinessLegalStructure, BusinessIndustry, USState } from '@/types/business';

export const currentLoanSchema = z.object({
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
export type CurrentLoan = z.infer<typeof currentLoanSchema>;

export const connectedBankAccountSchema = z.object({
  institutionId: z.string(),
  instituteName: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  accountMask: z.string().nullable(),
  accountType: z.string(),
});
export type ConnectedBankAccount = z.infer<typeof connectedBankAccountSchema>;

export const BUSINESS_DESCRIPTION_MIN_LENGTH = 0;

export const BUSINESS_FOUNDED_YEAR_MIN = 1800;
export const BUSINESS_FOUNDED_YEAR_MAX = new Date().getFullYear();

export const loanApplicationFormSchema = z.object({
  applicationId: z.string(),
  accountAddress: z.string(),

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
    .min(BUSINESS_FOUNDED_YEAR_MIN, {
      message: `Year must be ${BUSINESS_FOUNDED_YEAR_MIN} or later.`,
    })
    .max(BUSINESS_FOUNDED_YEAR_MAX, { message: 'Year cannot be in the future.' })
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
  businessDescription: z.string().trim().min(BUSINESS_DESCRIPTION_MIN_LENGTH),
  // Step 1: Business information

  // Step 2: Debt service calculation
  hasDebtServiceProof: z.boolean(),
  // Step 2: Debt service calculation

  // Step 3: Credit Karma
  hasCreditScoreProof: z.boolean(),
  // Step 3: Credit Karma

  // Step 4: Current loans
  hasOutstandingLoans: z.boolean(),
  outstandingLoans: z.array(currentLoanSchema),
  // Step 4: Current loans
});
export type LoanApplicationForm = z.infer<typeof loanApplicationFormSchema>;
