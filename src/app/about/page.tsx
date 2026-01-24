"use client";

import Link from "next/link";
import Image from "next/image";
import ScrollReveal from "@/components/ScrollReveal";

export default function AboutPage() {
  return (
    <div>
      {/* Hero - Editorial Style */}
      <section className="min-h-[60vh] bg-neutral-900 text-white flex items-center relative overflow-hidden">
        {/* Large decorative letter */}
        <div className="absolute -right-20 top-1/2 -translate-y-1/2 text-[40rem] font-serif text-white/[0.02] leading-none select-none pointer-events-none">
          A
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-8 w-full relative z-10">
          <div className="max-w-3xl">
            <ScrollReveal>
              <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-8">
                About April Zhao
              </p>
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-normal mb-8 leading-[1.1]">
                Your Trusted Partner
                <span className="block text-[#d4a012]">on the Journey Home</span>
              </h1>
              <div className="w-24 h-0.5 bg-[#d4a012]" />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Main Content - Asymmetric Layout */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-16 items-start">
            {/* Left Column - Sticky Info */}
            <div className="lg:col-span-4 lg:sticky lg:top-32">
              <ScrollReveal>
                <h2 className="font-serif text-2xl text-neutral-900 mb-2">
                  April Zhao <span className="text-neutral-400">|</span> <span className="text-sm font-sans">DRE # 02157957</span>
                </h2>

                <p className="text-[#d4a012] text-sm font-medium tracking-wide mb-4">
                  Expertise. Ethics. Excellence.
                </p>

                <p className="text-neutral-600 text-sm mb-6">
                  Top 1% Real Estate Agents by Brokerage in 2025
                </p>

                <div className="mb-10">
                  <Image
                    src="/bq-realty-logo.png"
                    alt="BQ Realty"
                    width={140}
                    height={33}
                    className="object-contain"
                  />
                </div>

                <Link
                  href="/contact"
                  className="inline-block px-8 py-4 bg-neutral-900 text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#d4a012] transition-all duration-300"
                >
                  Let&apos;s Connect
                </Link>
              </ScrollReveal>
            </div>

            {/* Right Column - Bio Content */}
            <div className="lg:col-span-7 lg:col-start-6">
              <ScrollReveal delay={100}>
                <div className="space-y-6 text-neutral-600 text-lg leading-relaxed">
                  <p>
                    April has lived and worked in the Peninsula and San Francisco for many years, developing deep knowledge of local market dynamics and strong community insights. Holding a Ph.D. in business, April is trained to make analytical and strategic decisions grounded in ethics and integrity, providing honest, intelligence-driven guidance and support her clients can trust.
                  </p>
                  <p>
                    April advocates tirelessly for her clients at every stage of the process, ensuring they make confident, well-informed decisions. She is committed to delivering exceptional, personalized service tailored to each client and consistently exceeding expectations to achieve the best possible outcomes.
                  </p>
                  <p className="text-neutral-900 font-medium">
                    From A to Z, April is here to ensure your buying or selling journey is seamless, informed, and successful.
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
