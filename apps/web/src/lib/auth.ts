import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';

export function hasGoogleOAuth(): boolean {
  return (
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
    process.env.GOOGLE_CLIENT_ID !== 'replace-with-google-oauth-client-id' &&
    process.env.GOOGLE_CLIENT_SECRET !== 'replace-with-google-oauth-client-secret'
  );
}

export function hasGitHubOAuth(): boolean {
  return (
    Boolean(process.env.GITHUB_CLIENT_ID) &&
    Boolean(process.env.GITHUB_CLIENT_SECRET) &&
    process.env.GITHUB_CLIENT_ID !== 'replace-with-github-oauth-client-id' &&
    process.env.GITHUB_CLIENT_SECRET !== 'replace-with-github-oauth-client-secret'
  );
}

const hasAnyOAuth = hasGoogleOAuth() || hasGitHubOAuth();

const oauthProviderOptions = {
  allowDangerousEmailAccountLinking: true,
} as const;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  providers: [
    ...(hasGoogleOAuth()
      ? [
          GoogleProvider({
            ...oauthProviderOptions,
            clientId: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          }),
        ]
      : []),
    ...(hasGitHubOAuth()
      ? [
          GitHubProvider({
            ...oauthProviderOptions,
            clientId: process.env.GITHUB_CLIENT_ID ?? '',
            clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
            authorization: { params: { scope: 'read:user user:email' } },
          }),
        ]
      : []),
    ...(!hasAnyOAuth
      ? [
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
        ]
      : []),
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
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;

        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { name: true, email: true, image: true },
        });

        if (dbUser) {
          session.user.name = dbUser.name;
          session.user.email = dbUser.email;
          session.user.image = dbUser.image;
        }
      }

      return session;
    },
  },
};
