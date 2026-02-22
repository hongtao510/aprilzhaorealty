import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all clients with counts
  const { data: clients } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  // Get material and message counts for each client
  const enrichedClients = await Promise.all(
    (clients || []).map(async (client) => {
      const { count: materialCount } = await supabase
        .from("materials")
        .select("*", { count: "exact", head: true })
        .eq("client_id", client.id);

      const { count: messageCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("client_id", client.id);

      const { count: unreadCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("is_read", false)
        .neq("sender_id", user.id);

      return {
        ...client,
        material_count: materialCount || 0,
        message_count: messageCount || 0,
        unread_count: unreadCount || 0,
      };
    })
  );

  return NextResponse.json(enrichedClients);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { full_name, email, phone, password } = await request.json();

  if (!full_name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required" },
      { status: 400 }
    );
  }

  // Use admin client to create user (bypasses email confirmation)
  const adminSupabase = createAdminClient();
  const { data: authData, error: authError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone },
    });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Update profile with client role
  const { error: profileError } = await adminSupabase
    .from("profiles")
    .update({
      full_name,
      phone: phone || null,
      role: "client",
    })
    .eq("id", authData.user.id);

  if (profileError) {
    return NextResponse.json(
      { error: "User created but profile update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: authData.user.id,
    email,
    full_name,
  });
}
