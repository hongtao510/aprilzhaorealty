import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { buildEmailHtml } from "@/lib/email-templates";

interface HomePayload {
  id: string;
  url: string;
  title: string | null;
  image_url: string | null;
  address: string | null;
  price: string | null;
  comment: string;
}

interface EmailRequestBody {
  recipientEmail: string;
  subject?: string;
  message?: string;
  homes: HomePayload[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: EmailRequestBody = await request.json();

    // Validate recipient email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!body.recipientEmail || !emailRegex.test(body.recipientEmail)) {
      return NextResponse.json(
        { error: "Valid recipient email is required" },
        { status: 400 }
      );
    }

    // Validate homes array
    if (!Array.isArray(body.homes) || body.homes.length === 0) {
      return NextResponse.json(
        { error: "At least one home must be selected" },
        { status: 400 }
      );
    }

    if (body.homes.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 homes per email" },
        { status: 400 }
      );
    }

    // Get sender's name from profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const senderName = profile?.full_name || "Someone";
    const senderEmail = profile?.email || user.email;
    const homeCount = body.homes.length;
    const subject = body.subject?.trim() || `${senderName} shared ${homeCount} home${homeCount === 1 ? "" : "s"} with you`;

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.log("Email homes submission (Resend not configured):", {
        recipientEmail: body.recipientEmail,
        homeCount,
        senderName,
      });
      return NextResponse.json(
        { message: "Email received! (Email service not yet configured)" },
        { status: 200 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const replyTo = senderEmail || process.env.CONTACT_EMAIL || "aprilcasf@gmail.com";
    const agentEmail = process.env.CONTACT_EMAIL || "aprilcasf@gmail.com";

    // With Resend's onboarding@resend.dev sender, emails can only be delivered
    // to the verified account email. Send to the agent with the recipient CC'd.
    // Once a custom domain is verified in Resend, switch to: to: [body.recipientEmail]
    const { data, error } = await resend.emails.send({
      from: "April Zhao Realty <noreply@aprilzhaohome.com>",
      to: [agentEmail],
      cc: [body.recipientEmail],
      replyTo,
      subject,
      html: buildEmailHtml(body.homes, body.message),
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: `Unable to send email: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Email sent successfully", id: data?.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Email homes error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
