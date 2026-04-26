import type { RawComp, ScoredComp } from "../types";

export interface SubjectGeo {
  sqft: number;
  beds: number;
  baths: number;
  lot_sqft: number | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string | null;
  year_built?: number | null;
  city?: string | null;
  neighborhood?: string | null;
  elementary_school_rating?: number | null;
  renovation_tier?: 0 | 1 | 2 | 3 | 4 | null;
}

export interface ScoringConfig {
  weights: {
    size: number;
    bedbath: number;
    lot: number;
    location: number;
    era: number;
    school: number;
    renovation: number;
  };
  locationSubWeights: { distance: number; tier: number; neighborhood: number };
  recencyHalfLifeMonths: number;   // exp(-months/halfLife) — value at halfLife = 1/e ≈ 0.37
  maxRecencyMonths: number;        // hard cutoff
  distanceHalfLifeMiles: number;
  tierRadiusMiles: number;
  tierMinComps: number;
  /** Bedbath similarity falls to 0 when |Δ(beds+baths)| ≥ this many points. */
  bedbathSpread: number;
  /** Year-built similarity falls to 0 when |Δyear| ≥ this many years. */
  eraSpread: number;
  /** School rating similarity falls to 0 when |Δrating| ≥ this many points. */
  schoolSpread: number;
  /** Hard-filter comps to subject's property_type when both are known. */
  enforcePropertyType: boolean;
  /** Hard-filter comps to subject's city when both are known. Adjacent-city allowlist applied first. */
  enforceSameCity: boolean;
  /** Hard exclude comps farther than this many miles from subject (when geo known on both sides). */
  maxDistanceMiles: number;
}

export const DEFAULT_CONFIG: ScoringConfig = {
  weights: { size: 0.30, bedbath: 0.15, lot: 0.10, location: 0.25, era: 0.08, school: 0.05, renovation: 0.07 },
  locationSubWeights: { distance: 0.45, tier: 0.30, neighborhood: 0.25 },
  recencyHalfLifeMonths: 12,
  maxRecencyMonths: 18,
  distanceHalfLifeMiles: 0.75,
  tierRadiusMiles: 0.6,
  tierMinComps: 2,
  bedbathSpread: 3,
  eraSpread: 30,
  schoolSpread: 5,
  enforcePropertyType: true,
  enforceSameCity: true,
  maxDistanceMiles: 1.5,
};

/**
 * Cities treated as the same submarket. Belmont absorbs the unincorporated pocket
 * of "San Carlos" homes that physically sit in the same school/zip footprint, etc.
 * Bidirectional — if A is in B's allowlist, B is in A's.
 */
const ADJACENT_CITY_ALIASES: Record<string, string[]> = {
  "Redwood City": ["Emerald Hills", "Atherton"],
  "Emerald Hills": ["Redwood City"],
  "Belmont": [],
  "San Mateo": [],
  "San Carlos": [],
  "Atherton": ["Redwood City", "Menlo Park"],
  "Menlo Park": ["Atherton"],
};

function normalizeCity(c: string | null | undefined): string | null {
  if (!c) return null;
  return c.trim().replace(/\s+/g, " ");
}

function citiesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return true; // can't enforce when missing
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  if (A === B) return true;
  const aliasesA = ADJACENT_CITY_ALIASES[a] ?? [];
  if (aliasesA.some((x) => x.toLowerCase() === B)) return true;
  const aliasesB = ADJACENT_CITY_ALIASES[b] ?? [];
  if (aliasesB.some((x) => x.toLowerCase() === A)) return true;
  return false;
}

export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.7613; // earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Compute median $/sqft of comps within `radiusMi` of (lat,lng). Returns null when too few comps. */
export function localMedianPpsf(
  comps: RawComp[],
  lat: number | null,
  lng: number | null,
  radiusMi: number,
  minComps: number,
): number | null {
  if (lat === null || lng === null) return null;
  const ppsfs: number[] = [];
  for (const c of comps) {
    if (
      c.latitude == null ||
      c.longitude == null ||
      c.sqft <= 0 ||
      c.sold_price <= 0
    ) {
      continue;
    }
    const d = haversineMiles({ lat, lng }, { lat: c.latitude, lng: c.longitude });
    if (d <= radiusMi) ppsfs.push(c.sold_price / c.sqft);
  }
  if (ppsfs.length < minComps) return null;
  return median(ppsfs);
}

function monthsBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

function parseSoldDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Minimum comp count after same-city filtering before falling back to no-city-filter. */
const MIN_SAME_CITY_COMPS = 5;

export function scoreComps(
  subject: SubjectGeo,
  rawComps: RawComp[],
  asOfDate: Date,
  config: ScoringConfig = DEFAULT_CONFIG,
): ScoredComp[] {
  const primary = scoreCompsInternal(subject, rawComps, asOfDate, config);
  // If same-city enforcement stripped the pool too thin, retry without it (still respects all other filters).
  if (
    config.enforceSameCity &&
    subject.city &&
    primary.length < MIN_SAME_CITY_COMPS
  ) {
    return scoreCompsInternal(subject, rawComps, asOfDate, { ...config, enforceSameCity: false });
  }
  return primary;
}

function scoreCompsInternal(
  subject: SubjectGeo,
  rawComps: RawComp[],
  asOfDate: Date,
  config: ScoringConfig,
): ScoredComp[] {
  const subjectPpsfTier = localMedianPpsf(
    rawComps,
    subject.latitude,
    subject.longitude,
    config.tierRadiusMiles,
    config.tierMinComps,
  );

  const lotKnown = subject.lot_sqft != null && subject.lot_sqft > 0;
  const yearKnown = subject.year_built != null && subject.year_built > 0;
  const schoolKnown = subject.elementary_school_rating != null;
  const renovationKnown = subject.renovation_tier != null;

  // Re-distribute orphaned weights to size/bedbath proportionally.
  const w = { ...config.weights };
  const redistribute = (orphan: number) => {
    const total = w.size + w.bedbath;
    if (total > 0) {
      w.size += orphan * (w.size / total);
      w.bedbath += orphan * (w.bedbath / total);
    }
  };
  if (!lotKnown) { redistribute(w.lot); w.lot = 0; }
  if (!yearKnown) { redistribute(w.era); w.era = 0; }
  if (!schoolKnown) { redistribute(w.school); w.school = 0; }
  if (!renovationKnown) { redistribute(w.renovation); w.renovation = 0; }

  const out: ScoredComp[] = [];

  const subjectCity = normalizeCity(subject.city);

  for (const c of rawComps) {
    // Hard property-type filter when both sides are known.
    if (
      config.enforcePropertyType &&
      subject.property_type &&
      c.property_type &&
      subject.property_type !== c.property_type
    ) {
      continue;
    }

    // Hard same-city filter (with adjacent-city allowlist).
    if (config.enforceSameCity && subjectCity && c.city) {
      if (!citiesMatch(subjectCity, normalizeCity(c.city))) continue;
    }

    const soldDate = parseSoldDate(c.sold_date);
    if (!soldDate) continue;
    const months = monthsBetween(asOfDate, soldDate);
    if (months < 0 || months > config.maxRecencyMonths) continue;

    if (c.sqft <= 0 || c.sold_price <= 0) continue;

    // Size
    const sizeDiff = Math.abs(c.sqft - subject.sqft) / subject.sqft;
    const size_score = Math.max(0, 1 - sizeDiff / 0.20);

    // Bed+Bath
    const bbDiff = Math.abs(c.beds + c.baths - (subject.beds + subject.baths));
    const bedbath_score = Math.max(0, 1 - bbDiff / config.bedbathSpread);

    // Lot
    let lot_score = 0;
    if (lotKnown && c.lot_sqft != null && c.lot_sqft > 0 && subject.lot_sqft != null) {
      const lotDiff = Math.abs(c.lot_sqft - subject.lot_sqft) / subject.lot_sqft;
      lot_score = Math.max(0, 1 - lotDiff / 0.30);
    }

    // Era (year-built — proxy for vintage/condition)
    let era_score = 1; // neutral if either side missing
    if (yearKnown && c.year_built != null && c.year_built > 0 && subject.year_built != null) {
      const yearDiff = Math.abs(c.year_built - subject.year_built);
      era_score = Math.max(0, 1 - yearDiff / config.eraSpread);
    }

    // Distance
    let distance_miles = 0;
    let distance_score = 1; // neutral if either side missing
    if (
      subject.latitude != null &&
      subject.longitude != null &&
      c.latitude != null &&
      c.longitude != null
    ) {
      distance_miles = haversineMiles(
        { lat: subject.latitude, lng: subject.longitude },
        { lat: c.latitude, lng: c.longitude },
      );
      // Hard-exclude comps beyond the configured max distance.
      if (distance_miles > config.maxDistanceMiles) continue;
      distance_score = Math.exp(-distance_miles / config.distanceHalfLifeMiles);
    }

    // Tier
    let tier_score = 1;
    if (subjectPpsfTier != null) {
      const compTier = localMedianPpsf(
        rawComps,
        c.latitude ?? null,
        c.longitude ?? null,
        config.tierRadiusMiles,
        config.tierMinComps,
      );
      if (compTier != null && compTier > 0) {
        const ratio = compTier / subjectPpsfTier;
        const logRatio = Math.abs(Math.log(ratio));
        tier_score = Math.max(0, Math.min(1, 1 - logRatio));
      }
    }

    // Neighborhood: 1.0 same, 0.5 differ, 1.0 (neutral) if either side null
    let neighborhood_score = 1;
    if (subject.neighborhood && c.neighborhood) {
      neighborhood_score =
        subject.neighborhood.toLowerCase() === c.neighborhood.toLowerCase() ? 1.0 : 0.5;
    }

    const location_score =
      config.locationSubWeights.distance * distance_score +
      config.locationSubWeights.tier * tier_score +
      config.locationSubWeights.neighborhood * neighborhood_score;

    // School rating
    let school_score = 1;
    if (
      schoolKnown &&
      c.elementary_school_rating != null &&
      subject.elementary_school_rating != null
    ) {
      const diff = Math.abs(c.elementary_school_rating - subject.elementary_school_rating);
      school_score = Math.max(0, 1 - diff / config.schoolSpread);
    }

    // Renovation tier (condition signal)
    let renovation_score = 1;
    if (renovationKnown && c.renovation_tier != null && subject.renovation_tier != null) {
      const diff = Math.abs(c.renovation_tier - subject.renovation_tier);
      renovation_score = Math.max(0, 1 - diff / 3);
    }

    const similarity =
      w.size * size_score +
      w.bedbath * bedbath_score +
      w.lot * lot_score +
      w.location * location_score +
      w.era * era_score +
      w.school * school_score +
      w.renovation * renovation_score;

    if (similarity <= 0) continue;

    const recency = Math.exp(-months / config.recencyHalfLifeMonths);
    const total_score = similarity * recency;
    const price_per_sqft = c.sold_price / c.sqft;

    out.push({
      ...c,
      size_score,
      bedbath_score,
      lot_score,
      era_score,
      distance_miles,
      distance_score,
      tier_score,
      neighborhood_score,
      location_score,
      school_score,
      renovation_score,
      similarity,
      recency,
      total_score,
      price_per_sqft,
    });
  }

  return out.sort((a, b) => b.total_score - a.total_score);
}
