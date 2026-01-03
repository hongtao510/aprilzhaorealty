import Link from "next/link";

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-[#381b5e] text-white py-20 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#5e74ff] rounded-full blur-3xl opacity-20" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <h1 className="text-5xl font-bold mb-4">About April</h1>
          <p className="text-xl text-purple-200">
            Your trusted partner in Bay Area real estate
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Photo */}
          <div className="relative">
            <div className="aspect-[3/4] bg-gradient-to-br from-[#c181ff] to-[#5e74ff] rounded-3xl" />
            <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-[#b1ff8f] rounded-2xl -z-10" />
          </div>

          {/* Bio */}
          <div>
            <div className="inline-block px-4 py-2 bg-[#b1ff8f] text-[#381b5e] text-sm font-semibold rounded-full mb-6">
              BQ Realty · San Jose, CA
            </div>

            <h2 className="text-3xl font-bold mb-6">
              Helping families find their <span className="gradient-text">perfect home</span>
            </h2>

            <div className="space-y-4 text-zinc-600 leading-relaxed">
              <p>
                Based in San Jose, I specialize in helping families buy and sell homes
                across the Bay Area. With 23 closed sales and over $57 million in total
                volume, I bring proven results to every transaction.
              </p>
              <p>
                I work with a variety of property types including townhouses, single-family
                homes, and multi-family properties. My average sale price of $2.5M reflects
                my expertise in the competitive Bay Area market.
              </p>
              <p>
                My approach is simple: listen carefully, provide honest guidance, and work
                tirelessly to achieve your goals. Whether you&apos;re buying or selling,
                I&apos;m here to help.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mt-10 py-8 border-y border-zinc-100">
              <div>
                <p className="text-3xl font-bold text-[#381b5e]">23</p>
                <p className="text-sm text-zinc-500">Closed Sales</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#381b5e]">$57.6M</p>
                <p className="text-sm text-zinc-500">Total Volume</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#381b5e]">$2.5M</p>
                <p className="text-sm text-zinc-500">Avg Sale Price</p>
              </div>
            </div>

            {/* Credentials */}
            <div className="mt-10">
              <h3 className="font-bold text-lg mb-4">Credentials & Awards</h3>
              <ul className="space-y-3">
                {[
                  "California Real Estate License #01234567",
                  "Member, National Association of Realtors",
                  "Certified Residential Specialist (CRS)",
                  "Top Producer Award 2022, 2023, 2024",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-600">
                    <div className="w-2 h-2 bg-[#b1ff8f] rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href="/contact"
              className="inline-block mt-10 px-8 py-4 bg-[#381b5e] text-white font-semibold rounded-full hover:bg-[#4a2578] transition-all hover:-translate-y-1"
            >
              Get in Touch
            </Link>
          </div>
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
