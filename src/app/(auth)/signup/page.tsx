"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("Please agree to the Privacy Policy to continue.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Where the confirmation email link should land the user.
        // Routed through /api/auth/callback so the code exchange runs
        // before the portal redirect. Using window.location.origin makes
        // this environment-aware (works on localhost AND prod).
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/portal`,
        data: {
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        },
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    // Supabase anti-enumeration: when the email is already registered,
    // signUp returns a fake user with identities=[] and no session.
    // Distinguish this from a real first-time signup awaiting confirmation.
    const identities = data.user?.identities ?? [];
    if (data.user && identities.length === 0) {
      setAlreadyRegistered(true);
      setLoading(false);
      return;
    }

    // With email confirmations disabled, signUp returns a session; redirect.
    if (data.session) {
      router.push("/portal");
      router.refresh();
    } else {
      // Real first-time signup, confirmation email sent
      setError(
        "Account created — please check your email to confirm before signing in."
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-neutral-100 bg-white/98 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center">
          <Link href="/" className="flex flex-col group">
            <div className="font-serif text-2xl font-normal tracking-wide text-neutral-900">
              <span className="text-[#d4a012]">April</span> Zhao
            </div>
            <span className="text-[10px] text-[#d4a012] tracking-[0.15em] uppercase">
              Expertise. Ethics. Excellence.
            </span>
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">
              Join April Zhao Realty
            </p>
            <h1 className="font-serif text-4xl text-neutral-900 mb-4">
              Create Account
            </h1>
            <div className="w-16 h-0.5 bg-[#d4a012] mx-auto mb-6" />
            <p className="text-neutral-500 text-sm">
              Sign up to receive daily listings in the Bay Area cities you care about.
            </p>
          </div>

          <div className="bg-neutral-50 p-8 md:p-10">
            {alreadyRegistered ? (
              <div className="py-4">
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900">
                  <p className="text-sm font-medium mb-2">
                    An account with <span className="font-semibold">{email}</span> already exists.
                  </p>
                  <p className="text-sm">
                    Sign in to access it, or use a different email to create a new account.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Link
                    href={`/login?email=${encodeURIComponent(email)}`}
                    className="w-full px-12 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300 text-center"
                  >
                    Sign In Instead
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setAlreadyRegistered(false);
                      setEmail("");
                      setError(null);
                    }}
                    className="text-neutral-500 text-sm hover:text-neutral-900 transition-colors text-center"
                  >
                    Use a different email
                  </button>
                </div>
              </div>
            ) : (
              <>
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700">
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-6">
              <div>
                <label htmlFor="full_name" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                  Full Name <span className="text-[#d4a012]">*</span>
                </label>
                <input
                  type="text"
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                  Email <span className="text-[#d4a012]">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                  Password <span className="text-[#d4a012]">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                  Phone <span className="text-neutral-400 normal-case">(optional)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                  placeholder="(555) 555-1234"
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-neutral-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                  className="mt-1 accent-[#d4a012]"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/privacy" className="text-[#d4a012] underline">
                    Privacy Policy
                  </Link>{" "}
                  and to receive listing emails. I can unsubscribe anytime.
                </span>
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-12 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300 disabled:opacity-50"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </button>
              </div>
            </form>

            <p className="text-sm text-neutral-500 text-center mt-8">
              Already have an account?{" "}
              <Link href="/login" className="text-[#d4a012] hover:text-[#b8890f] transition-colors">
                Sign in
              </Link>
            </p>
              </>
            )}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/"
              className="text-neutral-400 text-sm hover:text-neutral-900 transition-colors uppercase tracking-wider"
            >
              &larr; Back to Website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
