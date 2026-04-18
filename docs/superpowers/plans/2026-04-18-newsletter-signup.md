# Newsletter Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship public self-signup + per-city newsletter preferences + daily digest fan-out with one-click unsubscribe.

**Architecture:** Email+password signup via Supabase auth. `profiles.newsletter_cities text[]` holds each user's selected cities from the existing 6-city superset. The existing daily scrape cron gains a fan-out step that personalizes the digest per user. Unsubscribe is token-based, one-click, and surfaced both as a visible footer link and via RFC 8058 headers.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (Postgres + Auth + RLS), Resend (batch email), TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-18-newsletter-signup-design.md`

**Verification note:** This project has no test runner. Each task ends with `npm run lint && npm run build` for type/lint safety plus a manual smoke check (browser on http://localhost:4000, `curl`, or Supabase SQL). Dev server is already running on port 4000.

---

## File Structure

```
supabase-newsletter.sql                                         NEW migration
src/middleware.ts                                               MODIFY publicRoutes
src/app/(public)/privacy/page.tsx                               NEW
src/app/(auth)/signup/page.tsx                                  NEW
src/app/(auth)/login/page.tsx                                   MODIFY add signup link
src/app/api/portal/newsletter/route.ts                          NEW
src/app/api/newsletter/unsubscribe/route.ts                     NEW
src/lib/email-templates.ts                                      MODIFY add digest builder
src/app/(portal)/portal/page.tsx                                REWRITE
src/app/api/cron/scrape-listings/route.ts                       MODIFY fan-out
src/components/ClientLayout.tsx                                 MODIFY footer form → /signup
CLAUDE.md                                                       MODIFY document flow
```

---

### Task 1: Supabase migration — newsletter columns, index, RLS

**Files:**
- Create: `supabase-newsletter.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================
-- Newsletter Signup Migration
-- Run this in the Supabase SQL Editor
-- Adds per-user city preferences + unsubscribe token
-- ============================================

alter table public.profiles
  add column if not exists newsletter_cities text[] not null default '{}',
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

-- Backfill tokens for any existing rows that predate the default
update public.profiles
set unsubscribe_token = gen_random_uuid()
where unsubscribe_token is null;

-- Partial GIN index — only rows with at least one subscribed city
create index if not exists idx_profiles_newsletter_subscribed
  on public.profiles using gin(newsletter_cities)
  where array_length(newsletter_cities, 1) > 0;

create unique index if not exists idx_profiles_unsubscribe_token
  on public.profiles(unsubscribe_token);

-- Let authenticated users update their own profile (needed for city toggle)
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

- [ ] **Step 2: Apply the migration**

Open the Supabase dashboard for this project, go to **SQL Editor**, paste the contents of `supabase-newsletter.sql`, and run it.

- [ ] **Step 3: Verify columns + RLS**

In the SQL editor run:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema='public' and table_name='profiles'
  and column_name in ('newsletter_cities','unsubscribe_token');

select policyname from pg_policies
where schemaname='public' and tablename='profiles'
  and policyname='Users can update own profile';
```

Expected: two column rows (text[]/uuid), one policy row.

- [ ] **Step 4: Commit**

```bash
git add supabase-newsletter.sql
git commit -m "feat(db): add newsletter_cities + unsubscribe_token to profiles"
```

---

### Task 2: Supabase config — disable email confirmations

**Files:** none (dashboard change)

- [ ] **Step 1: Flip the toggle**

Supabase Dashboard → **Authentication → Sign In / Providers → Email** → turn **OFF** "Confirm email". Save.

- [ ] **Step 2: Verify via a test signup**

```bash
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest+conf@example.com","password":"testpass123"}' | jq '.user.id, .session.access_token'
```

Expected: both fields present (non-null `access_token` means auto-login works). Delete this user in the Supabase dashboard afterward.

---

### Task 3: Middleware — mark new public routes

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add routes to publicRoutes**

Edit `src/middleware.ts`, find the `publicRoutes` array (around line 13), and add `/signup` and `/privacy`:

```ts
const publicRoutes = [
  "/",
  "/listings",
  "/about",
  "/contact",
  "/testimonials",
  "/privacy",
  "/signup",
  "/api/contact",
  "/api/auth",
  "/api/cron",
  "/api/newsletter",
];
```

- [ ] **Step 2: Type check**

```bash
npm run lint && npm run build
```

Expected: exits 0, no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "chore(middleware): allow /signup and /privacy without auth"
```

---

### Task 4: Privacy page

**Files:**
- Create: `src/app/(public)/privacy/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How April Zhao Realty handles your information.",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
      <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">Privacy</p>
      <h1 className="font-serif text-4xl text-neutral-900 mb-8">Privacy Policy</h1>
      <div className="w-16 h-0.5 bg-[#d4a012] mb-10" />

      <div className="space-y-6 text-neutral-700 leading-relaxed">
        <p>
          When you create an account on aprilzhaohome.com we collect your email,
          name, and (optionally) phone number. We use this information to run your
          account and to email you new Bay Area real-estate listings that match
          the cities you select.
        </p>
        <p>
          We never sell your information. We share it only with service providers
          needed to operate the site (Supabase for data storage, Resend for email).
        </p>
        <p>
          You can unsubscribe from every email using the one-click link in the
          footer of each message, or change your city preferences at any time from
          your <a href="/portal" className="text-[#d4a012] underline">portal dashboard</a>.
          To delete your account, email{" "}
          <a href="mailto:aprilcasf@gmail.com" className="text-[#d4a012] underline">
            aprilcasf@gmail.com
          </a>.
        </p>
        <p className="text-sm text-neutral-500">
          Last updated: April 2026.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Smoke test**

Open http://localhost:4000/privacy in a browser. Expected: page renders with the privacy text and styling matches the rest of the site (gold accent, serif headline).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/privacy/page.tsx
git commit -m "feat(privacy): add public privacy page"
```

---

### Task 5: Signup page

**Files:**
- Create: `src/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create the signup page**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("Please agree to the Privacy Policy to continue.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        },
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    // With email confirmations disabled, signUp returns a session; redirect.
    if (data.session) {
      router.push("/portal");
      router.refresh();
    } else {
      // Fallback: confirmations re-enabled at the project level
      setError(
        "Account created — please check your email to confirm before signing in."
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-neutral-100 bg-white/98 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center">
          <Link href="/" className="flex flex-col group">
            <div className="font-serif text-2xl font-normal tracking-wide text-neutral-900">
              <span className="text-[#d4a012]">April</span> Zhao
            </div>
            <span className="text-[10px] text-[#d4a012] tracking-[0.15em] uppercase">
              Expertise. Ethics. Excellence.
            </span>
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">
              Join April Zhao Realty
            </p>
            <h1 className="font-serif text-4xl text-neutral-900 mb-4">
              Create Account
            </h1>
            <div className="w-16 h-0.5 bg-[#d4a012] mx-auto mb-6" />
            <p className="text-neutral-500 text-sm">
              Sign up to receive daily listings in the Bay Area cities you care about.
            </p>
          </div>

          <div className="bg-neutral-50 p-8 md:p-10">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700">
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-6">
              <div>
                <label htmlFor="full_name" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                  Full Name <span className="text-[#d4a012]">*</span>
                </label>
                <input
                  type="text"
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                  Email <span className="text-[#d4a012]">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                  Password <span className="text-[#d4a012]">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                  Phone <span className="text-neutral-400 normal-case">(optional)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                  placeholder="(555) 555-1234"
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-neutral-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                  className="mt-1 accent-[#d4a012]"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/privacy" className="text-[#d4a012] underline">
                    Privacy Policy
                  </Link>{" "}
                  and to receive listing emails. I can unsubscribe anytime.
                </span>
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-12 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300 disabled:opacity-50"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </button>
              </div>
            </form>

            <p className="text-sm text-neutral-500 text-center mt-8">
              Already have an account?{" "}
              <Link href="/login" className="text-[#d4a012] hover:text-[#b8890f] transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <div className="text-center mt-8">
            <Link
              href="/"
              className="text-neutral-400 text-sm hover:text-neutral-900 transition-colors uppercase tracking-wider"
            >
              &larr; Back to Website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npm run lint && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Smoke test**

Open http://localhost:4000/signup. Create a test account with a real throwaway email (e.g. `tester+plan@example.com` + password `testpass123`). Expected: redirects to `/portal`.

In Supabase SQL editor:

```sql
select email, full_name, phone, role, newsletter_cities, unsubscribe_token
from profiles
where email='tester+plan@example.com';
```

Expected: one row, `role='client'`, `newsletter_cities='{}'`, non-null `unsubscribe_token`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/signup/page.tsx
git commit -m "feat(auth): add public signup page"
```

---

### Task 6: Login page — link to signup

**Files:**
- Modify: `src/app/(auth)/login/page.tsx` (after the login form, near the "Back to Website" link)

- [ ] **Step 1: Add a "Create account" link**

In `src/app/(auth)/login/page.tsx`, locate the login form's `</form>` closing tag at line ~240 (the one that closes the `handleLogin` form). Immediately after the closing `</form>`, before the wrapping `</div>` that closes `bg-neutral-50`, add:

```tsx
              <p className="text-sm text-neutral-500 text-center mt-8">
                New here?{" "}
                <Link href="/signup" className="text-[#d4a012] hover:text-[#b8890f] transition-colors">
                  Create an account
                </Link>
              </p>
```

(`Link` is already imported.)

- [ ] **Step 2: Type check**

```bash
npm run lint && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Smoke test**

Open http://localhost:4000/login. Expected: "Create an account" link appears below the Sign In button and routes to `/signup`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx
git commit -m "feat(auth): link login page to signup"
```

---

### Task 7: POST /api/portal/newsletter — update user's cities

**Files:**
- Create: `src/app/api/portal/newsletter/route.ts`

- [ ] **Step 1: Create the endpoint**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FEATURED_CITIES } from "@/lib/redfin-listings";

const VALID_CITIES = new Set(FEATURED_CITIES.map((c) => c.name));

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cities: unknown = body?.cities;

  if (!Array.isArray(cities) || !cities.every((c): c is string => typeof c === "string")) {
    return NextResponse.json(
      { error: "Invalid payload: expected { cities: string[] }" },
      { status: 400 }
    );
  }

  // Deduplicate + reject unknown cities (don't silently drop — surface it)
  const unique = Array.from(new Set(cities));
  const invalid = unique.filter((c) => !VALID_CITIES.has(c));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Unknown cities: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ newsletter_cities: unique })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }

  return NextResponse.json({ cities: unique });
}
```

- [ ] **Step 2: Type check**

```bash
npm run lint && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Smoke test**

With the tester account from Task 5 still logged in (cookies in browser), from the browser DevTools console:

```js
fetch("/api/portal/newsletter", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cities: ["Belmont", "San Mateo"] }),
}).then((r) => r.json()).then(console.log);
```

Expected: `{ cities: ["Belmont", "San Mateo"] }`.

Then in Supabase SQL:

```sql
select newsletter_cities from profiles where email='tester+plan@example.com';
```

Expected: `{Belmont,"San Mateo"}`.

Also verify validation:

```js
fetch("/api/portal/newsletter", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cities: ["Atlantis"] }),
}).then((r) => r.json()).then(console.log);
```

Expected: `{ error: "Unknown cities: Atlantis" }`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portal/newsletter/route.ts
git commit -m "feat(api): POST /api/portal/newsletter to update user cities"
```

---

### Task 8: GET/POST /api/newsletter/unsubscribe — token-based one-click

**Files:**
- Create: `src/app/api/newsletter/unsubscribe/route.ts`

- [ ] **Step 1: Create the endpoint**

```ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleUnsubscribe(token: string | null) {
  const tokenValid = !!token && UUID_RE.test(token);

  if (tokenValid) {
    const supabase = createAdminClient();
    // Idempotent: set to empty array regardless of current state
    await supabase
      .from("profiles")
      .update({ newsletter_cities: [] })
      .eq("unsubscribe_token", token);
  }

  // Always render the same page so token existence isn't leaked
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Unsubscribed — April Zhao Realty</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { margin:0; padding:0; background:#f5f5f0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; }
  .wrap { max-width:560px; margin:80px auto; background:#fff; padding:56px 32px; text-align:center; border-top:3px solid #d4a012; }
  h1 { font-family: "Playfair Display", Georgia, serif; font-size:28px; color:#1a1a1a; margin:0 0 12px; font-weight:500; }
  p { color:#666; font-size:15px; line-height:1.6; margin:0 0 16px; }
  a { color:#d4a012; text-decoration:underline; }
  .eyebrow { font-size:11px; letter-spacing:3px; color:#d4a012; text-transform:uppercase; margin-bottom:8px; }
</style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">April Zhao Realty</p>
    <h1>You've been unsubscribed</h1>
    <p>You'll no longer receive new-listing emails from us.</p>
    <p>Changed your mind? <a href="/login">Sign in</a> and pick the cities you want to hear about.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  return handleUnsubscribe(request.nextUrl.searchParams.get("token"));
}

// RFC 8058 One-Click unsubscribe — Gmail/Apple Mail POST here
export async function POST(request: NextRequest) {
  return handleUnsubscribe(request.nextUrl.searchParams.get("token"));
}
```

- [ ] **Step 2: Type check**

```bash
npm run lint && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Smoke test with real token**

In Supabase SQL, grab the tester's token:

```sql
select unsubscribe_token from profiles where email='tester+plan@example.com';
```

Set the user's cities to something first (if they're empty after Task 7 verification, re-run the fetch from that task). Then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4000/api/newsletter/unsubscribe?token=<PASTE_TOKEN>"
```

Expected: `200`.

Re-check in SQL:

```sql
select newsletter_cities from profiles where email='tester+plan@example.com';
```

Expected: `{}`.

Verify invalid token returns same page:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4000/api/newsletter/unsubscribe?token=not-a-uuid"
```

Expected: `200`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/newsletter/unsubscribe/route.ts
git commit -m "feat(api): one-click unsubscribe endpoint (RFC 8058)"
```

---

### Task 9: Email templates — subscriber digest builder

**Files:**
- Modify: `src/lib/email-templates.ts` (append new function at end)

- [ ] **Step 1: Add the builder**

Append to `src/lib/email-templates.ts`:

```ts
/** Listing row shape passed in from the cron route. */
export interface DigestListing {
  redfin_url: string;
  address: string;
  city: string;
  zip: string | null;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  year_built: number | null;
  days_on_market: number | null;
  image_url: string | null;
}

export interface DigestRecipient {
  email: string;
  full_name: string | null;
  unsubscribe_token: string;
}

/**
 * Build a personalized subscriber digest email.
 * siteUrl should be the canonical site origin, e.g. https://aprilzhaohome.com.
 */
export function buildSubscriberDigestHtml(
  recipient: DigestRecipient,
  listings: DigestListing[],
  siteUrl: string,
): string {
  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(recipient.unsubscribe_token)}`;
  const managePrefsUrl = `${siteUrl}/portal`;

  // Group by city for readability
  const byCity: Record<string, DigestListing[]> = {};
  for (const l of listings) {
    (byCity[l.city] ??= []).push(l);
  }

  let listingsHtml = "";
  for (const [city, rows] of Object.entries(byCity)) {
    listingsHtml += `
      <tr>
        <td style="padding:24px 20px 10px;">
          <h2 style="font-size:13px;color:#d4a012;text-transform:uppercase;letter-spacing:2px;margin:0;border-bottom:1px solid #e5e5e5;padding-bottom:8px;">
            ${escapeHtml(city)} &mdash; ${rows.length} new
          </h2>
        </td>
      </tr>`;

    for (const l of rows) {
      const priceStr = `$${fmt(l.price)}`;
      const details = [
        l.beds ? `${l.beds} bd` : null,
        l.baths ? `${l.baths} ba` : null,
        l.sqft ? `${fmt(l.sqft)} sqft` : null,
        l.year_built ? `Built ${l.year_built}` : null,
      ].filter(Boolean).join(" · ");

      const imageBlock = l.image_url
        ? `<a href="${escapeHtml(l.redfin_url)}" style="text-decoration:none;">
             <img src="${escapeHtml(l.image_url)}" alt="${escapeHtml(l.address)}" style="width:100%;height:200px;object-fit:cover;display:block;border-radius:6px 6px 0 0;" />
           </a>`
        : `<div style="width:100%;height:120px;background:linear-gradient(135deg,#f0ece0,#e8e0cc);border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:center;">
             <span style="font-size:36px;color:#d4a012;">&#8962;</span>
           </div>`;

      listingsHtml += `
      <tr>
        <td style="padding:8px 20px;">
          <div style="border:1px solid #e5e5e5;border-radius:6px;overflow:hidden;">
            ${imageBlock}
            <div style="padding:14px 16px;">
              <a href="${escapeHtml(l.redfin_url)}" style="text-decoration:none;">
                <p style="font-size:22px;font-weight:bold;color:#1a1a1a;margin:0 0 2px 0;">${escapeHtml(priceStr)}</p>
                <p style="font-size:14px;color:#333;margin:0 0 6px 0;">${escapeHtml(l.address)}, ${escapeHtml(l.city)} ${escapeHtml(l.zip ?? "")}</p>
                <p style="font-size:12px;color:#999;margin:0;">${details}${l.days_on_market != null ? ` · ${l.days_on_market}d on market` : ""}</p>
              </a>
            </div>
          </div>
        </td>
      </tr>`;
    }
  }

  const greeting = recipient.full_name
    ? `Hi ${escapeHtml(recipient.full_name.split(" ")[0])},`
    : "Hello,";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <tr>
      <td style="padding:32px 20px 24px;text-align:center;border-bottom:2px solid #d4a012;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#d4a012;margin:0 0 8px 0;">April Zhao Realty</p>
        <h1 style="font-size:24px;color:#1a1a1a;margin:0;font-weight:600;">New Listings in Your Cities</h1>
        <p style="font-size:13px;color:#999;margin:8px 0 0 0;">${today}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 20px 0;">
        <p style="font-size:14px;color:#333;margin:0 0 12px;">${greeting}</p>
        <p style="font-size:14px;color:#666;margin:0 0 4px;">
          ${listings.length} new listing${listings.length !== 1 ? "s" : ""} matched your preferences today.
        </p>
      </td>
    </tr>
    ${listingsHtml}
    <tr>
      <td style="padding:28px 20px 24px;text-align:center;border-top:1px solid #e5e5e5;">
        <p style="font-size:12px;color:#666;margin:0 0 10px;">
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#666;text-decoration:underline;">Unsubscribe from these emails</a>
          &nbsp;·&nbsp;
          <a href="${escapeHtml(managePrefsUrl)}" style="color:#666;text-decoration:underline;">Update city preferences</a>
        </p>
        <p style="font-size:11px;color:#999;margin:0;">Scraped from Redfin · Sent by April Zhao Realty</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 2: Type check**

```bash
npm run lint && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email-templates.ts
git commit -m "feat(email): subscriber digest template with unsubscribe footer"
```

---

### Task 10: Portal dashboard rewrite — city picker

**Files:**
- Rewrite: `src/app/(portal)/portal/page.tsx`

- [ ] **Step 1: Replace the page with the newsletter dashboard**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FEATURED_CITIES } from "@/lib/redfin-listings";
import { NewsletterPreferences } from "./NewsletterPreferences";

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/portal");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, newsletter_cities")
    .eq("id", user.id)
    .single();

  const cities = FEATURED_CITIES.map((c) => c.name);
  const selected = (profile?.newsletter_cities ?? []) as string[];
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
      <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">
        Your Portal
      </p>
      <h1 className="font-serif text-4xl text-neutral-900 mb-3">
        Welcome back, {firstName}
      </h1>
      <div className="w-16 h-0.5 bg-[#d4a012] mb-8" />

      <section className="bg-neutral-50 p-8 md:p-10 mb-10">
        <h2 className="font-serif text-2xl text-neutral-900 mb-2">
          Listing Newsletter
        </h2>
        <p className="text-neutral-500 text-sm mb-8">
          Select the Bay Area cities you&apos;d like to receive new-listing emails for.
          We&apos;ll send a digest each morning when there are new listings in your
          selected cities.
        </p>
        <NewsletterPreferences cities={cities} initialSelected={selected} />
      </section>

      <section>
        <h2 className="font-serif text-xl text-neutral-900 mb-4">
          Concierge features
        </h2>
        <p className="text-neutral-500 text-sm mb-4">
          Invited clients can access additional services:
        </p>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="/portal/saved-homes" className="text-[#d4a012] underline">Saved homes</a>
          </li>
          <li>
            <a href="/portal/messages" className="text-[#d4a012] underline">Messages</a>
          </li>
          <li>
            <a href="/portal/materials" className="text-[#d4a012] underline">Materials</a>
          </li>
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Create the client component**

Create `src/app/(portal)/portal/NewsletterPreferences.tsx`:

```tsx
"use client";

import { useState } from "react";

interface Props {
  cities: string[];
  initialSelected: string[];
}

export function NewsletterPreferences({ cities, initialSelected }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const initialSet = new Set(initialSelected);
  const dirty =
    selected.size !== initialSet.size ||
    Array.from(selected).some((c) => !initialSet.has(c));

  function toggle(city: string) {
    const next = new Set(selected);
    if (next.has(city)) next.delete(city);
    else next.add(city);
    setSelected(next);
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/portal/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cities: Array.from(selected) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMessage({ kind: "err", text: data?.error ?? "Failed to save." });
      setSaving(false);
      return;
    }
    setMessage({ kind: "ok", text: "Preferences saved." });
    setSaving(false);
  }

  async function unsubscribeAll() {
    if (!confirm("Unsubscribe from all new-listing emails?")) return;
    setSelected(new Set());
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/portal/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cities: [] }),
    });
    if (!res.ok) {
      setMessage({ kind: "err", text: "Failed to unsubscribe." });
      setSaving(false);
      return;
    }
    setMessage({ kind: "ok", text: "You've been unsubscribed from all cities." });
    setSaving(false);
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {cities.map((city) => (
          <label key={city} className="flex items-center gap-3 cursor-pointer p-3 border border-neutral-200 hover:border-[#d4a012] transition-colors bg-white">
            <input
              type="checkbox"
              checked={selected.has(city)}
              onChange={() => toggle(city)}
              className="accent-[#d4a012]"
            />
            <span className="text-sm text-neutral-900">{city}</span>
          </label>
        ))}
      </div>

      {message && (
        <p className={`text-sm mb-4 ${message.kind === "ok" ? "text-[#d4a012]" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="px-12 py-3 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-colors disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
        <button
          type="button"
          onClick={unsubscribeAll}
          disabled={selected.size === 0 && initialSet.size === 0}
          className="px-12 py-3 border border-neutral-300 text-neutral-600 text-xs font-medium uppercase tracking-[0.15em] hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
        >
          Unsubscribe from all
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type check**

```bash
npm run lint && npm run build
```

Expected: exits 0.

- [ ] **Step 4: Smoke test**

As the Task 5 tester (logged in), visit http://localhost:4000/portal. Expected:
- Greeting shows first name.
- Six city checkboxes, some checked (Belmont + San Mateo from Task 7 smoke if still set).
- Toggling a checkbox enables the Save button.
- Clicking Save → green "Preferences saved." message.
- Clicking "Unsubscribe from all" → confirms, clears checkboxes, shows success message.

Verify in SQL:

```sql
select newsletter_cities from profiles where email='tester+plan@example.com';
```

Expected: `{}` after unsubscribe-all.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(portal\)/portal/page.tsx src/app/\(portal\)/portal/NewsletterPreferences.tsx
git commit -m "feat(portal): newsletter city-picker dashboard"
```

---

### Task 11: Cron — subscriber fan-out

**Files:**
- Modify: `src/app/api/cron/scrape-listings/route.ts`

- [ ] **Step 1: Add fan-out logic**

In `src/app/api/cron/scrape-listings/route.ts`, add the following to the top of the file (below the existing imports):

```ts
import { buildSubscriberDigestHtml, type DigestListing } from "@/lib/email-templates";
```

Then, inside `GET(request)`, locate the existing block that starts with `// 6. Send daily email with new listings` (around line 156). **Immediately after** that admin-email block finishes (after the closing brace of its `if (totalNew > 0) { ... }`), add:

```ts
  // 7. Fan out personalized digests to subscribed users
  if (totalNew > 0) {
    try {
      await sendSubscriberDigests(log);
    } catch (err) {
      log(`Subscriber fan-out failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
```

Then append this helper at the very end of the file (below `sendNewListingsEmail`):

```ts
/**
 * Fan out a personalized, city-filtered digest to every user who has at least
 * one entry in profiles.newsletter_cities. One email per user via Resend batch.
 */
async function sendSubscriberDigests(log: (msg: string) => void) {
  const supabase = createAdminClient();

  const { data: subscribers, error: subErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, newsletter_cities, unsubscribe_token")
    .neq("newsletter_cities", "{}");

  if (subErr) {
    log(`Failed to fetch subscribers: ${subErr.message}`);
    return;
  }
  if (!subscribers?.length) {
    log("No subscribers to email");
    return;
  }

  const { data: newListings, error: listErr } = await supabase
    .from("redfin_listings")
    .select("redfin_url, address, city, zip, price, beds, baths, sqft, year_built, days_on_market, image_url")
    .eq("is_new", true);

  if (listErr || !newListings?.length) {
    log("No new listings to fan out");
    return;
  }

  const byCity: Record<string, DigestListing[]> = {};
  for (const l of newListings as DigestListing[]) {
    (byCity[l.city] ??= []).push(l);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aprilzhaohome.com";
  const resend = new Resend(process.env.RESEND_API_KEY);

  type BatchItem = {
    from: string;
    to: string[];
    subject: string;
    html: string;
    headers: Record<string, string>;
  };

  const batch: BatchItem[] = [];
  for (const user of subscribers) {
    const cities = (user.newsletter_cities ?? []) as string[];
    const userListings = cities.flatMap((c) => byCity[c] ?? []);
    if (userListings.length === 0) continue;

    const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(user.unsubscribe_token)}`;
    batch.push({
      from: "April Zhao Realty <noreply@aprilzhaohome.com>",
      to: [user.email],
      subject: `${userListings.length} new listing${userListings.length !== 1 ? "s" : ""} in your cities`,
      html: buildSubscriberDigestHtml(
        { email: user.email, full_name: user.full_name, unsubscribe_token: user.unsubscribe_token },
        userListings,
        siteUrl,
      ),
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  }

  log(`Fanning out to ${batch.length} subscriber${batch.length !== 1 ? "s" : ""}...`);

  // Resend batch API accepts up to 100 emails per call
  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100);
    try {
      await resend.batch.send(chunk);
    } catch (err) {
      log(`Batch send failed (${i}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log(`Sent ${batch.length} subscriber digest${batch.length !== 1 ? "s" : ""}`);
}
```

Note: the `Resend` import already exists at the top of this file (it's used by `sendNewListingsEmail`).

- [ ] **Step 2: Type check**

```bash
npm run lint && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Local smoke test**

Set the tester profile back to a city that should have at least one listing in the DB:

```sql
update profiles set newsletter_cities=ARRAY['Belmont'] where email='tester+plan@example.com';
-- Force at least one listing to be "new" so the cron has something to fan out
update redfin_listings set is_new=true where city='Belmont' limit 1;
```

Trigger the cron locally:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:4000/api/cron/scrape-listings" | jq '.logs'
```

Expected: logs include `"Fanning out to 1 subscriber..."` and `"Sent 1 subscriber digest"`. Check the tester's inbox for the email. Confirm the unsubscribe footer link and the native "Unsubscribe" header (inspect raw headers in Gmail → Show original).

Reset:

```sql
update profiles set newsletter_cities='{}' where email='tester+plan@example.com';
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/scrape-listings/route.ts
git commit -m "feat(cron): fan out personalized digests to newsletter subscribers"
```

---

### Task 12: Footer form → retarget to /signup

**Files:**
- Modify: `src/components/ClientLayout.tsx` (lines 208-374 — the `Footer` function)

- [ ] **Step 1: Replace the footer newsletter form with a CTA button**

In `src/components/ClientLayout.tsx`, locate the `Footer` function (starts at line 208). Replace the existing newsletter state (lines 210-238, `nlName`/`nlEmail`/`handleNewsletterSubmit`) — **delete them**.

Then replace the `{/* Newsletter Signup */}` block (roughly lines 330-374) with:

```tsx
      {/* Newsletter Signup CTA */}
      <div className="border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="md:w-1/3">
              <h4 className={`${playfair.className} text-xl font-normal text-neutral-900 mb-1`}>Stay Updated</h4>
              <p className="text-neutral-500 text-sm">
                Create an account to receive daily Bay Area listings in the cities you choose.
              </p>
            </div>
            <div className="md:flex-1 flex flex-col sm:flex-row gap-3 sm:items-center">
              <Link
                href="/signup"
                className="inline-block px-8 py-3 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-widest hover:bg-[#b8890f] transition-colors whitespace-nowrap text-center"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="text-neutral-500 hover:text-[#d4a012] text-sm uppercase tracking-wider text-center"
              >
                Already a member? Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
```

Ensure the unused `useState` import is removed if no other footer state remains (check the `import { useState }` at the top of `ClientLayout.tsx`; if other functions still use it, leave it).

- [ ] **Step 2: Type check**

```bash
npm run lint && npm run build
```

Expected: exits 0, no "unused variable" errors.

- [ ] **Step 3: Smoke test**

Open http://localhost:4000. Scroll to the footer. Expected: "Create Account" button → `/signup`, "Already a member? Sign in" → `/login`. The old name/email form is gone.

- [ ] **Step 4: Commit**

```bash
git add src/components/ClientLayout.tsx
git commit -m "feat(footer): retarget newsletter form to /signup"
```

---

### Task 13: CLAUDE.md — document new flow

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a new "Auth & newsletter" section**

Add this as a new section in `CLAUDE.md`, just before the `## Conventions` section:

```markdown
### Auth & newsletter

- Self-signup lives at `/signup`. Supabase email confirmations are **OFF** at the project level — `signUp` returns a session immediately and the client redirects to `/portal`.
- `profiles.newsletter_cities text[]` holds each user's opted-in cities. Empty array = not subscribed. City names must match `FEATURED_CITIES[].name` in `src/lib/redfin-listings.ts` (single source of truth).
- `profiles.unsubscribe_token uuid` drives one-click unsubscribe. The token is generated by the column default; do not rotate it manually — unsubscribe is idempotent.
- `/api/newsletter/unsubscribe?token=…` accepts GET (footer link) and POST (RFC 8058 One-Click via `List-Unsubscribe-Post`). Always renders the same 200 HTML page regardless of token validity to avoid leaking token existence.
- The daily cron in `/api/cron/scrape-listings` fans out personalized, city-filtered digests to subscribers **after** the admin digest. Per-user email uses the Resend batch API (chunks of 100). Each send sets `List-Unsubscribe` + `List-Unsubscribe-Post` headers.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document signup + newsletter flow"
```

---

## Final Validation

Run the full verification sweep after all tasks:

- [ ] `npm run lint && npm run build` passes.
- [ ] In a private window, visit `/` → footer CTA goes to `/signup`.
- [ ] `/signup` → create a new account → lands on `/portal` with greeting.
- [ ] `/portal` → pick 2 cities → Save → success message; pick 0 + Unsubscribe all → success.
- [ ] `/login` shows "Create an account" link → `/signup`.
- [ ] Database: `select newsletter_cities, unsubscribe_token from profiles where email=...` shows the expected array and a UUID.
- [ ] Trigger cron (`curl` with `Authorization: Bearer $CRON_SECRET`) with tester subscribed to a city that has `is_new=true` listings → tester inbox receives a digest with a visible unsubscribe footer link, and Gmail's "Show original" includes both `List-Unsubscribe:` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers.
- [ ] Click the footer unsubscribe link → lands on the 200 confirmation page → `newsletter_cities` is now `{}` in the DB.
