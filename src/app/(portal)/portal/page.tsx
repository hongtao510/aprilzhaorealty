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
    .select("full_name, email, newsletter_cities")
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
          Select the Bay Area cities you&apos;d like to receive new-listing emails for.
          We&apos;ll send a digest each morning when there are new listings in your
          selected cities.
        </p>
        <NewsletterPreferences cities={cities} initialSelected={selected} />
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
