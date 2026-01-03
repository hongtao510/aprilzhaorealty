"use client";

import { useState } from "react";
import { getTestimonials } from "@/lib/data";
import { Testimonial } from "@/lib/types";

export default function TestimonialsPage() {
  const existingTestimonials = getTestimonials();
  const [testimonials, setTestimonials] = useState<Testimonial[]>(existingTestimonials);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    completedTransaction: null as boolean | null,
    content: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.completedTransaction === null) {
      setError("Please indicate whether April helped you complete a transaction.");
      return;
    }

    if (!formData.name.trim() || !formData.content.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Simulate submission - in production, this would call an API
    await new Promise((resolve) => setTimeout(resolve, 500));

    const newTestimonial: Testimonial = {
      id: Date.now().toString(),
      name: formData.name,
      email: formData.email || undefined,
      completedTransaction: formData.completedTransaction,
      content: formData.content,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setTestimonials([newTestimonial, ...testimonials]);
    setFormData({ name: "", email: "", completedTransaction: null, content: "" });
    setIsSubmitting(false);
    setSubmitted(true);

    // Reset submitted state after 3 seconds
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-[#381b5e] text-white py-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#c181ff] rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#5e74ff] rounded-full blur-3xl opacity-15" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <h1 className="text-5xl font-bold mb-4">Client Testimonials</h1>
          <p className="text-xl text-purple-200 max-w-2xl">
            Hear from clients who have worked with me on their real estate journey. Your feedback helps me serve you better.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Feedback Form */}
          <div>
            <div className="sticky top-28">
              <h2 className="text-2xl font-bold mb-2">Share Your Experience</h2>
              <p className="text-zinc-600 mb-8">
                I&apos;d love to hear about your experience working with me.
              </p>

              {submitted && (
                <div className="mb-6 p-4 bg-[#b1ff8f]/20 border border-[#b1ff8f] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#b1ff8f] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-medium text-[#381b5e]">Thank you for your feedback!</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    <p className="font-medium">Please check the form</p>
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="name" className="block text-sm font-semibold mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-4 border-2 border-zinc-200 rounded-xl text-base focus:outline-none focus:border-[#c181ff] transition-colors"
                    placeholder="Your name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold mb-2">
                    Email <span className="text-zinc-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-4 border-2 border-zinc-200 rounded-xl text-base focus:outline-none focus:border-[#c181ff] transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-3">
                    Did April help you complete a real estate transaction? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, completedTransaction: true })}
                      className={`flex-1 py-4 px-6 rounded-xl font-medium border-2 transition-all ${
                        formData.completedTransaction === true
                          ? "border-[#b1ff8f] bg-[#b1ff8f]/20 text-[#381b5e]"
                          : "border-zinc-200 hover:border-[#c181ff]"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Yes
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, completedTransaction: false })}
                      className={`flex-1 py-4 px-6 rounded-xl font-medium border-2 transition-all ${
                        formData.completedTransaction === false
                          ? "border-[#c181ff] bg-[#c181ff]/20 text-[#381b5e]"
                          : "border-zinc-200 hover:border-[#c181ff]"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        No
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="testimonial" className="block text-sm font-semibold mb-2">
                    Your Feedback <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="testimonial"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-4 border-2 border-zinc-200 rounded-xl text-base focus:outline-none focus:border-[#c181ff] transition-colors resize-none"
                    placeholder="Share your experience working with April..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#381b5e] text-white font-semibold rounded-xl hover:bg-[#4a2578] transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-purple-500/25"
                >
                  {isSubmitting ? "Submitting..." : "Submit Testimonial"}
                </button>
              </form>
            </div>
          </div>

          {/* Testimonials List */}
          <div>
            <h2 className="text-2xl font-bold mb-8">What Clients Say</h2>
            <div className="space-y-6">
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.id}
                  className="p-6 bg-zinc-50 rounded-2xl hover:bg-zinc-100 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#c181ff] to-[#5e74ff] rounded-full flex items-center justify-center text-white font-bold">
                        {testimonial.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{testimonial.name}</p>
                        <div className="flex items-center gap-2">
                          {testimonial.completedTransaction ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#b1ff8f]/30 text-[#381b5e] text-xs font-medium rounded-full">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Verified Client
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-200 text-zinc-600 text-xs font-medium rounded-full">
                              Prospective Client
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400">{testimonial.createdAt}</p>
                  </div>
                  <p className="text-zinc-600 leading-relaxed">{testimonial.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <section className="py-16 bg-zinc-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Your Journey?</h2>
          <p className="text-zinc-600 mb-8">
            Join the many satisfied clients who have found their perfect home with April.
          </p>
          <a
            href="/contact"
            className="inline-block px-8 py-4 bg-[#381b5e] text-white font-semibold rounded-full hover:bg-[#4a2578] transition-all hover:shadow-lg hover:shadow-purple-500/25"
          >
            Get in Touch
          </a>
        </div>
      </section>
    </div>
  );
}
