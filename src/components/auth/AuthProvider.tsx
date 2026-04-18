"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({
  children,
  initialUser = null,
  initialProfile = null,
}: {
  children: React.ReactNode;
  initialUser?: User | null;
  initialProfile?: Profile | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  // If we already have an SSR-resolved user, skip the loading flash
  const [loading, setLoading] = useState(!initialUser);
  const supabase = createClient();

  async function fetchProfile(userId: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()
        .abortSignal(controller.signal);
      setProfile(data as Profile | null);
    } catch (err) {
      console.error("fetchProfile failed:", err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  useEffect(() => {
    let mounted = true;
    let settled = false;

    function settle() {
      if (!settled && mounted) {
        settled = true;
        setLoading(false);
      }
    }

    // Timeout: never hang more than 5 seconds
    const timeout = setTimeout(() => {
      console.warn("Auth init timed out after 5s");
      settle();
    }, 5000);

    async function init() {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(data.user);
        if (data.user) {
          await fetchProfile(data.user.id);
        }
      } catch (err) {
        console.error("Auth init failed:", err);
      } finally {
        clearTimeout(timeout);
        settle();
      }
    }
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        settle();
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    // Race the Supabase call against a 2s timeout so a hung network
    // never blocks the redirect.
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("signOut timed out")), 2000)
        ),
      ]);
    } catch (err) {
      console.warn("supabase.signOut() failed or timed out:", err);
    }
    setUser(null);
    setProfile(null);
    if (typeof window !== "undefined") {
      // Manually clear Supabase auth cookies as a fallback in case the
      // Supabase call never completed.
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0].trim();
        if (name.startsWith("sb-")) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      });
      window.location.assign("/");
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
