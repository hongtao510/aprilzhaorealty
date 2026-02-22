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
    rating: 0,
    content: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.rating === 0) {
      setError("Please rate your experience with April.");
      return;
    }

    if (!formData.name.trim() || !formData.content.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Simulate submission - console log since no backend
    console.log("Feedback Submission:", {
      ...formData,
      submittedAt: new Date().toISOString(),
    });

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const newTestimonial: Testimonial = {
      id: Date.now().toString(),
      name: formData.name,
      email: formData.email || undefined,
      rating: formData.rating,
      content: formData.content,
      createdAt: new Date().toISOString().split("T")[0],
    };

    // Add to local state (would normally be saved to backend)
    setTestimonials([newTestimonial, ...testimonials]);
    setFormData({ name: "", email: "", rating: 0, content: "" });
    setIsSubmitting(false);
    setSubmitted(true);

    // Show alert confirmation
    alert(`Thank you for your feedback, ${newTestimonial.name}!\n\nYour testimonial has been submitted.`);

    // Reset submitted state after 3 seconds
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-[#eae6e1] text-neutral-900 py-24 relative overflow-hidden border-b border-neutral-200">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTEgMGExIDEgMCAxIDAgMiAwIDEgMSAwIDEgMCAtMiAwIiBmaWxsPSIjZDRhMDEyIiBmaWxsLW9wYWNpdHk9IjAuMDgiLz48L2c+PC9zdmc+')] opacity-50" />
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <p className="text-[#d4a012] text-xs uppercase tracking-[0.4em] mb-6">Client Stories</p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-tight mb-8">
            Hear from clients who have
            <span className="block mt-2 text-[#d4a012] italic">worked with me</span>
            on their real estate journey
          </h1>
          <div className="w-20 h-0.5 bg-[#d4a012] mx-auto" />
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
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#166534] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-medium text-[#166534]">Thank you for your feedback!</p>
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
                    className="w-full px-4 py-4 border-2 border-zinc-200 rounded-xl text-base focus:outline-none focus:border-[#166534] transition-colors"
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
                    className="w-full px-4 py-4 border-2 border-zinc-200 rounded-xl text-base focus:outline-none focus:border-[#166534] transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-3">
                    How would you rate your experience with April? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: star })}
                        className="p-2 transition-transform hover:scale-110"
                      >
                        <svg
                          className={`w-8 h-8 ${
                            formData.rating >= star ? "text-[#d4a012] fill-[#d4a012]" : "text-zinc-300"
                          }`}
                          fill={formData.rating >= star ? "currentColor" : "none"}
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                          />
                        </svg>
                      </button>
                    ))}
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
                    className="w-full px-4 py-4 border-2 border-zinc-200 rounded-xl text-base focus:outline-none focus:border-[#166534] transition-colors resize-none"
                    placeholder="Share your experience working with April..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#166534] text-white font-semibold rounded-xl hover:bg-[#14532d] transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/25"
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
                      <div className="w-12 h-12 bg-gradient-to-br from-[#86efac] to-[#0d9488] rounded-full flex items-center justify-center text-white font-bold">
                        {testimonial.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{testimonial.name}</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={`w-4 h-4 ${testimonial.rating >= star ? "text-[#d4a012] fill-[#d4a012]" : "text-zinc-300"}`}
                              fill={testimonial.rating >= star ? "currentColor" : "none"}
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                          ))}
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
            className="inline-block px-8 py-4 bg-[#166534] text-white font-semibold rounded-full hover:bg-[#14532d] transition-all hover:shadow-lg hover:shadow-emerald-500/25"
          >
            Get in Touch
          </a>
        </div>
      </section>
    </div>
  );
}
