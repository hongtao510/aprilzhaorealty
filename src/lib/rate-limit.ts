import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RateLimitOptions {
  scope: string;
  identifier: string;
  maxRequests: number;
  windowSeconds: number;
}

interface MemoryWindow {
  count: number;
  expiresAt: number;
}

const memoryWindows = new Map<string, MemoryWindow>();

export function requestClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function buildRateLimitKey(scope: string, identifier: string): string {
  return createHash("sha256")
    .update(`${scope}:${identifier.trim().toLowerCase()}`)
    .digest("hex");
}

function checkMemoryLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): boolean {
  const now = Date.now();
  const current = memoryWindows.get(key);
  if (!current || current.expiresAt <= now) {
    memoryWindows.set(key, {
      count: 1,
      expiresAt: now + windowSeconds * 1000,
    });
    return true;
  }
  if (current.count >= maxRequests) return false;
  current.count += 1;
  return true;
}

/**
 * Use the atomic Supabase limiter when available. The in-memory fallback keeps
 * local development and rolling deployments functional before the SQL
 * hardening migration is applied; production should use the persistent path.
 */
export async function checkRateLimit({
  scope,
  identifier,
  maxRequests,
  windowSeconds,
}: RateLimitOptions): Promise<boolean> {
  const key = buildRateLimitKey(scope, identifier);

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("check_rate_limit", {
        p_key: key,
        p_window_seconds: windowSeconds,
        p_max_requests: maxRequests,
      });
      if (!error && typeof data === "boolean") return data;
      console.warn("Persistent rate limiter unavailable; using local fallback");
    } catch {
      console.warn("Persistent rate limiter unavailable; using local fallback");
    }
  }

  return checkMemoryLimit(key, maxRequests, windowSeconds);
}
