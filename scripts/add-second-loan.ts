import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get the existing pool
  const pool = await prisma.loanPool.findUnique({
    where: { slug: 'small-business-growth' },
  });

  if (!pool) {
    console.log('Pool not found');
    return;
  }

  console.log('Pool:', pool.id, pool.name);

  // Check existing pool loans
  const existingLoans = await prisma.poolLoan.findMany({
    where: { poolId: pool.id },
    include: { loanApplication: { select: { id: true, businessLegalName: true, lendScore: true } } },
  });

  console.log('Existing pool loans:', existingLoans.length);
  existingLoans.forEach(l => {
    console.log(`  - ${l.id}: ${l.loanApplication.businessLegalName}, principal: ${l.principal}, rate: ${l.interestRate}%, lendScore: ${l.loanApplication.lendScore}`);
  });

  if (existingLoans.length >= 2) {
    console.log('Already have 2+ loans, skipping creation');
    return;
  }

  // Create test account if needed
  const testAddress = '0x0000000000000000000000000000000000000002';
  await prisma.account.upsert({
    where: { address: testAddress },
    create: { address: testAddress, role: 'BORROWER' },
    update: {},
  });
  console.log('Account ready:', testAddress);

  // Create a second disbursed loan application
  const newLoan = await prisma.loanApplication.upsert({
    where: { id: 'test-loan-composite-2' },
    create: {
      id: 'test-loan-composite-2',
      accountAddress: testAddress,
      businessLegalName: 'Test Business 2',
      businessAddress: '456 Oak Ave',
      businessState: 'NY',
      businessCity: 'New York',
      businessZipCode: '10001',
      ein: '98-7654321',
      businessFoundedYear: 2019,
      businessLegalStructure: 'LLC',
      businessPrimaryIndustry: 'Technology',
      businessDescription: 'Test business for composite scoring',
      status: 'DISBURSED',
      requestedAmount: BigInt(75000),
      lendScore: 65,
      agreedToTerms: true,
    },
    update: {
      status: 'DISBURSED',
      lendScore: 65,
    },
  });

  console.log('Loan application ready:', newLoan.id);

  // Add to pool
  const poolLoan = await prisma.poolLoan.upsert({
    where: {
      poolId_loanApplicationId: {
        poolId: pool.id,
        loanApplicationId: newLoan.id,
      },
    },
    create: {
      poolId: pool.id,
      loanApplicationId: newLoan.id,
      principal: 75000,
      interestRate: 13.5,
      termMonths: 24,
      expectedReturn: 85125,
    },
    update: {},
  });

  console.log('Pool loan created:', poolLoan.id);

  // Verify
  const finalLoans = await prisma.poolLoan.count({ where: { poolId: pool.id } });
  console.log('Total pool loans now:', finalLoans);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
