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
    CredentialsProvider({
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

          const role = chainAccount?.role || 'BORROWER';

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
  },
  pages: authPages,
  secret: NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      session.address = token.sub;
      session.user.name = token.sub;
      session.user.role = token.role ?? Role.BORROWER;

      return session;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
      }

      if (trigger === 'update') {
        token.role = session.user.role;
      }

      return token;
    },
  },
  debug: process.env.NODE_ENV === 'development',
};
