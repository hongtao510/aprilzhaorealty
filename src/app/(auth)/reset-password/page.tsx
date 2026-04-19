"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  // Captured from the recovery session so we can bypass the SDK
  // (which has been hanging on browser navigator.locks contention).
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const supabase = createClient();

  // Establish the recovery session. With @supabase/ssr the browser client
  // doesn't always auto-exchange ?code=, so do it explicitly.
  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        console.log("[reset-password] auth event:", event, !!session);
        if (!mounted) return;
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          setRecoveryReady(true);
          if (session?.access_token) setAccessToken(session.access_token);
          setError(null);
        }
      }
    );

    void (async () => {
      // Already have a session? (e.g. previously exchanged)
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        console.log("[reset-password] existing session found");
        if (mounted) {
          setAccessToken(existing.session.access_token);
          setRecoveryReady(true);
        }
        return;
      }

      // Try to exchange the ?code=... param for a session
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        console.log("[reset-password] exchanging code...");
        const { data: exchangeData, error: exchangeErr } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          console.error("[reset-password] exchange failed:", exchangeErr);
          if (mounted) {
            setError(
              `Could not validate the reset link: ${exchangeErr.message}. The link may be expired — request a new one.`
            );
          }
          return;
        }
        console.log("[reset-password] exchange succeeded");
        // Strip the code from the URL so a refresh doesn't try to reuse it
        url.searchParams.delete("code");
        window.history.replaceState({}, "", url.toString());
        if (mounted) {
          if (exchangeData?.session?.access_token) {
            setAccessToken(exchangeData.session.access_token);
          }
          setRecoveryReady(true);
        }
        return;
      }

      // No code, no session — wait for the implicit flow (#access_token=...) just in case
      const timeout = setTimeout(() => {
        if (mounted && !recoveryReady) {
          setInfo(
            "Still waiting for the recovery session... If this stays up, the link may be expired or for a different environment. Request a new reset email."
          );
        }
      }, 4000);
      return () => clearTimeout(timeout);
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    if (!accessToken) {
      setError(
        "No active recovery session. The link may be expired — request a new reset email."
      );
      return;
    }

    setLoading(true);
    // Call Supabase's REST API directly — bypasses the JS SDK's
    // navigator.locks coordination which has been deadlocking with
    // AuthProvider's concurrent session polling.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const abort = new AbortController();
    const timeoutId = setTimeout(() => abort.abort(), 10_000);
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
        signal: abort.signal,
      });
      clearTimeout(timeoutId);
      console.log("[reset-password] PUT /auth/v1/user status:", res.status);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[reset-password] update failed body:", body);
        const msg =
          body?.msg ||
          body?.error_description ||
          body?.message ||
          `HTTP ${res.status}`;
        setError(`Could not update password: ${msg}`);
        setLoading(false);
        return;
      }
      setDone(true);
      setLoading(false);
    } catch (err) {
      clearTimeout(timeoutId);
      const msg =
        err instanceof Error
          ? err.name === "AbortError"
            ? "Request timed out after 10s"
            : err.message
          : String(err);
      console.error("[reset-password] fetch threw:", err);
      setError(
        `Password update failed: ${msg}. Try again, or refresh and request a new reset email.`
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
            {info && !error && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-100 text-amber-800">
                <p className="text-sm">{info}</p>
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
                <p className="text-neutral-500 text-sm mb-6">
                  Your password has been changed successfully.
                </p>
                <Link
                  href="/login"
                  className="inline-block px-12 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300"
                >
                  Sign In
                </Link>
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
                    disabled={!recoveryReady}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors disabled:opacity-50"
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
                    disabled={!recoveryReady}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors disabled:opacity-50"
                    placeholder="Re-enter your password"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !recoveryReady}
                    className="w-full px-12 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300 disabled:opacity-50"
                  >
                    {loading
                      ? "Updating..."
                      : !recoveryReady
                      ? "Verifying reset link..."
                      : "Update Password"}
                  </button>
                </div>

                <p className="text-xs text-neutral-400 text-center">
                  Need a new reset link?{" "}
                  <Link href="/login" className="text-[#d4a012] underline">
                    Request one
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
