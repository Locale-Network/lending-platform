import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mockPools = [
  {
    name: 'Small Business Growth Pool',
    slug: 'small-business-growth',
    description:
      '<p>Designed to support small businesses with working capital and growth financing. This pool focuses on businesses with strong cash flow and proven track records.</p><p><strong>Target Businesses:</strong></p><ul><li>Established small businesses (2+ years)</li><li>Strong revenue growth trajectory</li><li>Solid credit history</li></ul>',
    poolType: 'SMALL_BUSINESS',
    status: 'ACTIVE',
    poolSize: 1700000,
    minimumStake: 1000,
    managementFeeRate: 2.0,
    performanceFeeRate: 10.0,
    baseInterestRate: 8.0,
    riskPremiumMin: 2.0,
    riskPremiumMax: 6.5,
    minCreditScore: 680,
    maxLTV: 75.0,
    allowedIndustries: ['Retail', 'Professional Services', 'Manufacturing', 'Technology'],
    totalStaked: 1250000,
    totalInvestors: 47,
    availableLiquidity: 450000,
    annualizedReturn: 12.5,
    imageUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72',
    isFeatured: true,
  },
  {
    name: 'Real Estate Ventures',
    slug: 'real-estate-ventures',
    description:
      '<p>Investment pool focused on commercial and residential real estate development projects. Provides construction and bridge financing for experienced developers.</p><p><strong>Project Types:</strong></p><ul><li>Multi-family residential developments</li><li>Commercial property renovations</li><li>Mixed-use developments</li></ul><p><strong>Risk Profile:</strong> Medium to high, secured by real estate assets</p>',
    poolType: 'REAL_ESTATE',
    status: 'ACTIVE',
    poolSize: 3620000,
    minimumStake: 5000,
    managementFeeRate: 1.5,
    performanceFeeRate: 15.0,
    baseInterestRate: 7.0,
    riskPremiumMin: 1.5,
    riskPremiumMax: 5.3,
    minCreditScore: 700,
    maxLTV: 70.0,
    allowedIndustries: ['Real Estate Development', 'Construction', 'Property Management'],
    totalStaked: 2800000,
    totalInvestors: 89,
    availableLiquidity: 820000,
    annualizedReturn: 10.8,
    imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa',
    isFeatured: true,
  },
  {
    name: 'Consumer Credit Pool',
    slug: 'consumer-credit-pool',
    description:
      '<p>Diversified pool providing personal loans and consumer credit to creditworthy borrowers. Focus on debt consolidation and major purchases.</p><p><strong>Loan Types:</strong></p><ul><li>Debt consolidation loans</li><li>Home improvement financing</li><li>Major purchase financing</li></ul>',
    poolType: 'CONSUMER',
    status: 'ACTIVE',
    poolSize: 5000000,
    minimumStake: 500,
    managementFeeRate: 2.5,
    performanceFeeRate: 12.0,
    baseInterestRate: 9.0,
    riskPremiumMin: 3.0,
    riskPremiumMax: 8.0,
    minCreditScore: 650,
    maxLTV: 85.0,
    allowedIndustries: [],
    totalStaked: 3200000,
    totalInvestors: 124,
    availableLiquidity: 1800000,
    annualizedReturn: 14.2,
    imageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f',
    isFeatured: false,
  },
  {
    name: 'Working Capital Pool',
    slug: 'working-capital',
    description:
      '<p>Short-term financing pool for businesses needing working capital. Quick approval process for established businesses with strong financials.</p>',
    poolType: 'SMALL_BUSINESS',
    status: 'DRAFT',
    poolSize: 2000000,
    minimumStake: 1000,
    managementFeeRate: 2.0,
    performanceFeeRate: 10.0,
    baseInterestRate: 8.5,
    riskPremiumMin: 2.5,
    riskPremiumMax: 7.0,
    minCreditScore: 670,
    maxLTV: 80.0,
    allowedIndustries: ['Retail', 'Wholesale', 'Distribution', 'E-commerce'],
    totalStaked: 0,
    totalInvestors: 0,
    availableLiquidity: 0,
    annualizedReturn: null,
    imageUrl: null,
    isFeatured: false,
  },
  {
    name: 'Mixed Asset Pool',
    slug: 'mixed-asset-pool',
    description:
      '<p>Diversified investment pool spanning multiple asset classes and borrower types. Balanced risk/return profile suitable for conservative investors.</p><p><strong>Asset Mix:</strong></p><ul><li>40% Small Business Loans</li><li>30% Real Estate</li><li>20% Consumer Credit</li><li>10% Reserve/Cash</li></ul>',
    poolType: 'MIXED',
    status: 'ACTIVE',
    poolSize: 10000000,
    minimumStake: 2500,
    managementFeeRate: 1.75,
    performanceFeeRate: 12.5,
    baseInterestRate: 7.5,
    riskPremiumMin: 2.0,
    riskPremiumMax: 6.0,
    minCreditScore: 680,
    maxLTV: 75.0,
    allowedIndustries: [
      'Technology',
      'Healthcare',
      'Real Estate',
      'Professional Services',
      'Retail',
    ],
    totalStaked: 6500000,
    totalInvestors: 203,
    availableLiquidity: 3500000,
    annualizedReturn: 11.3,
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40',
    isFeatured: true,
  },
];

async function main() {
  console.log('Starting pool seeding...');

  for (const pool of mockPools) {
    const created = await prisma.loanPool.upsert({
      where: { slug: pool.slug },
      update: pool,
      create: pool,
    });
    console.log(`✓ Created/Updated pool: ${created.name}`);
  }

  console.log('\nSeeding completed!');
  console.log(`Total pools: ${mockPools.length}`);
}

main()
  .catch(e => {
    console.error('Error seeding pools:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
