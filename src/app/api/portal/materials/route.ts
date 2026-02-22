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

  const { data: materials } = await supabase
    .from("materials")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  // Generate signed download URLs
  const materialsWithUrls = await Promise.all(
    (materials || []).map(async (material) => {
      const { data: signedUrl } = await supabase.storage
        .from("client-materials")
        .createSignedUrl(material.file_path, 3600); // 1 hour

      return {
        ...material,
        download_url: signedUrl?.signedUrl || "",
      };
    })
  );

  return NextResponse.json(materialsWithUrls);
}
