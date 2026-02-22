# Add Cities to Explore Properties Section

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 new cities (Millbrae, San Mateo, Foster City, Redwood Shores, Redwood City, Menlo Park) to the "Explore Properties" section with correct Redfin links.

**Architecture:** Update the `neighborhoods` array in `src/app/page.tsx` to include the new cities. Each city needs a name, description, Redfin URL, and placeholder image. The grid layout will need adjustment from 5 columns to accommodate 11 total cities.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS

---

### Task 1: Add New Cities to Neighborhoods Array

**Files:**
- Modify: `src/app/page.tsx:10-41`

**Step 1: Add the 6 new city entries to the neighborhoods array**

Add these entries after the existing 5 cities in the `neighborhoods` array (lines 10-41):

```typescript
const neighborhoods = [
  {
    name: "San Carlos",
    description: "Family-friendly with excellent schools",
    url: "https://www.redfin.com/city/16687/CA/San-Carlos",
    image: "/images/neighborhoods/san-carlos.jpg",
  },
  {
    name: "Belmont",
    description: "Charming hillside community",
    url: "https://www.redfin.com/city/1362/CA/Belmont",
    image: "/images/neighborhoods/belmont.jpg",
  },
  {
    name: "Palo Alto",
    description: "Tech hub with top schools",
    url: "https://www.redfin.com/city/14325/CA/Palo-Alto",
    image: "/images/neighborhoods/palo-alto.jpg",
  },
  {
    name: "Burlingame",
    description: "Boutique downtown & tree-lined streets",
    url: "https://www.redfin.com/city/2350/CA/Burlingame",
    image: "/images/neighborhoods/burlingame.jpg",
  },
  {
    name: "San Francisco",
    description: "Iconic city with diverse neighborhoods",
    url: "https://www.redfin.com/city/17151/CA/San-Francisco",
    image: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80",
  },
  {
    name: "Millbrae",
    description: "Convenient BART access & diverse dining",
    url: "https://www.redfin.com/city/12130/CA/Millbrae",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  },
  {
    name: "San Mateo",
    description: "Vibrant downtown & excellent parks",
    url: "https://www.redfin.com/city/17490/CA/San-Mateo",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80",
  },
  {
    name: "Foster City",
    description: "Waterfront living & top-rated schools",
    url: "https://www.redfin.com/city/6524/CA/Foster-City",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
  },
  {
    name: "Redwood Shores",
    description: "Lagoon views & tech company headquarters",
    url: "https://www.redfin.com/neighborhood/115895/CA/Redwood-City/Redwood-Shores",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  },
  {
    name: "Redwood City",
    description: "Climate best by government test",
    url: "https://www.redfin.com/city/15525/CA/Redwood-City",
    image: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=80",
  },
  {
    name: "Menlo Park",
    description: "Home of Meta & Stanford neighbors",
    url: "https://www.redfin.com/city/11961/CA/Menlo-Park",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
  },
];
```

**Step 2: Verify the changes compile**

Run: `cd /Users/taohong/Documents/aprilzhaorealty && npm run build`
Expected: Build succeeds without TypeScript errors

**Step 3: Test locally**

Run: Open http://localhost:3002 in browser
Expected: "Explore Properties" section shows all 11 cities with correct Redfin links

---

### Task 2: Adjust Grid Layout for 11 Cities

**Files:**
- Modify: `src/app/page.tsx:338`

**Step 1: Update grid columns to better accommodate 11 cities**

The current grid is `lg:grid-cols-5`. With 11 cities, options are:
- Keep 5 columns (11 cards = 3 rows with last row having 1 card)
- Change to 4 columns (11 cards = 3 rows with last row having 3 cards)
- Change to 6 columns (11 cards = 2 rows with last row having 5 cards)

Recommended: Keep `lg:grid-cols-5` for visual consistency, or consider `lg:grid-cols-4` for more balanced rows.

Change line 338 from:
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
```

To (if choosing 4 columns):
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
```

**Step 2: Verify visual appearance**

Run: Check http://localhost:3002
Expected: Grid displays 11 cities in a visually balanced layout

**Step 3: Commit changes**

```bash
git add src/app/page.tsx
git commit -m "feat: add 6 new cities to Explore Properties section

Add Millbrae, San Mateo, Foster City, Redwood Shores,
Redwood City, and Menlo Park with correct Redfin links.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Verified Redfin URLs

| City | Redfin URL |
|------|------------|
| Millbrae | https://www.redfin.com/city/12130/CA/Millbrae |
| San Mateo | https://www.redfin.com/city/17490/CA/San-Mateo |
| Foster City | https://www.redfin.com/city/6524/CA/Foster-City |
| Redwood Shores | https://www.redfin.com/neighborhood/115895/CA/Redwood-City/Redwood-Shores |
| Redwood City | https://www.redfin.com/city/15525/CA/Redwood-City |
| Menlo Park | https://www.redfin.com/city/11961/CA/Menlo-Park |

Note: Redwood Shores uses a `/neighborhood/` URL pattern since it's a neighborhood within Redwood City, not a separate city.
