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
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    name: string;
    email: string;
    role: $Enums.Role;
  }
}