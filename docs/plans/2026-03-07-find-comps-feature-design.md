# Find Comps Feature Design

## Overview

Add a "Find Comps" button to each candidate home card that triggers a CMA (Comparative Market Analysis) using Claude Opus 4.6 API, displaying top 8 comparable recently sold homes with similarity scores, price estimate, market trend adjustment, and visual price distribution.

## Architecture

```
CandidateHomeCard
  -> "Find Comps" button
       -> POST /api/admin/candidate-homes/[id]/comps
            -> Check cache (Supabase candidate_comps, 7-day expiry)
            -> If stale -> Call Claude Opus 4.6 API
                 -> System prompt: housing-comparisons skill instructions
                 -> User prompt: candidate home details (address, sqft, beds, baths, price)
                 -> Response: structured JSON with comps, scores, estimate
            -> Save to candidate_comps table
            -> Return JSON -> Modal renders CMA report
```

## Data Model

New Supabase table `candidate_comps`:

```sql
create table if not exists public.candidate_comps (
  id uuid primary key default gen_random_uuid(),
  candidate_home_id uuid references public.candidate_homes(id) on delete cascade,
  comps jsonb not null,
  price_estimate numeric,
  price_range_low numeric,
  price_range_high numeric,
  market_temperature text check (market_temperature in ('hot', 'warm', 'cool')),
  reasoning text,
  raw_response text,
  created_at timestamptz not null default now()
);

create index idx_candidate_comps_home_id on public.candidate_comps(candidate_home_id);
```

## Comps JSON Structure

```json
{
  "comps": [
    {
      "address": "3503 Highland Ave, Redwood City, CA 94062",
      "sold_price": 2100000,
      "sold_date": "Feb 2026",
      "sqft": 1800,
      "beds": 3,
      "baths": 2,
      "lot_sqft": 6000,
      "similarity_score": 0.874,
      "price_per_sqft": 1167,
      "reason": "Nearly identical size, same 3/2, similar lot, most recent sale"
    }
  ],
  "subject": {
    "address": "323 Myrtle St, Redwood City, CA 94062",
    "sqft": 1820,
    "beds": 3,
    "baths": 2,
    "lot_sqft": 5227
  },
  "estimate": {
    "weighted_price_per_sqft": 1218,
    "comp_based": 2215000,
    "trend_adjusted": 2215000,
    "market_temperature": "warm",
    "trend_adjustment_pct": 0,
    "range": {
      "most_likely": [2125000, 2325000],
      "likely": [2025000, 2425000],
      "possible": [1925000, 2525000],
      "unlikely_below": 1925000,
      "unlikely_above": 2525000
    }
  },
  "market_signals": {
    "sale_to_list_ratio": "101%",
    "days_on_market": 15,
    "yoy_change": "-1.7%",
    "mom_change": "-12%"
  },
  "reasoning": "The strongest comp..."
}
```

## UI Components

### CandidateHomeCard changes
- Add "Find Comps" button (magnifying glass + chart icon)
- Loading state while Claude API processes
- Badge showing cached estimate if available

### CompsModal (new component)
- Full-screen modal with sections:
  1. Subject property summary
  2. Top 8 comps table with scores
  3. "Why selected" reasons list
  4. Price estimate with market trend
  5. ASCII price distribution chart
  6. Star-rated likelihood table
  7. Reasoning paragraph
- Model selector dropdown (Opus / Sonnet / Haiku) in the header
- "Refresh Comps" button to force re-run (bypasses cache)
- Close button

## API Endpoint

`POST /api/admin/candidate-homes/[id]/comps`

Query params:
- `force=true` to bypass cache

Response: CompsResult JSON

## Claude API Integration

- Default model: claude-opus-4-6
- Model selector dropdown in CompsModal header with options:
  - Opus 4.6 (`claude-opus-4-6`) — best reasoning, slowest
  - Sonnet 4.6 (`claude-sonnet-4-6`) — good balance
  - Haiku 4.5 (`claude-haiku-4-5-20251001`) — fastest, cheapest
- Model choice passed to API: `POST /api/.../comps?model=claude-sonnet-4-6`
- System prompt: Full housing-comparisons skill content
- User prompt: Candidate home details + instruction to return structured JSON
- Max tokens: 8192
- Temperature: 0 (deterministic)

## Files Changed

| File | Change |
|------|--------|
| `src/components/portal/CandidateHomeCard.tsx` | Add "Find Comps" button |
| `src/components/portal/CompsModal.tsx` | New modal component |
| `src/app/api/admin/candidate-homes/[id]/comps/route.ts` | New API endpoint |
| `src/lib/types.ts` | Add CompsResult types |
| `supabase-candidate-comps.sql` | New table migration |
| `.env.local` | Add ANTHROPIC_API_KEY |

## Cache Strategy

- Results cached in `candidate_comps` table
- Cache valid for 7 days from `created_at`
- "Refresh Comps" button sets `force=true` to re-run
- On refresh, old row is replaced (delete + insert)

## Security

- Admin-only: behind existing auth middleware
- ANTHROPIC_API_KEY stored in .env.local (server-side only)
- RLS policy: admin can do anything with candidate_comps
