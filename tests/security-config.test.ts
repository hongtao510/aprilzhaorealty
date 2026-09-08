import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const repositoryRoot = process.cwd();

test("fresh newsletter setup does not grant blanket profile updates", async () => {
  const sql = await readFile(join(repositoryRoot, "supabase-newsletter.sql"), "utf8");
  assert.doesNotMatch(
    sql,
    /create\s+policy\s+"Users can update own profile"/i
  );
});

test("security migration removes privilege escalation and installs rate limiting", async () => {
  const sql = await readFile(
    join(repositoryRoot, "supabase-security-hardening.sql"),
    "utf8"
  );
  assert.match(sql, /drop policy if exists "Users can update own profile"/i);
  assert.match(sql, /protect_profile_privileged_fields/i);
  assert.match(sql, /create or replace function public\.check_rate_limit/i);
  assert.match(sql, /security\s+invoker/i);
  assert.doesNotMatch(sql, /security\s+definer/i);
  assert.match(
    sql,
    /revoke all on function public\.check_rate_limit\(text, integer, integer\)\s+from public, anon, authenticated/i
  );
  assert.match(
    sql,
    /revoke all privileges on table public\.api_rate_limits\s+from public, anon, authenticated/i
  );
  assert.match(sql, /grant execute.*service_role/i);
});
