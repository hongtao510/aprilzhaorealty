import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from("subscribers")
      .upsert({ name, email }, { onConflict: "email", ignoreDuplicates: true });

    if (error) {
      console.error("Newsletter signup error:", error);
      return NextResponse.json(
        { error: "Unable to subscribe. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Subscribed successfully!" });
  } catch (error) {
    console.error("Newsletter error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
