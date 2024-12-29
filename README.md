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

First, run the development server:

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
