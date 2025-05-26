# Lending Platform

NextJS + Prisma + Sign in with Ethereum

## About

The lending platform provides the user interface which allows both borrowers and approvers to access the system.

There is some basic backend functionality through a few endpoints. We handle incoming proofs from Reclaim protocol when users connect their bank account.

There are also two pages which allow the platform to act as a Reclaim data provider to allow users to complete the proof creation flow.

### Borrowers

- borrowers sign in with their wallet
- the borrower performs a kyc for their account address
- after the kyc, the borrower can apply for a loan by creating a loan request
- during the loan creation process, bank account transaction history as well as credit score are collected in order to process the loan

### Approvers

- approvers can review and accept/reject a loan application

## Getting Started

First, you should set up the [Loan Pool](https://github.com/Locale-Network/loan-pool) Smart Contracts and Cartesi instance for local development.

Copy the `example.env` file and fill in the missing variables:

```bash
cp .example.env .env
```

You need to replace `NEXT_PUBLIC_REOWN_CLOUD_PROJECT_ID` with your own reown (wallet connect project id).

You will need a local instance of postgres:
```bash
docker compose up db
```

Install all modules:

```bash
npm i --f
```

Run the database migrations:
```bash
npx prisma generate && npx prisma migrate dev
```

Run the dev server (for local dev, the local Cartesi machine should be running):


```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Loan Platform

### Sign in

Sign in with Wallet Connect. This will create an account for you as a "BORROWER".

You can request loans. 

If you would like to approve loans, make yourself a "APPROVER".

### Apply for loan

1. You will be asked to KYC the first time. Follow the instructions on the top right for sandbox data.
2. Create a new loan application
3. Submit

### Approve a loan

1. Click on the loan in the list
2. Hit the approve button and the funds will be sent to the user

## Processing notices

Normally notices are processed through a CRON job on vercel.

Trigger manually:

GET http://localhost:3000/api/cron/notices
with `Authorization: Bearer {CRON_SECRET}`

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
