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
    .select("id, email, full_name, phone, role, newsletter_cities, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
  const lastSignInById = new Map<string, string | null>();
  for (const u of authUsers?.users ?? []) {
    lastSignInById.set(u.id, u.last_sign_in_at ?? null);
  }

  const rows: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name ?? null,
    phone: p.phone ?? null,
    role: p.role,
    newsletter_cities: (p.newsletter_cities ?? []) as string[],
    created_at: p.created_at,
    last_sign_in_at: lastSignInById.get(p.id) ?? null,
  }));

  const subscribed = rows.filter((r) => r.newsletter_cities.length > 0).length;

  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
        Admin
      </p>
      <h1 className="font-serif text-4xl text-neutral-900 mb-2">Users</h1>
      <div className="w-16 h-0.5 bg-[#d4a012] mb-8" />

      <div className="grid grid-cols-3 gap-4 mb-10">
        <Stat label="Total accounts" value={rows.length} />
        <Stat label="Newsletter subscribers" value={subscribed} />
        <Stat label="Admins" value={rows.filter((r) => r.role === "admin").length} />
      </div>

      <UsersTable rows={rows} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-neutral-50 p-6 border border-neutral-200">
      <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{label}</p>
      <p className="font-serif text-3xl text-neutral-900">{value}</p>
    </div>
  );
}
