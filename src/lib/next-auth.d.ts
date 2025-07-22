import NextAuth from 'next-auth';
import { GritUser } from './GritUser';
import { $Enums } from '@/generated/prisma';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: $Enums.Role;
    };
  }

  interface User extends GritUser {}
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    name: string;
    email: string;
    role: $Enums.Role;
  }
}