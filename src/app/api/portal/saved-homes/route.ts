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

  const { data: homes } = await supabase
    .from("saved_homes")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(homes || []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url, title, image_url, address, price, notes } =
    await request.json();

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const { data: home, error } = await supabase
    .from("saved_homes")
    .insert({
      client_id: user.id,
      url,
      title: title || null,
      image_url: image_url || null,
      address: address || null,
      price: price || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(home);
}
