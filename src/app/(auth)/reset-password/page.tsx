"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);

    // After 1.5s, route to portal/admin via the existing role-based flow
    setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      router.push(profile?.role === "admin" ? "/admin" : "/portal");
      router.refresh();
    }, 1500);
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
              Account Security
            </p>
            <h1 className="font-serif text-4xl text-neutral-900 mb-4">
              Set New Password
            </h1>
            <div className="w-16 h-0.5 bg-[#d4a012] mx-auto mb-6" />
            <p className="text-neutral-500 text-sm">
              Enter and confirm a new password for your account.
            </p>
          </div>

          <div className="bg-neutral-50 p-8 md:p-10">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {done ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-2 border-[#d4a012] flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-[#d4a012]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-serif text-2xl text-neutral-900 mb-3">
                  Password Updated
                </h2>
                <p className="text-neutral-500 text-sm">
                  Redirecting you now...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="new-password" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                    New Password <span className="text-[#d4a012]">*</span>
                  </label>
                  <input
                    type="password"
                    id="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                    Confirm Password <span className="text-[#d4a012]">*</span>
                  </label>
                  <input
                    type="password"
                    id="confirm-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
                    placeholder="Re-enter your password"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-12 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300 disabled:opacity-50"
                  >
                    {loading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
