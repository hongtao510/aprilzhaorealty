import { createClient } from "@supabase/supabase-js";

// To set up Supabase:
// 1. Create a free account at https://supabase.com
// 2. Create a new project
// 3. Go to Settings > API and copy your URL and anon key
// 4. Create a .env.local file with:
//    NEXT_PUBLIC_SUPABASE_URL=your-project-url
//    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
// 5. Create a "comments" table with columns:
//    - id (uuid, primary key)
//    - listing_id (text)
//    - author (text)
//    - content (text)
//    - created_at (timestamp with timezone, default now())

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Comment functions for when you're ready to use Supabase:

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
