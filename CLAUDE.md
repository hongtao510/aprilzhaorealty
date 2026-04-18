# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # Next.js dev server (use port 3001 locally)
npm run build   # Production build
npm start       # Start built app
npm run lint    # ESLint (extends eslint-config-next core-web-vitals + typescript)
```

There is no test runner configured — verify changes by running the dev server and exercising the feature in a browser.

Local dev: run on port 3001 (`npm run dev -- -p 3001`), not the default 3000.

## Architecture

Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript, deployed on Vercel. Data lives in Supabase (Postgres + Auth + Storage); static Listing content lives in `src/lib/data.ts`. Email via Resend. Claude API used for the Find Comps CMA feature.

### Route groups (`src/app`)

- `(public)` — marketing pages (`/`, `/listings`, `/about`, `/contact`, `/testimonials`). Uses the hardcoded `listings` array in `src/lib/data.ts` as the source of truth for April's past transactions.
- `(auth)/login` — Supabase-auth login.
- `(portal)/portal` — authenticated client-facing portal (saved homes, materials, messages, search).
- `(portal)/admin` — admin portal (candidates, clients, comps, saved-homes, search). Gated by `profiles.role = 'admin'` in middleware.
- `api/` — route handlers split into `admin`, `portal`, `cron`, `contact`, `auth`, `newsletter`. Admin and portal endpoints check roles themselves; middleware only guarantees authentication on those paths.
- `comps/[id]` — public CMA report view.

### Middleware (`src/middleware.ts`)

Central gate for auth + role-based redirects. Wraps Supabase calls in a 3-second timeout (`withTimeout`) so a Supabase outage can't cause Vercel 504s — on timeout it falls through and lets pages handle auth client-side. `publicRoutes` lists prefixes that bypass Supabase entirely. Role check queries `profiles.role`; admin → `/admin`, client → `/portal`.

### Supabase clients (`src/lib/supabase/`)

Four flavors — pick based on execution context:
- `client.ts` — browser (cached singleton via `createBrowserClient`).
- `server.ts` — RSC / route handler cookie-aware client (`createServerClient`).
- `middleware.ts` — middleware-scoped client with cookie forwarding (`updateSession`).
- `admin.ts` — service-role client (`SUPABASE_SERVICE_ROLE_KEY`) for privileged writes; use ONLY in route handlers/cron, never shipped to the browser.

`src/lib/supabase.ts` is a legacy anon client kept for existing `comments` helpers — new code should import from one of the four above.

### Redfin integration

- `src/lib/redfin-listings.ts` — scrapes active for-sale listings from Redfin's `stingray/api/gis-csv` endpoint for a fixed list of `FEATURED_CITIES` (San Mateo through Redwood City) using bounding-box polygons. Parses the CSV directly.
- `src/lib/redfin-scraper.ts` — scrapes recently sold comps by zip for the Find Comps feature. Resolves zip → bounds via Redfin autocomplete when the zip isn't in `ZIP_BOUNDS`. Whole pipeline wrapped in a 20s timeout; on failure returns `source: "claude-knowledge"` so the caller falls back to Claude's training data.

### Daily listings cron (`/api/cron/scrape-listings`)

Scheduled by `vercel.json` (`0 15 * * *` = 8am PT). Flow:
1. Reset all `is_new` flags to false.
2. Scrape every city in `FEATURED_CITIES`, dedupe by `redfin_url`.
3. Batch upsert into `redfin_listings` in chunks of 50 (chunking avoids PostgREST `.in()` limits and individual-query timeouts).
4. Mark listings not seen today as `off-market`.
5. For each new listing, fetch the first photo from the Redfin page HTML.
6. Send a digest email via Resend to `CONTACT_EMAIL` recipients.

`maxDuration = 60` (Vercel Hobby limit). Protected by `CRON_SECRET` bearer token.

### Find Comps (CMA) flow

`/api/admin/candidate-homes/[id]/comps` takes a candidate home, calls the Anthropic SDK (`@anthropic-ai/sdk`) with the housing-comparisons prompt, caches the structured `CompsResult` in the `candidate_comps` table for 7 days, and renders it in `CompsModal` + the public `/comps/[id]` page. Model selectable via query param (defaults to `claude-opus-4-6`). See `docs/plans/2026-03-07-find-comps-feature-design.md` for the full design.

### Database schema

Authoritative SQL lives at the repo root:
- `supabase-setup.sql` — `profiles`, `materials`, `messages`, plus the `handle_new_user` trigger that creates a profile on signup.
- `supabase-candidate-homes.sql` / `supabase-candidate-homes-rentcast.sql` — admin candidate homes + valuation columns.
- `supabase-candidate-comps.sql` — Find Comps cache.
- `supabase-redfin-listings.sql` — daily scraped listings.

Matching TypeScript row types live in `src/lib/types.ts`.

### Env vars (see `.env.example`)

Required for full functionality: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CONTACT_EMAIL`, `CRON_SECRET`, `ANTHROPIC_API_KEY`. Analytics: `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

## Conventions

- Path alias `@/*` → `src/*`.
- Static images referenced from `public/images/` — Next.js image remote pattern only allows `images.unsplash.com`.
- Never widen `publicRoutes` without also confirming the page doesn't need auth — adding a prefix there bypasses middleware entirely.
- When adding a Supabase query inside middleware or edge-adjacent code, wrap it in `withTimeout` (3s) so Supabase latency can't produce 504s.
- When adding bulk Supabase operations (scrape/backfill), chunk at 50 rows per `.in()`/`.upsert()` call.
