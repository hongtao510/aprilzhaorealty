import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: true });

  // Mark messages from admin as read
  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("client_id", user.id)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  return NextResponse.json(messages || []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content } = await request.json();

  if (!content) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      client_id: user.id,
      sender_id: user.id,
      content,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(message);
}
