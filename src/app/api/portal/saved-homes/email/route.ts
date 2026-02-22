import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

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
  homes: HomePayload[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHomeCard(home: HomePayload): string {
  const image = home.image_url
    ? `<img src="${escapeHtml(home.image_url)}" alt="${escapeHtml(home.address || "Home")}" style="width:100%;height:200px;object-fit:cover;display:block;" />`
    : `<div style="width:100%;height:200px;background-color:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:48px;">&#8962;</div>`;

  const price = home.price
    ? `<p style="font-size:20px;font-weight:bold;color:#1a1a1a;margin:0 0 4px 0;">${escapeHtml(home.price)}</p>`
    : "";

  const address = home.address
    ? `<p style="font-size:14px;color:#666;margin:0 0 8px 0;">${escapeHtml(home.address)}</p>`
    : "";

  const comment = home.comment.trim()
    ? `<blockquote style="margin:12px 0 0 0;padding:10px 14px;border-left:3px solid #d4a012;background-color:#faf8f0;color:#555;font-size:13px;font-style:italic;">${escapeHtml(home.comment)}</blockquote>`
    : "";

  return `
    <div style="border:1px solid #e5e5e5;margin-bottom:20px;overflow:hidden;">
      ${image}
      <div style="padding:16px;">
        ${price}
        ${address}
        <a href="${escapeHtml(home.url)}" style="display:inline-block;margin-top:8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#d4a012;text-decoration:none;">View Listing &rarr;</a>
        ${comment}
      </div>
    </div>`;
}

function buildEmailHtml(homes: HomePayload[]): string {
  const homeCards = homes.map(buildHomeCard).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <div style="padding:30px 20px;text-align:center;border-bottom:2px solid #d4a012;">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:3px;color:#d4a012;margin:0 0 6px 0;">April Zhao Realty</p>
      <h1 style="font-size:22px;color:#1a1a1a;margin:0;font-weight:normal;">Homes Shared With You</h1>
    </div>
    <div style="padding:20px;">
      ${homeCards}
    </div>
    <div style="padding:20px;text-align:center;border-top:1px solid #e5e5e5;">
      <p style="font-size:11px;color:#999;margin:0;">Sent via April Zhao Realty</p>
    </div>
  </div>
</body>
</html>`;
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
      from: "April Zhao Realty <onboarding@resend.dev>",
      to: [agentEmail],
      cc: [body.recipientEmail],
      replyTo,
      subject,
      html: buildEmailHtml(body.homes),
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
