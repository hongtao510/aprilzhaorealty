import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json();

    // Validate required fields
    if (!body.name || !body.email || !body.message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.log("Contact form submission (Resend not configured):", body);
      // Return success for demo purposes when Resend isn't set up
      return NextResponse.json(
        { message: "Message received! (Email service not yet configured)" },
        { status: 200 }
      );
    }

    // Send email using Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    const recipientEmail = process.env.CONTACT_EMAIL || "aprilcasf@gmail.com";
    const { data, error } = await resend.emails.send({
      from: "April Zhao Realty <onboarding@resend.dev>",
      to: [recipientEmail],
      replyTo: body.email,
      subject: `New Contact Form Submission from ${body.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #166534;">New Contact Form Submission</h2>
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
            <p><strong>Name:</strong> ${body.name}</p>
            <p><strong>Email:</strong> <a href="mailto:${body.email}">${body.email}</a></p>
            <p><strong>Phone:</strong> ${body.phone || "Not provided"}</p>
            <p><strong>Message:</strong></p>
            <p style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #166534;">
              ${body.message.replace(/\n/g, "<br>")}
            </p>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This email was sent from the contact form on aprilzhaorealty.com
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
