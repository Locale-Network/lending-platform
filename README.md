# Locale Lending Platform

A decentralized peer-to-peer lending platform built on Cartesi, enabling borrowers to access loans and investors to earn yields through lending pools.

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL with Supabase
- **Authentication**: NextAuth.js with Alchemy Account Kit
- **Blockchain**: Cartesi, Arbitrum, Ethereum
- **Wallet Integration**: WalletConnect, Alchemy Account Kit (Embedded & External Wallets)
- **Identity Verification**: Plaid KYC, ZK Proofs (Groth16)

## Features

### For Investors

#### Pool Discovery
- Browse and filter lending pools by APY, TVL, risk level, and investor count
- Advanced search with real-time filtering
- Side-by-side pool comparison tool
- Detailed pool analytics and performance metrics

#### Portfolio Management
- Real-time portfolio dashboard with performance charts
- Asset allocation visualization (pie charts)
- 30-day performance trend analysis
- Active stake tracking across multiple pools
- Earnings history and projections

#### Analytics Dashboard
- Platform-wide metrics (Total TVL, Active Pools, Total Investors)
- TVL growth trends over time
- APY distribution across pools
- Investor growth analytics
- Pool type breakdown
- Top performing pools ranking
- Market trends and seasonal insights

#### User Settings
- Account management with wallet integration
- Notification preferences (email, investment updates, earnings alerts)
- Transaction history export
- Wallet disconnect with confirmation

### For Borrowers

- Sign in with wallet (WalletConnect or Alchemy embedded wallet)
- KYC verification for account addresses
- Loan application with bank account verification
- DSCR verification via ZK proofs (privacy-preserving)
- Transaction history analysis through Plaid

### For Approvers/Admins

- Review and approve/reject loan applications
- Manage lending pools (create, edit, archive)
- Investor management dashboard
- Pool analytics and performance monitoring
- Platform-wide statistics

## Getting Started

### Prerequisites

1. Set up the [Loan Pool Smart Contracts](https://github.com/Locale-Network/loan-pool) and Cartesi instance for local development
2. PostgreSQL database (local or Supabase)
3. Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Locale-Network/lending-platform.git
cd lending-platform
```

2. Copy the example environment file:
```bash
cp .example.env .env
```

3. Configure environment variables in `.env`:

**Required Variables:**
- `NEXT_PUBLIC_REOWN_CLOUD_PROJECT_ID` - Your Reown (WalletConnect) project ID
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect project ID for Alchemy
- `CARTESI_PRIVATE_KEY` - Private key from the loan-pool repo (starts with 0x)
- `NEXT_PUBLIC_ALCHEMY_API_KEY` - Alchemy API key for Account Kit
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `POSTGRES_URL` - PostgreSQL connection string
- `PLAID_CLIENT_ID` - Plaid client ID for bank verification
- `PLAID_SECRET` - Plaid secret key
- `TEMPLATE_ID` - Identity verification template ID
- `NEXTAUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)

**Optional (Development):**
- `DISABLE_SBT_CHECKS="true"` - Bypass soulbound token checks during development

4. Start PostgreSQL database (if using Docker):
```bash
docker compose up db
```

5. Install dependencies:
```bash
npm install --legacy-peer-deps
```

6. Run database migrations:
```bash
npx prisma generate && npx prisma migrate dev
```

7. (Optional) Seed the database with sample pools:
```bash
npx tsx prisma/seed-pools.ts
```

8. Start the development server:
```bash
npm run dev
```

9. Open [http://localhost:3000](http://localhost:3000) in your browser

## User Roles

### Borrower (Default)
- Apply for loans
- Connect bank accounts via Plaid
- Submit identity verification
- Track loan status

### Investor
- Browse and invest in lending pools
- Track portfolio performance
- Earn yields from loans
- Withdraw earnings

### Approver/Admin
- Review and approve loan applications
- Manage lending pools
- Access platform analytics
- Monitor system health

## Wallet Integration

The platform supports multiple wallet connection methods:

### Alchemy Account Kit
- **Embedded Wallets**: Email-based wallets with passkey support
- **External Wallets**: MetaMask, Rainbow, Trust Wallet, Rabby, WalletConnect

### Supported Networks
- Arbitrum (Primary)
- Ethereum Mainnet
- Base (Testnet support)

## API Endpoints

### Pools
- `GET /api/pools/public` - List all public pools
- `GET /api/pools/public/[slug]` - Get pool details
- `POST /api/pools/stake` - Stake in a pool
- `POST /api/pools/unstake` - Withdraw from a pool
- `GET /api/pools/[id]/user-stake` - Get user's stake in a pool

### Portfolio
- `GET /api/portfolio/stakes` - Get user's active stakes

### Transactions
- `GET /api/stake-transactions` - Get stake transaction history

### Admin
- `GET /api/pools` - List all pools (admin)
- `POST /api/pools` - Create new pool
- `PUT /api/pools/[id]` - Update pool
- `DELETE /api/pools/[id]` - Archive pool

## Database Schema

### Core Tables
- `users` - User accounts and profiles
- `loan_pools` - Lending pool configurations
- `user_stakes` - Investor stakes in pools
- `stake_transactions` - Transaction history
- `loan_requests` - Borrower loan applications
- `accounts` - NextAuth account linking

## Processing Notices (Cartesi Integration)

Notices from the Cartesi machine are processed via CRON job on Vercel.

**Manual Trigger:**
```bash
curl http://localhost:3000/api/cron/notices \
  -H "Authorization: Bearer {CRON_SECRET}"
```

## Production Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Setup
- Production database: Use Supabase or managed PostgreSQL
- Cartesi node: Deploy to production Cartesi network
- CRON jobs: Configure via Vercel cron configuration

## Development

### Build for Production
```bash
npm run build
```

### Run Production Build Locally
```bash
npm run start
```

### Database Operations
```bash
# Generate Prisma client
npx prisma generate

# Create new migration
npx prisma migrate dev --name migration_name

# Push schema without migration (dev only)
npx prisma db push

# Open Prisma Studio
npx prisma studio
```

### Code Quality
```bash
# Run linter
npm run lint

# Run type checking
npx tsc --noEmit
```

## Security

- All sensitive configuration is managed via environment variables
- No secrets are committed to the repository
- API routes validate user authentication and authorization
- Database queries use Prisma ORM to prevent SQL injection
- NextAuth handles secure session management
- Soulbound NFTs verify investor/borrower status (can be disabled in development)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of the Locale Network ecosystem.

## Links

- [Loan Pool Smart Contracts](https://github.com/Locale-Network/loan-pool)
- [Cartesi Documentation](https://docs.cartesi.io/)
- [Alchemy Account Kit](https://www.alchemy.com/account-kit)
- [Supabase](https://supabase.com/)

## Support

For issues and questions:
- Open an issue on GitHub
- Contact the Locale Network team
