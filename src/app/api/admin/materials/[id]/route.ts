import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Get material to find file path
  const { data: material } = await supabase
    .from("materials")
    .select("file_path")
    .eq("id", id)
    .single();

  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  // Delete from storage
  await supabase.storage
    .from("client-materials")
    .remove([material.file_path]);

  // Delete DB record
  const { error } = await supabase.from("materials").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
