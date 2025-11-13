export const runtime = 'nodejs';

import { NextAuthOptions, PagesOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { SiweMessage, generateNonce } from 'siwe';
import prisma from '@prisma/index';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { Role } from '@prisma/client';
import { getCsrfToken } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';
import { authPages } from './auth-pages';

const NEXTAUTH_URL = process.env.NEXTAUTH_URL as string;
// if (!NEXTAUTH_URL) {
//   throw new Error('NEXTAUTH_URL is not set');
// }

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET as string;
// if (!NEXTAUTH_SECRET) {
//   throw new Error('NEXTAUTH_SECRET is not set');
// }

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Alchemy Account Kit provider (no signature required - Alchemy handles auth)
    CredentialsProvider({
      id: 'alchemy',
      name: 'Alchemy',
      credentials: {
        address: {
          label: 'Address',
          type: 'text',
          placeholder: '0x0',
        },
        alchemyUserId: {
          label: 'Alchemy User ID',
          type: 'text',
        },
        email: {
          label: 'Email',
          type: 'text',
        },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.address) {
            return null;
          }

          // Determine auth provider based on available data
          let authProvider = 'wallet'; // Default for external wallets
          if (credentials.email) {
            authProvider = credentials.email.includes('@') ? 'email' : 'social';
          }

          // Find or create the account in the database
          let chainAccount = await prisma.account.findUnique({
            where: {
              address: credentials.address,
            },
          });

          // If account doesn't exist, create it with all available Alchemy data
          if (!chainAccount) {
            chainAccount = await prisma.account.create({
              data: {
                address: credentials.address,
                role: 'INVESTOR',
                alchemyUserId: credentials.alchemyUserId || null,
                email: credentials.email || null,
                authProvider,
              },
            });
          } else if (!chainAccount.alchemyUserId && credentials.alchemyUserId) {
            // Update existing account with Alchemy data if not already set
            chainAccount = await prisma.account.update({
              where: { address: credentials.address },
              data: {
                alchemyUserId: credentials.alchemyUserId,
                email: credentials.email || chainAccount.email,
                authProvider: authProvider,
              },
            });
          }

          return {
            id: chainAccount.address,
            role: chainAccount.role,
          };
        } catch (e) {
          console.error('Alchemy auth error:', e);
          return null;
        }
      },
    }),
    // SIWE provider (for traditional wallet connections)
    CredentialsProvider({
      id: 'ethereum',
      name: 'Ethereum',
      credentials: {
        message: {
          label: 'Message',
          type: 'text',
          placeholder: '0x0',
        },
        signature: {
          label: 'Signature',
          type: 'text',
          placeholder: '0x0',
        },
      },
      async authorize(credentials, req) {
        try {
          const siwe = new SiweMessage(JSON.parse(credentials?.message || '{}'));
          const nextAuthUrl = new URL(NEXTAUTH_URL);

          const result = await siwe.verify({
            signature: credentials?.signature || '',
            domain: nextAuthUrl.host,
            nonce: siwe.nonce,
          });

          if (!result.success) {
            return null;
          }

          const chainAccount = await prisma.account.findUnique({
            where: {
              address: siwe.address,
            },
          });

          const role = chainAccount?.role || 'INVESTOR';

          return {
            id: siwe.address,
            role,
          };
        } catch (e) {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours - session is updated this often
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: authPages,
  secret: NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      session.address = token.sub;
      session.user.name = token.sub;
      session.user.role = token.role ?? Role.INVESTOR;

      return session;
    },
    async jwt({ token, user, trigger, session, account }) {
      if (user) {
        token.role = user.role;
      }

      if (trigger === 'update') {
        token.role = session.user.role;
      }

      // Ensure token persists across page reloads
      if (account) {
        token.accessToken = account.access_token;
      }

      return token;
    },
  },
  debug: process.env.NODE_ENV === 'development',
};
