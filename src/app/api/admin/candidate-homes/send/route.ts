import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { buildEmailHtml } from "@/lib/email-templates";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Unauthorized" as const, status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { supabase, error: "Forbidden" as const, status: 403 as const };

  return { supabase, user, error: null, status: null };
}

export async function POST(request: NextRequest) {
  const { supabase, error, status } = await verifyAdmin();
  if (error) return NextResponse.json({ error }, { status: status! });

  const { candidateIds, clientId, recipientEmail, subject, message, saveToClient } = await request.json();

  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return NextResponse.json({ error: "candidateIds array is required" }, { status: 400 });
  }

  // Must have either a client or a manual email
  if (!clientId && !recipientEmail) {
    return NextResponse.json({ error: "clientId or recipientEmail is required" }, { status: 400 });
  }

  if (recipientEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
  }

  // Fetch candidate homes
  const { data: candidates, error: candidatesError } = await supabase
    .from("candidate_homes")
    .select("*")
    .in("id", candidateIds);

  if (candidatesError || !candidates?.length) {
    return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
  }

  // Determine recipient email
  let toEmail = recipientEmail;
  if (clientId) {
    const { data: client, error: clientError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    toEmail = client.email;
  }

  // Build email payload
  const emailHomes = candidates.map((c) => ({
    url: c.url,
    title: c.title,
    image_url: c.image_url,
    address: c.address,
    price: c.price,
  }));

  const emailSubject = subject?.trim() || `${candidates.length} home${candidates.length === 1 ? "" : "s"} picked for you`;

  // Send email via Resend
  if (!process.env.RESEND_API_KEY) {
    console.log("Candidate email (Resend not configured):", {
      toEmail,
      homeCount: candidates.length,
    });
  } else {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const agentEmail = process.env.CONTACT_EMAIL || "aprilcasf@gmail.com";

    const { error: sendError } = await resend.emails.send({
      from: "April Zhao Realty <noreply@aprilzhaohome.com>",
      to: [agentEmail],
      cc: [toEmail],
      replyTo: agentEmail,
      subject: emailSubject,
      html: buildEmailHtml(emailHomes, message),
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return NextResponse.json(
        { error: `Unable to send email: ${sendError.message}` },
        { status: 500 }
      );
    }
  }

  // Optionally save to client's saved_homes (only if a client was selected)
  if (saveToClient && clientId) {
    const savedRows = candidates.map((c) => ({
      client_id: clientId,
      url: c.url,
      title: c.title,
      image_url: c.image_url,
      address: c.address,
      price: c.price,
    }));

    await supabase.from("saved_homes").upsert(savedRows, {
      onConflict: "client_id,url",
      ignoreDuplicates: true,
    });
  }

  // Update candidate statuses to "sent"
  const now = new Date().toISOString();
  await supabase
    .from("candidate_homes")
    .update({
      status: "sent",
      sent_to_client_id: clientId || null,
      sent_at: now,
      updated_at: now,
    })
    .in("id", candidateIds);

  return NextResponse.json({
    message: "Email sent successfully",
    sent: candidates.length,
    savedToClient: !!(saveToClient && clientId),
  });
}
