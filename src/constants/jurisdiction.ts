/**
 * Jurisdiction constants for Reg D / Reg S compliance.
 *
 * US investors  → Reg D 506(b) accreditation self-cert
 * Non-US investors → Reg S offshore certification
 */

// ── US States (ISO 3166-2:US) ─────────────────────────────────────────────
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
] as const;

// ── Countries (ISO 3166-1 alpha-2, curated list) ──────────────────────────
export const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PT', name: 'Portugal' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IN', name: 'India' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IL', name: 'Israel' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'PH', name: 'Philippines' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'GH', name: 'Ghana' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Peru' },
] as const;

// Countries blocked from Reg S (OFAC sanctioned)
export const BLOCKED_COUNTRIES = ['CU', 'IR', 'KP', 'SY', 'RU'] as const;

// ── Reg S Certification Keys ──────────────────────────────────────────────
export const REG_S_CERTIFICATIONS = {
  non_us_person: {
    key: 'non_us_person',
    label: 'Non-U.S. Person',
    text: 'I confirm that I am not a "U.S. person" as defined in Rule 902(k) of Regulation S under the U.S. Securities Act of 1933.',
  },
  offshore_transaction: {
    key: 'offshore_transaction',
    label: 'Offshore Transaction',
    text: 'I confirm that this investment is being made in an "offshore transaction" as defined in Rule 902(h) of Regulation S, and that no directed selling efforts have been made to me in the United States.',
  },
  no_resale_us: {
    key: 'no_resale_us',
    label: 'No U.S. Resale',
    text: 'I understand and agree that any securities acquired may not be offered or sold in the United States or to U.S. persons unless registered under the Securities Act or pursuant to an applicable exemption.',
  },
  local_law_compliance: {
    key: 'local_law_compliance',
    label: 'Local Law Compliance',
    text: 'I confirm that my participation in this offering is in compliance with all applicable laws and regulations of my jurisdiction of residence.',
  },
} as const;

export type RegSCertificationKey = keyof typeof REG_S_CERTIFICATIONS;
export const REG_S_CERTIFICATION_KEYS = Object.keys(REG_S_CERTIFICATIONS) as RegSCertificationKey[];

// ── Rule 902(k) Definition Text ───────────────────────────────────────────
export const RULE_902K_TEXT = `Under Rule 902(k) of Regulation S, a "U.S. person" means:
(i) Any natural person resident in the United States;
(ii) Any partnership or corporation organized or incorporated under the laws of the United States;
(iii) Any estate of which any executor or administrator is a U.S. person;
(iv) Any trust of which any trustee is a U.S. person;
(v) Any agency or branch of a foreign entity located in the United States;
(vi) Any non-discretionary account or similar account held by a dealer or other fiduciary for the benefit or account of a U.S. person;
(vii) Any discretionary account or similar account held by a dealer or other fiduciary organized, incorporated, or (if an individual) resident in the United States; and
(viii) Any partnership or corporation if organized or incorporated under the laws of any foreign jurisdiction and formed by a U.S. person principally for the purpose of investing in securities not registered under the Act.`;

// ── Accreditation Methods (US - Reg D 506(b)) ────────────────────────────
export const ACCREDITATION_METHODS = [
  {
    value: 'income',
    label: 'Income',
    description:
      'I earned $200K+ individually (or $300K+ jointly) in each of the past two years and expect the same this year',
  },
  {
    value: 'net_worth',
    label: 'Net Worth',
    description:
      'My net worth (or joint net worth with spouse) exceeds $1M, excluding primary residence',
  },
  {
    value: 'entity',
    label: 'Entity',
    description:
      'I am investing through an entity with $5M+ in assets, or all equity owners are accredited',
  },
  {
    value: 'licensed',
    label: 'Licensed Professional',
    description: 'I hold a Series 7, 65, or 82 license in good standing',
  },
] as const;

export const ALLOWED_ACCREDITATION_METHODS: string[] = ACCREDITATION_METHODS.map((m) => m.value);
export type AccreditationMethod = (typeof ACCREDITATION_METHODS)[number]['value'];
