import 'next-auth';
import { Role } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      role: Role;
    };
    address?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role;
  }
}