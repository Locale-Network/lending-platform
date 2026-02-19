import * as z from 'zod';
import { BusinessLegalStructure, BusinessIndustry, USState } from '@/types/business';

// Funding urgency options
export const FundingUrgency = {
  WITHIN_WEEK: 'within_week',
  WITHIN_2_WEEKS: 'within_2_weeks',
  WITHIN_MONTH: 'within_month',
  JUST_BROWSING: 'just_browsing',
} as const;
export type FundingUrgencyType = (typeof FundingUrgency)[keyof typeof FundingUrgency];

// Loan purpose options (based on LendingTree)
export const LoanPurpose = {
  EXPANSION: 'expansion',
  EQUIPMENT_PURCHASE: 'equipment_purchase',
  VEHICLE_PURCHASE: 'vehicle_purchase',
  INVENTORY: 'inventory',
  PAYROLL: 'payroll',
  MARKETING: 'marketing',
  COMMERCIAL_REAL_ESTATE: 'commercial_real_estate',
  REMODEL_LOCATION: 'remodel_location',
  REFINANCE_DEBT: 'refinance_debt',
  ACCOUNTS_RECEIVABLE: 'accounts_receivable',
  BUY_BUSINESS_FRANCHISE: 'buy_business_franchise',
  START_BUSINESS: 'start_business',
  OTHER: 'other',
} as const;
export type LoanPurposeType = (typeof LoanPurpose)[keyof typeof LoanPurpose];

// Estimated credit score ranges
export const EstimatedCreditScore = {
  EXCELLENT: 'excellent', // 720+
  GOOD: 'good', // 680-719
  FAIR: 'fair', // 640-679
  POOR: 'poor', // 639 or less
} as const;
export type EstimatedCreditScoreType =
  (typeof EstimatedCreditScore)[keyof typeof EstimatedCreditScore];

// Display labels for enums (includes loan term for transparency)
export const FundingUrgencyLabels: Record<FundingUrgencyType, string> = {
  within_week: '12-month term — I need funding within a week',
  within_2_weeks: '24-month term — I need funding within 2 weeks',
  within_month: '36-month term — I need funding within a month',
  just_browsing: '24-month term — Unsure, just browsing rates',
};

export const LoanPurposeLabels: Record<LoanPurposeType, string> = {
  expansion: 'Expansion',
  equipment_purchase: 'Equipment purchase',
  vehicle_purchase: 'Purchase a vehicle',
  inventory: 'Inventory',
  payroll: 'Payroll',
  marketing: 'Marketing',
  commercial_real_estate: 'Commercial real estate',
  remodel_location: 'Remodel my location',
  refinance_debt: 'Refinance debt',
  accounts_receivable: 'Finance Accounts Receivable',
  buy_business_franchise: 'Buy a business/franchise',
  start_business: 'Start a business',
  other: 'Other',
};

export const CreditScoreLabels: Record<EstimatedCreditScoreType, string> = {
  excellent: 'Excellent (720+)',
  good: 'Good (680-719)',
  fair: 'Fair (640-679)',
  poor: 'Poor (639 or less)',
};

// Map funding urgency to term months for DSCR calculation
export const FundingUrgencyToTermMonths: Record<FundingUrgencyType, number> = {
  within_week: 12,
  within_2_weeks: 24,
  within_month: 36,
  just_browsing: 24, // default
};

/**
 * Calculate estimated monthly payment using standard amortization formula
 * P * [r(1+r)^n] / [(1+r)^n - 1]
 *
 * @param principal - Loan amount in dollars
 * @param termMonths - Loan term in months
 * @param annualRatePercent - Annual interest rate as percentage (e.g. 10 for 10%)
 * @returns Estimated monthly payment in dollars
 */
export function calculateMonthlyPayment(
  principal: number,
  termMonths: number,
  annualRatePercent: number = 10,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

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

  // Pool Selection (required - borrower must choose which pool to apply to)
  poolId: z.string().min(1, { message: 'Please select a loan pool to apply to' }),

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

  // Step 2: Loan Details (NEW - based on LendingTree)
  requestedLoanAmount: z.coerce
    .number()
    .min(5000, { message: 'Minimum loan amount is $5,000' })
    .max(500000, { message: 'Maximum loan amount is $500,000' }),
  fundingUrgency: z.enum(
    [
      FundingUrgency.WITHIN_WEEK,
      FundingUrgency.WITHIN_2_WEEKS,
      FundingUrgency.WITHIN_MONTH,
      FundingUrgency.JUST_BROWSING,
    ],
    { required_error: 'Please select when you need the funding' }
  ),
  loanPurpose: z.enum(
    [
      LoanPurpose.EXPANSION,
      LoanPurpose.EQUIPMENT_PURCHASE,
      LoanPurpose.VEHICLE_PURCHASE,
      LoanPurpose.INVENTORY,
      LoanPurpose.PAYROLL,
      LoanPurpose.MARKETING,
      LoanPurpose.COMMERCIAL_REAL_ESTATE,
      LoanPurpose.REMODEL_LOCATION,
      LoanPurpose.REFINANCE_DEBT,
      LoanPurpose.ACCOUNTS_RECEIVABLE,
      LoanPurpose.BUY_BUSINESS_FRANCHISE,
      LoanPurpose.START_BUSINESS,
      LoanPurpose.OTHER,
    ],
    { required_error: 'Please select the purpose of your loan' }
  ),
  // Step 2: Loan Details

  // Step 3: Credit Score (self-reported, replaces Credit Karma)
  estimatedCreditScore: z.enum(
    [
      EstimatedCreditScore.EXCELLENT,
      EstimatedCreditScore.GOOD,
      EstimatedCreditScore.FAIR,
      EstimatedCreditScore.POOR,
    ],
    { required_error: 'Please select your estimated credit score' }
  ),
  // Step 3: Credit Score

  // Step 4: Bank Account Connection (debt service proof)
  hasDebtServiceProof: z.boolean(),
  // Step 4: Bank Account Connection

  // Step 5: Current loans
  hasOutstandingLoans: z.boolean(),
  outstandingLoans: z.array(currentLoanSchema),
  // Step 5: Current loans

  // Step 6: Review & Disclosures
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and disclosures to continue',
  }),
  // Step 6: Review & Disclosures
});
export type LoanApplicationForm = z.infer<typeof loanApplicationFormSchema>;

// Legal disclosures text for Locale DAO, LLC
export const LOCALE_DISCLOSURES = `By clicking "Submit Application" above, I understand and agree to the following terms:

• I provide my express written consent to receive calls and text messages at the number provided, including for marketing purposes, from Locale DAO, LLC and its lending partners. This includes communications made through automated means such as autodialers and prerecorded messages. Message and data rates may apply. Text "STOP" to cancel. Consent is not required as a condition of any loan.

• I authorize Locale DAO, LLC to share my information with its lending partners, who may further share information as necessary to process my application. Locale and its partners may exchange information about me, including loan terms and account status.

• I agree to Locale's Terms of Service and Privacy Policy, and consent to receive communications electronically.

• My financial information is processed using privacy-preserving zero-knowledge proofs, ensuring my data remains encrypted and secure throughout the verification process.

Locale DAO, LLC is a Wyoming limited liability company operating as a decentralized autonomous organization.`;
