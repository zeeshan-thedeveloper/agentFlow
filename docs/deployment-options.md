# Deployment Options (Zero / Low Cost)

## Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 |
| Backend | NestJS + BullMQ |
| Database | PostgreSQL (Prisma) |
| Cache / Queue | Redis (BullMQ) |
| Auth | NextAuth + Google OAuth |

---

## Option A — Fully Free (Recommended to Start)

| Service | Hosts | Free Tier |
|---|---|---|
| [Vercel](https://vercel.com) | Next.js frontend | Unlimited hobby projects, custom domain |
| [Railway](https://railway.app) | NestJS API | $5/mo credit (covers small API at idle) |
| [Neon](https://neon.tech) | PostgreSQL | 512 MB free forever, no cold starts |
| [Upstash](https://upstash.com) | Redis (BullMQ) | 10k commands/day free |

**Estimated cost: ~$0/mo** for low traffic. Railway's $5 credit is enough for a small API.

---

## Option B — Fully Free (with trade-offs)

| Service | Hosts | Catch |
|---|---|---|
| [Vercel](https://vercel.com) | Next.js frontend | None |
| [Render](https://render.com) | NestJS API | Spins down after 15 min idle (~30s cold start) |
| [Supabase](https://supabase.com) | PostgreSQL | 500 MB free, pauses after 1 week inactivity |
| [Upstash](https://upstash.com) | Redis (BullMQ) | 10k commands/day free |

**Estimated cost: $0/mo** but cold-starts on Render will feel sluggish.

---

## Option C — Consolidate on Railway (~$5/mo)

Run NestJS + PostgreSQL + Redis all in one Railway project.

- No sleep / cold-start issues
- One dashboard for all services
- $5/mo credit covers all three at low usage

---

## Recommendation

**Start with Option A** — Vercel + Railway + Neon + Upstash.

### Steps

1. Push repo to GitHub
2. Connect `apps/web` to Vercel (auto-detects Next.js)
3. Deploy `apps/api` to Railway (`railway up`)
4. Create a Neon database — copy `DATABASE_URL`
5. Create an Upstash Redis — copy URL for BullMQ

### Environment Variables to Set

**Vercel (frontend)**
```
DATABASE_URL=<neon connection string>
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<random secret>
GOOGLE_CLIENT_ID=<from Google Cloud>
GOOGLE_CLIENT_SECRET=<from Google Cloud>
```

**Railway (API)**
```
DATABASE_URL=<same neon connection string>
REDIS_URL=<upstash redis url>
PORT=3000
```

> Both `apps/api` and `apps/web` use Prisma — make sure both point to the same `DATABASE_URL`.
