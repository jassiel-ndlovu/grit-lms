import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { JWT } from "next-auth/jwt";
import { User } from "next-auth";

const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<GritUser | null> {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("No user found with this email.");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Invalid password.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        } as GritUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
        // @ts-expect-error name throws error
        token.name = user.name;
        // @ts-expect-error email throws error
        token.email = user.email;
        // @ts-expect-error role throws error
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
    signOut: "/",
  },
  events: {
    async signOut({ token }) {
      console.log(`User ${token.email} signed out`);
    }
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
