import Link from "next/link";

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-[#166534] text-white py-20 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#0d9488] rounded-full blur-3xl opacity-20" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <h1 className="text-5xl font-bold mb-4">About April</h1>
          <p className="text-xl text-emerald-100">
            Your trusted partner in Bay Area real estate
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Bio Section */}
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-2 bg-[#f59e0b] text-[#166534] text-sm font-semibold rounded-full mb-6">
            BQ Realty · San Jose, CA
          </div>

          <h2 className="text-3xl font-bold mb-8">
            Helping families find their <span className="gradient-text">perfect home</span>
          </h2>

          <p className="text-zinc-600 leading-relaxed text-lg">
            I am a Peninsula-based real estate professional specializing in the local market. By combining deep neighborhood and community knowledge with a rigorous analytical background, I provide my clients with honest, data-driven insights. I advocate tirelessly at every stage of the process to ensure you make confident, well-informed decisions. My goal is to deliver the best possible outcomes that align with both your lifestyle and long-term goals. From A to Z, I am here to guide and support you throughout your buying or selling journey.
          </p>
        </div>

        {/* Credentials */}
        <div className="mb-12">
          <h3 className="font-bold text-lg mb-6 text-center">Credentials & Awards</h3>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              "California Real Estate License #02157957",
              "Member, National Association of Realtors",
              "Certified Residential Specialist (CRS)",
              "Top Producer Award 2022, 2023, 2024",
            ].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-full text-zinc-600 text-sm">
                <span className="w-2 h-2 bg-[#f59e0b] rounded-full" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/contact"
            className="inline-block px-8 py-4 bg-[#166534] text-white font-semibold rounded-full hover:bg-[#14532d] transition-all hover:-translate-y-1"
          >
            Get in Touch
          </Link>
        </div>
      </div>

      {/* Personal touch */}
      <section className="bg-zinc-50 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Beyond Real Estate</h2>
          <p className="text-zinc-600 leading-relaxed text-lg">
            When I&apos;m not helping clients find their dream homes, you can find me
            exploring local farmers markets, hiking in the nearby hills, or spending
            quality time with my family. I believe that truly understanding a community
            means being an active part of it.
          </p>
        </div>
      </section>
    </div>
  );
}
