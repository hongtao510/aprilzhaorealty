import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How April Zhao Realty handles your information.",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
      <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">Privacy</p>
      <h1 className="font-serif text-4xl text-neutral-900 mb-8">Privacy Policy</h1>
      <div className="w-16 h-0.5 bg-[#d4a012] mb-10" />

      <div className="space-y-6 text-neutral-700 leading-relaxed">
        <p>
          When you create an account on aprilzhaohome.com we collect your email,
          name, and (optionally) phone number. We use this information to run your
          account and to email you new Bay Area real-estate listings that match
          the cities you select.
        </p>
        <p>
          We never sell your information. We share it only with service providers
          needed to operate the site (Supabase for data storage, Resend for email).
        </p>
        <p>
          You can unsubscribe from every email using the one-click link in the
          footer of each message, or change your city preferences at any time from
          your <a href="/portal" className="text-[#d4a012] underline">portal dashboard</a>.
          To delete your account, email{" "}
          <a href="mailto:aprilcasf@gmail.com" className="text-[#d4a012] underline">
            aprilcasf@gmail.com
          </a>.
        </p>
        <p className="text-sm text-neutral-500">
          Last updated: April 2026.
        </p>
      </div>
    </main>
  );
}
