"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Get role to determine redirect
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const destination =
      redirect || (profile?.role === "admin" ? "/admin" : "/portal");
    router.push(destination);
    router.refresh();
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/api/auth/callback?next=/portal` }
    );

    if (resetError) {
      setError("Failed to send reset email. Please try again.");
    } else {
      setResetSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header bar */}
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

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">
              Client Portal
            </p>
            <h1 className="font-serif text-4xl text-neutral-900 mb-4">
              {showReset ? "Reset Password" : "Welcome Back"}
            </h1>
            <div className="w-16 h-0.5 bg-[#d4a012] mx-auto mb-6" />
            <p className="text-neutral-500 text-sm">
              {showReset
                ? "Enter your email to receive a password reset link."
                : "Sign in to access your materials and messages."}
            </p>
          </div>

          <div className="bg-neutral-50 p-8 md:p-10">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {resetSent ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-2 border-[#d4a012] flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-[#d4a012]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="font-serif text-2xl text-neutral-900 mb-3">
                  Check Your Email
                </h2>
                <p className="text-neutral-500 text-sm mb-6">
                  If an account exists for {email}, you&apos;ll receive a
                  password reset link shortly.
                </p>
                <button
                  onClick={() => {
                    setShowReset(false);
                    setResetSent(false);
                  }}
                  className="text-[#d4a012] text-sm uppercase tracking-wider hover:text-[#b8890f] transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            ) : showReset ? (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-xs uppercase tracking-wider text-neutral-500 mb-3"
                  >
                    Email <span className="text-[#d4a012]">*</span>
                  </label>
                  <input
                    type="email"
                    id="reset-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-12 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300 disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowReset(false)}
                    className="text-neutral-500 text-sm hover:text-neutral-900 transition-colors"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs uppercase tracking-wider text-neutral-500 mb-3"
                  >
                    Email <span className="text-[#d4a012]">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs uppercase tracking-wider text-neutral-500 mb-3"
                  >
                    Password <span className="text-[#d4a012]">*</span>
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowReset(true)}
                    className="text-neutral-500 text-sm hover:text-[#d4a012] transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-12 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300 disabled:opacity-50"
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </button>
                </div>
              </form>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-neutral-400 text-sm uppercase tracking-wider">Loading...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
