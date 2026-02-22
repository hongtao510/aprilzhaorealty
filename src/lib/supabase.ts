// Backward-compatibility wrapper — existing comment functions
// New code should import from @/lib/supabase/client, server, or admin

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getComments(listingId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }

  return data;
}

export async function addComment(listingId: string, author: string, content: string) {
  const { data, error } = await supabase
    .from("comments")
    .insert([{ listing_id: listingId, author, content }])
    .select()
    .single();

  if (error) {
    console.error("Error adding comment:", error);
    return null;
  }

  return data;
}
