// Usage: node scripts/set-password.mjs <email> <new-password>
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local

import { readFileSync } from "node:fs";

const [, , email, newPassword] = process.argv;
if (!email || !newPassword) {
  console.error("Usage: node scripts/set-password.mjs <email> <new-password>");
  process.exit(1);
}

// Parse .env.local
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim().replace(/^["']|["']$/g, "")];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// 1. Look up the user by email
const listRes = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  },
});

if (!listRes.ok) {
  console.error("Lookup failed:", listRes.status, await listRes.text());
  process.exit(1);
}

const { users } = await listRes.json();
const user = users?.find?.((u) => u.email === email) ?? users?.[0];
if (!user) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}

console.log(`Found user: ${user.email} (id: ${user.id})`);

// 2. Update the password
const updateRes = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
  method: "PUT",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ password: newPassword }),
});

if (!updateRes.ok) {
  console.error("Update failed:", updateRes.status, await updateRes.text());
  process.exit(1);
}

console.log(`Password for ${email} has been updated.`);
