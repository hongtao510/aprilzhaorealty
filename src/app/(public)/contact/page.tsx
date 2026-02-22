"use client";

import { useState } from "react";
import Image from "next/image";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-white">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 border-2 border-[#d4a012] flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10 text-[#d4a012]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-serif text-4xl text-neutral-900 mb-4">Message Sent</h1>
          <div className="w-16 h-0.5 bg-[#d4a012] mx-auto mb-6" />
          <p className="text-neutral-600 leading-relaxed">
            Thank you for reaching out. I&apos;ll get back to you within 24 hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative bg-[#eae6e1] py-24 md:py-32 overflow-hidden border-b border-neutral-200">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, #1a1a1a 1px, transparent 0)', backgroundSize: '40px 40px'}} />
        </div>

        {/* Decorative line */}
        <div className="absolute left-0 top-1/2 w-32 h-px bg-gradient-to-r from-transparent via-[#d4a012] to-transparent opacity-50" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-6">
              Get in Touch
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-neutral-900 mb-6">
              Let&apos;s Start Your Journey
            </h1>
            <div className="w-20 h-0.5 bg-[#d4a012] mb-8" />
            <p className="text-[#d4a012] text-lg tracking-wide">
              Expertise. Ethics. Excellence.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-12 gap-16">

          {/* Contact Info - Left Side */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">
                Contact Information
              </p>
              <h2 className="font-serif text-3xl text-neutral-900 mb-8">
                Reach Out Anytime
              </h2>
              <div className="w-16 h-0.5 bg-[#d4a012] mb-10" />

              <div className="space-y-8">
                {/* Email */}
                <div className="group">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-10 h-10 border border-neutral-200 flex items-center justify-center group-hover:border-[#d4a012] transition-colors">
                      <svg className="w-4 h-4 text-neutral-400 group-hover:text-[#d4a012] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-neutral-400 mb-1">Email</p>
                      <a href="mailto:aprilcasf@gmail.com" className="text-neutral-900 hover:text-[#d4a012] transition-colors">
                        aprilcasf@gmail.com
                      </a>
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div className="group">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-10 h-10 border border-neutral-200 flex items-center justify-center group-hover:border-[#d4a012] transition-colors">
                      <svg className="w-4 h-4 text-neutral-400 group-hover:text-[#d4a012] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-neutral-400 mb-1">Phone</p>
                      <a href="tel:650-200-5221" className="text-neutral-900 hover:text-[#d4a012] transition-colors">
                        650-200-5221
                      </a>
                    </div>
                  </div>
                </div>

                {/* WeChat */}
                <div className="pt-4 border-t border-neutral-100">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 border border-neutral-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.328.328 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098c.997.27 2.065.42 3.167.42 4.8 0 8.69-3.288 8.69-7.343 0-4.054-3.89-7.344-8.69-7.344z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-neutral-400 mb-1">WeChat</p>
                      <p className="text-neutral-600 text-sm mb-4">Scan to connect</p>
                      <div className="inline-block p-3 bg-white border border-neutral-200 hover:border-[#d4a012] transition-colors">
                        <Image
                          src="/wechat-qr.png?v=3"
                          alt="WeChat QR Code"
                          width={140}
                          height={140}
                          className="block"
                          unoptimized
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form - Right Side */}
          <div className="lg:col-span-7">
            <div className="bg-neutral-50 p-8 md:p-12">
              <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">
                Send a Message
              </p>
              <h2 className="font-serif text-3xl text-neutral-900 mb-4">
                How Can I Help?
              </h2>
              <p className="text-neutral-600 mb-10 leading-relaxed">
                Fill out the form below and I&apos;ll get back to you as soon as possible.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-700">
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                      Name <span className="text-[#d4a012]">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                      placeholder="Your name"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                      Email <span className="text-[#d4a012]">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                    Phone <span className="text-neutral-400 normal-case">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                    Message <span className="text-[#d4a012]">*</span>
                  </label>
                  <textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={5}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors resize-none"
                    placeholder="Tell me about what you're looking for..."
                    required
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-12 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300 disabled:opacity-50"
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
