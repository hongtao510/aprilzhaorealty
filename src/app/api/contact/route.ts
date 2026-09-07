import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { escapeHtml } from "@/lib/email-templates";
import { checkRateLimit, requestClientIp } from "@/lib/rate-limit";

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  message: string;
  website?: string;
}

export async function POST(request: NextRequest) {
  try {
    const allowed = await checkRateLimit({
      scope: "contact-form",
      identifier: requestClientIp(request),
      maxRequests: 5,
      windowSeconds: 60 * 60,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many messages. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const body: ContactFormData = await request.json();

    // Honeypot field: browsers leave it empty, basic form bots fill it.
    if (body.website) {
      return NextResponse.json({ message: "Email sent successfully" });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    if (name.length > 120 || email.length > 254 || phone.length > 40 || message.length > 5000) {
      return NextResponse.json(
        { error: "One or more fields are too long" },
        { status: 400 }
      );
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email service is temporarily unavailable" },
        { status: 503 }
      );
    }

    // Send email using Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    const recipientEmail = process.env.CONTACT_EMAIL || "aprilcasf@gmail.com";
    const { data, error } = await resend.emails.send({
      from: "April Zhao Realty <noreply@aprilzhaohome.com>",
      to: [recipientEmail],
      replyTo: email,
      subject: `New Contact Form Submission from ${name.replace(/[\r\n]+/g, " ")}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #166534;">New Contact Form Submission</h2>
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
            <p><strong>Phone:</strong> ${escapeHtml(phone || "Not provided")}</p>
            <p><strong>Message:</strong></p>
            <p style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #166534;">
              ${escapeHtml(message).replace(/\n/g, "<br>")}
            </p>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This email was sent from the contact form on aprilzhaohome.com
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "Unable to send message. Please try again or contact us directly at aprilcasf@gmail.com" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Email sent successfully", id: data?.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
