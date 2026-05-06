import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';

const hasGoogleOAuth =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
  process.env.GOOGLE_CLIENT_ID !== 'replace-with-google-oauth-client-id' &&
  process.env.GOOGLE_CLIENT_SECRET !== 'replace-with-google-oauth-client-secret';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  providers: [
    ...(hasGoogleOAuth
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          }),
        ]
      : [
          CredentialsProvider({
            id: 'demo',
            name: 'Demo',
            credentials: {},
            async authorize() {
              if (process.env.NODE_ENV === 'production') return null;

              return prisma.user.upsert({
                where: {
                  email: 'demo@agentflow.local',
                },
                update: {},
                create: {
                  email: 'demo@agentflow.local',
                  name: 'Demo User',
                },
              });
            },
          }),
        ]),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
      }

      return session;
    },
  },
};
