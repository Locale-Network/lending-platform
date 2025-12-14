enum Designation {
  MR = 'Mr.',
  MS = 'Ms.',
  MISS = 'Miss',
  MRS = 'Mrs.',
  DR = 'Dr.',
  PROF = 'Prof.',
  MX = 'Mx.',
  REV = 'Rev.',
  HON = 'Hon.',
  SIR = 'Sir',
  DAME = 'Dame',
  LADY = 'Lady',
  LORD = 'Lord',
}

enum Gender {
  WOMAN = 'Woman',
  MAN = 'Man',
  TRANSGENDER_WOMAN = 'Transgender Woman/Trans Feminine',
  TRANSGENDER_MAN = 'Transgender Man/Trans Masculine',
  NON_BINARY = 'Non-Binary/Gender Queer/Gender Fluid',
  PREFER_NOT_TO_SAY = 'Prefer not to say',
}

enum Pronoun {
  SHE_HER = 'She/Her/Hers',
  HE_HIM = 'He/Him/His',
  THEY_THEM = 'They/Them/Theirs',
  OTHER = 'Other',
}

enum RacialIdentification {
  WHITE = 'White',
  BLACK = 'Black or African American',
  AMERICAN_INDIAN = 'American Indian or Alaska Native',
  ASIAN = 'Asian',
  PACIFIC_ISLANDER = 'Native Hawaiian or Other Pacific Islander',
  HISPANIC = 'Hispanic or Latino',
  OTHER = 'Some Other Race',
}

enum EthnicIdentification {
  HISPANIC_LATINO = 'Hispanic or Latino',
  NON_HISPANIC_WHITE = 'Non-Hispanic White',
  AFRICAN = 'African',
  MENA = 'Middle Eastern or North African',
  ASIAN = 'Asian',
  NATIVE_AMERICAN = 'Native American',
  PACIFIC_ISLANDER = 'Pacific Islander',
  JEWISH = 'Jewish',
  EUROPEAN = 'European',
  OTHER = 'Other',
}

export { Designation, Gender, Pronoun, RacialIdentification, EthnicIdentification };
