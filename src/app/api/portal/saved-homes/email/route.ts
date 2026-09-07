import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { buildEmailHtml } from "@/lib/email-templates";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

interface EmailRequestBody {
  homeIds?: unknown;
  comments?: unknown;
  subject?: unknown;
  message?: unknown;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : null;
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

    const allowed = await checkRateLimit({
      scope: "saved-homes-email",
      identifier: user.id,
      maxRequests: 5,
      windowSeconds: 60 * 60,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Email limit reached. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const body = (await request.json()) as EmailRequestBody;
    if (!Array.isArray(body.homeIds)) {
      return NextResponse.json(
        { error: "At least one home must be selected" },
        { status: 400 }
      );
    }

    const homeIds = Array.from(
      new Set(body.homeIds.filter((id): id is string => typeof id === "string"))
    );
    if (
      homeIds.length === 0 ||
      homeIds.length > 20 ||
      homeIds.some((id) => !UUID_PATTERN.test(id))
    ) {
      return NextResponse.json(
        { error: "Select between 1 and 20 valid saved homes" },
        { status: 400 }
      );
    }

    const subject = optionalText(body.subject, 150);
    const message = optionalText(body.message, 1500);
    if (subject === null || message === null) {
      return NextResponse.json(
        { error: "Subject or message is too long" },
        { status: 400 }
      );
    }

    const comments =
      body.comments && typeof body.comments === "object" && !Array.isArray(body.comments)
        ? (body.comments as Record<string, unknown>)
        : {};
    for (const [id, comment] of Object.entries(comments)) {
      if (!homeIds.includes(id) || typeof comment !== "string" || comment.length > 500) {
        return NextResponse.json(
          { error: "Invalid home comment" },
          { status: 400 }
        );
      }
    }

    // Never trust listing URLs/details from the caller. Fetch the authenticated
    // user's saved rows and send only to their verified account email.
    const [{ data: profile, error: profileError }, { data: homes, error: homesError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .single(),
        supabase
          .from("saved_homes")
          .select("id, url, title, image_url, address, price")
          .eq("client_id", user.id)
          .in("id", homeIds),
      ]);

    if (profileError || !profile?.email) {
      return NextResponse.json(
        { error: "Unable to find your account email" },
        { status: 500 }
      );
    }
    if (homesError || !homes || homes.length !== homeIds.length) {
      return NextResponse.json(
        { error: "One or more selected homes could not be found" },
        { status: 400 }
      );
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email service is temporarily unavailable" },
        { status: 503 }
      );
    }

    const senderName = profile.full_name || "April Zhao Realty client";
    const homeCount = homes.length;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: "April Zhao Realty <noreply@aprilzhaohome.com>",
      to: [profile.email],
      replyTo: process.env.CONTACT_EMAIL || "aprilcasf@gmail.com",
      subject:
        subject ||
        `${senderName} saved ${homeCount} home${homeCount === 1 ? "" : "s"}`,
      html: buildEmailHtml(
        homes.map((home) => {
          const comment = comments[home.id];
          return {
            ...home,
            comment: typeof comment === "string" ? comment : "",
          };
        }),
        message
      ),
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "Unable to send email right now" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: "Email sent successfully",
      id: data?.id,
      recipientEmail: profile.email,
    });
  } catch (error) {
    console.error("Email homes error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
