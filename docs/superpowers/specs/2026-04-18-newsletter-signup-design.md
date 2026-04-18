# Newsletter Signup — Design

**Status:** approved for implementation
**Date:** 2026-04-18

## Goal

Open the site to public self-signup so any visitor can create an account, land on the portal, pick which Bay Area cities they want new-listing emails for, and receive a daily digest filtered to their chosen cities. One-click unsubscribe must be exposed in every email.

## User Flow

```
Visitor → /signup
  fields: email, password, full_name, phone (optional), terms checkbox (required)
  ↓ supabase.auth.signUp (email confirmations OFF — see Config)
  ↓ handle_new_user trigger → profiles row (role='client', newsletter_cities=[])
  ↓ auto signed-in, redirect to /portal

/portal (rewritten as newsletter dashboard)
  - 6 city checkboxes (San Mateo, Belmont, San Carlos, Foster City, Redwood Shores, Redwood City)
  - none pre-checked; user picks
  - Save → POST /api/portal/newsletter → UPDATE profiles.newsletter_cities
  - "Unsubscribe from all" clears the array
  - existing concierge nav (saved-homes, messages, materials) remains in sidebar for invited clients

Daily cron (/api/cron/scrape-listings, 8am PT):
  scrape all 6 cities (unchanged — superset)
  mark is_new listings (unchanged)
  send admin digest to CONTACT_EMAIL (unchanged)
  NEW: fan out to subscribers
    SELECT id, email, full_name, newsletter_cities, unsubscribe_token
    FROM profiles WHERE array_length(newsletter_cities, 1) > 0
    for each user:
      filter today's is_new=true listings to user.newsletter_cities
      if any → Resend batch send personalized digest
      if none → skip (no empty emails)

/api/newsletter/unsubscribe?token=<uuid>
  - GET, no auth required
  - Look up profile by unsubscribe_token → set newsletter_cities='{}'
  - Return minimal HTML confirmation page
```

## Data Model

New migration: `supabase-newsletter.sql`

```sql
alter table public.profiles
  add column if not exists newsletter_cities text[] not null default '{}',
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create index if not exists idx_profiles_newsletter_subscribed
  on public.profiles using gin(newsletter_cities)
  where array_length(newsletter_cities, 1) > 0;

create unique index if not exists idx_profiles_unsubscribe_token
  on public.profiles(unsubscribe_token);

-- Let users update their own profile (newsletter_cities toggle)
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
```

- Empty `newsletter_cities` array = not subscribed. No separate boolean.
- No trigger change — default is empty, user opts in from portal.
- `unsubscribe_token` is a stable per-user UUID used in email unsubscribe links.

## Unsubscribe (Exposed in Every Email)

Every digest email MUST include:

1. **Visible unsubscribe link in the footer**, styled to be easy to find:
   - Text: "Unsubscribe from these emails"
   - Target: `https://aprilzhaohome.com/api/newsletter/unsubscribe?token=<user.unsubscribe_token>`
   - One-click — no auth, no confirm step. RFC 8058 compliant.

2. **RFC 8058 headers** so Gmail/Apple Mail show their native "Unsubscribe" button:
   ```
   List-Unsubscribe: <https://aprilzhaohome.com/api/newsletter/unsubscribe?token=<TOKEN>>
   List-Unsubscribe-Post: List-Unsubscribe=One-Click
   ```
   These are set via the Resend SDK `headers` field on each send.

3. **Manage-preferences link** in the footer (secondary): "Update city preferences" → `/portal`.

Unsubscribe endpoint behavior:
- Valid token → set `newsletter_cities = '{}'`, render confirmation page ("You've been unsubscribed. Change your mind? Log in to update your cities.")
- Invalid/missing token → render same page but no write (don't leak which tokens exist).
- Idempotent — re-clicking the link is harmless.

## Pages & Routes

| Route | Auth | Purpose |
|---|---|---|
| `/signup` | public | signup form |
| `/login` | public | existing — add "Create account" link to `/signup` |
| `/portal` | client | **rewritten** — newsletter dashboard (city picker, unsubscribe-all) |
| `/portal/saved-homes`, `/messages`, `/materials` | client | unchanged |
| `/api/portal/newsletter` | client | POST — update `newsletter_cities` |
| `/api/newsletter/unsubscribe` | public | GET with token |
| `/privacy` | public | short privacy page |
| `/api/auth/callback` | public | existing |

Middleware `publicRoutes` gets `/signup` and `/privacy`. `/api/newsletter` is already public.

## Signup Form

Fields:
- Email (required, HTML5 validated)
- Password (required, min 8 — Supabase enforces)
- Full name (required)
- Phone (optional)
- Terms checkbox (required): "I agree to the [Privacy Policy](/privacy) and to receive listing emails. I can unsubscribe anytime."

Styling: matches existing `/login` page aesthetic (gold `#d4a012` accent, serif headline, neutral bg, border-bottom inputs).

On success: `supabase.auth.signUp({ email, password, options: { data: { full_name, phone } } })`, then `router.push('/portal')`.

## Portal Dashboard (`/portal`)

Rewrite of `src/app/(portal)/portal/page.tsx`:

Sections:
1. **Header**: "Welcome back, {full_name}" + sign-out button.
2. **Newsletter preferences** card:
   - 6 city checkboxes, read from `FEATURED_CITIES` in `src/lib/redfin-listings.ts` (single source of truth).
   - "Save preferences" button (disabled until dirty).
   - "Unsubscribe from all" link (destructive style, confirm dialog).
   - Preview line: "You'll receive an email each morning when there are new listings in your selected cities."
3. **(existing nav unchanged)** — sidebar still shows saved-homes, messages, materials.

State management: simple `useState` + fetch to `/api/portal/newsletter`. Load current cities on mount from the server session (pass via RSC or fetch).

## Daily Digest Fan-Out

In `src/app/api/cron/scrape-listings/route.ts`, after the existing `sendNewListingsEmail(totalNew, log)` admin send:

```ts
if (totalNew > 0) {
  await sendSubscriberDigests(log);
}

async function sendSubscriberDigests(log) {
  // Pseudocode — exact PostgREST filter for "non-empty array" is resolved in the
  // implementation plan (options: .neq on literal '{}', a SQL view, or an RPC).
  const { data: subscribers } = await supabase
    .from("profiles")
    .select("id, email, full_name, newsletter_cities, unsubscribe_token")
    .filter("newsletter_cities", "neq", "{}");

  const { data: newListings } = await supabase
    .from("redfin_listings")
    .select("*")
    .eq("is_new", true);

  const byCity = groupBy(newListings, "city");
  const batch: ResendSendEmailParam[] = [];

  for (const user of subscribers ?? []) {
    const userListings = user.newsletter_cities.flatMap(c => byCity[c] ?? []);
    if (userListings.length === 0) continue;

    batch.push({
      from: "April Zhao Realty <noreply@aprilzhaohome.com>",
      to: [user.email],
      subject: `${userListings.length} new listing${userListings.length !== 1 ? "s" : ""} in your cities`,
      html: buildSubscriberDigestHtml(user, userListings),
      headers: {
        "List-Unsubscribe": `<https://aprilzhaohome.com/api/newsletter/unsubscribe?token=${user.unsubscribe_token}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  }

  // Resend batch API — 100 per call
  for (let i = 0; i < batch.length; i += 100) {
    await resend.batch.send(batch.slice(i, i + 100));
  }
  log(`Subscriber digests: ${batch.length} sent`);
}
```

`buildSubscriberDigestHtml` is the existing admin-digest template + an unsubscribe footer that includes the `unsubscribe_token`. Lives in `src/lib/email-templates.ts`.

`maxDuration = 60` stays. With N=500 users and batch API, runtime is a few seconds — well within budget.

## Config Change (Not Code)

Supabase dashboard → **Authentication → Sign In / Providers** → turn OFF **"Confirm email"**.

Rationale: the approved flow is `signup → immediate portal dashboard`. Supabase's confirmation flow blocks session creation until the email link is clicked, which breaks that UX. Consent is still captured via (a) explicit terms checkbox at signup, (b) explicit city selection in the portal. Both are timestamped in Postgres. That's stronger evidence of intent than a confirmation click.

Future: if deliverability becomes an issue, add an in-portal "Verify your email" banner (non-blocking) and optionally gate digest sends on `auth.users.email_confirmed_at IS NOT NULL`.

## Files Touched

| File | Change |
|---|---|
| `src/app/(auth)/signup/page.tsx` | NEW — signup form, styled like `/login` |
| `src/app/(auth)/login/page.tsx` | add "Create account" link to `/signup` |
| `src/app/(portal)/portal/page.tsx` | REWRITE — newsletter dashboard |
| `src/app/api/portal/newsletter/route.ts` | NEW — POST, auth-required, updates `newsletter_cities` |
| `src/app/api/newsletter/unsubscribe/route.ts` | NEW — GET with token |
| `src/app/api/cron/scrape-listings/route.ts` | add `sendSubscriberDigests` fan-out |
| `src/app/(public)/privacy/page.tsx` | NEW — short blurb |
| `src/lib/email-templates.ts` | add `buildSubscriberDigestHtml` + unsubscribe footer helper |
| `supabase-newsletter.sql` | NEW migration |
| `src/middleware.ts` | add `/signup`, `/privacy` to `publicRoutes` |
| `CLAUDE.md` | document self-signup flow + newsletter fan-out |

## Security & Privacy

- Signup endpoint uses Supabase's built-in auth (rate-limited, bcrypt hashing).
- `unsubscribe_token` is a random UUID — unguessable and unique per user.
- Unsubscribe endpoint uses the admin Supabase client server-side (not exposed to browser).
- Privacy page states: we collect email/name/phone for account + listing emails; data never sold; users can unsubscribe or delete their account anytime (delete via Supabase support email in v1).
- RLS policy allows users to update only their own `profiles` row.

## Scope Trims (from earlier iteration)

- No `newsletter_opt_in` boolean — `newsletter_cities` carries the same signal.
- No signup-time newsletter checkbox — city selection happens on the portal.
- No `email_confirmed_at` mirror column — not gating sends on confirmation.
- Existing homepage `/api/newsletter` form: **retarget the form to `/signup`** so there's one intake path. Keep the `subscribers` table as historical data; no new rows written.

## Out of Scope (v1)

- Google OAuth (deferred — can add later as a second button, trigger already handles OAuth metadata).
- Per-city email cadence / digest frequency options.
- Lead-specific filters (price range, beds, property type).
- Migration of existing `subscribers` rows into `profiles` (no password = not auto-migratable).
- Account deletion self-serve (v1 = email April).
- CAPTCHA on signup (rely on Supabase's built-in rate limits first).

## Open Questions Resolved

1. ✅ Keep concierge portal features accessible for invited clients.
2. ✅ Retarget homepage newsletter form → `/signup`.
3. ✅ City picker: no cities pre-checked; explicit opt-in.

## Risks

- **Supabase free-tier SMTP rate limits** — only matters if we re-enable email confirmations or password reset volume spikes. Current design avoids this by keeping confirmations off.
- **Resend bounces eating quota** — invalid addresses from self-signup will bounce. Resend auto-suppresses them; we don't need to write bounce-handling code in v1, but monitor.
- **Abuse / fake signups** — Supabase has rate limits; if abuse appears, add hCaptcha (Supabase-native) as v2.
