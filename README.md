# April Zhao Realty

A real estate website for April Zhao, Bay Area Realtor.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) (React)
- **Hosting**: [Vercel](https://vercel.com)
- **Domain**: [Cloudflare](https://cloudflare.com)
- **Email**: [Resend](https://resend.com) (account: april)

## Getting Started

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.
From another computer on the same network, open
`http://<your-mac-mini-local-ip>:3000`. The dev server listens on all local
network interfaces.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the Supabase, Resend, OpenAI,
analytics, contact-email, and cron values. `SUPABASE_SERVICE_ROLE_KEY` is
server-only and must never use a `NEXT_PUBLIC_` prefix.

For an existing Supabase project, run `supabase-security-hardening.sql` in the
Supabase SQL Editor before deploying these changes. It removes the unsafe
profile-update policy and installs the persistent API rate limiter.

## Verification

```bash
npm run check
```

This runs lint, TypeScript, unit tests, and the production build. Run
`npm run audit:prod` separately to query npm's live production advisory data.

## Deployment

The site auto-deploys to Vercel on push to `main` branch.
