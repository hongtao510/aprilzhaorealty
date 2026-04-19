import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersTable, type UserRow } from "./UsersTable";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/users");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/portal");

  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, phone, role, newsletter_cities, newsletter_approved, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
  const lastSignInById = new Map<string, string | null>();
  for (const u of authUsers?.users ?? []) {
    lastSignInById.set(u.id, u.last_sign_in_at ?? null);
  }

  // Concierge signal: any materials or messages tied to this profile
  // means April is actively working with them as a client.
  const [{ data: materials }, { data: messages }] = await Promise.all([
    admin.from("materials").select("client_id"),
    admin.from("messages").select("client_id"),
  ]);
  const conciergeIds = new Set<string>();
  for (const m of materials ?? []) if (m.client_id) conciergeIds.add(m.client_id);
  for (const m of messages ?? []) if (m.client_id) conciergeIds.add(m.client_id);

  const rawRows: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name ?? null,
    phone: p.phone ?? null,
    role: p.role,
    newsletter_cities: (p.newsletter_cities ?? []) as string[],
    newsletter_approved: !!p.newsletter_approved,
    is_concierge: conciergeIds.has(p.id),
    created_at: p.created_at,
    last_sign_in_at: lastSignInById.get(p.id) ?? null,
  }));

  // Sort: pending newsletter approvals first, then by created_at desc
  const rows = rawRows.sort((a, b) => {
    const aPending = a.newsletter_cities.length > 0 && !a.newsletter_approved ? 0 : 1;
    const bPending = b.newsletter_cities.length > 0 && !b.newsletter_approved ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return b.created_at.localeCompare(a.created_at);
  });

  const subscribed = rows.filter(
    (r) => r.newsletter_cities.length > 0 && r.newsletter_approved
  ).length;
  const pending = rows.filter(
    (r) => r.newsletter_cities.length > 0 && !r.newsletter_approved
  ).length;

  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
        Admin
      </p>
      <h1 className="font-serif text-4xl text-neutral-900 mb-2">Users</h1>
      <div className="w-16 h-0.5 bg-[#d4a012] mb-8" />

      <div className="grid grid-cols-4 gap-4 mb-10">
        <Stat label="Total accounts" value={rows.length} />
        <Stat label="Pending approval" value={pending} highlight={pending > 0} />
        <Stat label="Active subscribers" value={subscribed} />
        <Stat label="Admins" value={rows.filter((r) => r.role === "admin").length} />
      </div>

      <UsersTable rows={rows} />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-6 border ${highlight ? "bg-[#fdf6e3] border-[#d4a012]" : "bg-neutral-50 border-neutral-200"}`}>
      <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{label}</p>
      <p className={`font-serif text-3xl ${highlight ? "text-[#d4a012]" : "text-neutral-900"}`}>{value}</p>
    </div>
  );
}
