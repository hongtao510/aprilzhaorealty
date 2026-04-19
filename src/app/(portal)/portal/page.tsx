import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FEATURED_CITIES } from "@/lib/redfin-listings";
import { NewsletterPreferences } from "./NewsletterPreferences";

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/portal");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, email, newsletter_cities, filter_property_types, filter_min_price, filter_max_price, filter_min_beds, filter_min_baths, filter_min_sqft, filter_max_sqft"
    )
    .eq("id", user.id)
    .single();

  const cities = FEATURED_CITIES.map((c) => c.name);
  const selected = (profile?.newsletter_cities ?? []) as string[];
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
      <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">
        Your Portal
      </p>
      <h1 className="font-serif text-4xl text-neutral-900 mb-3">
        Welcome back, {firstName}
      </h1>
      <div className="w-16 h-0.5 bg-[#d4a012] mb-8" />

      <section className="bg-neutral-50 p-8 md:p-10 mb-10">
        <h2 className="font-serif text-2xl text-neutral-900 mb-2">
          Listing Newsletter
        </h2>
        <p className="text-neutral-500 text-sm mb-8">
          Select the cities and filters you care about — we&apos;ll email you
          a morning digest when matching listings come on the market, and you
          can{" "}
          <a href="/portal/listings" className="text-[#d4a012] underline">
            browse them anytime
          </a>
          .
        </p>
        <NewsletterPreferences
          cities={cities}
          initialSelected={selected}
          initialFilters={{
            property_types: (profile?.filter_property_types ?? []) as string[],
            min_price: profile?.filter_min_price ?? null,
            max_price: profile?.filter_max_price ?? null,
            min_beds: profile?.filter_min_beds ?? null,
            min_baths: profile?.filter_min_baths ?? null,
            min_sqft: profile?.filter_min_sqft ?? null,
            max_sqft: profile?.filter_max_sqft ?? null,
          }}
        />
      </section>

      <section>
        <h2 className="font-serif text-xl text-neutral-900 mb-4">
          Concierge features
        </h2>
        <p className="text-neutral-500 text-sm mb-4">
          Invited clients can access additional services:
        </p>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="/portal/saved-homes" className="text-[#d4a012] underline">Saved homes</a>
          </li>
          <li>
            <a href="/portal/messages" className="text-[#d4a012] underline">Messages</a>
          </li>
          <li>
            <a href="/portal/materials" className="text-[#d4a012] underline">Materials</a>
          </li>
        </ul>
      </section>
    </main>
  );
}
