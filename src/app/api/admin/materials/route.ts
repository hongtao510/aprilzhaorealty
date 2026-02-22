import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const clientId = formData.get("client_id") as string;
  const description = formData.get("description") as string | null;

  if (!file || !clientId) {
    return NextResponse.json(
      { error: "File and client_id are required" },
      { status: 400 }
    );
  }

  const filePath = `${clientId}/${Date.now()}-${file.name}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("client-materials")
    .upload(filePath, file);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Create DB record
  const { data: material, error: dbError } = await supabase
    .from("materials")
    .insert({
      client_id: clientId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type,
      description: description || null,
    })
    .select()
    .single();

  if (dbError) {
    // Clean up uploaded file
    await supabase.storage.from("client-materials").remove([filePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(material);
}
