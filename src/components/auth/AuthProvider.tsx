"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
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
  const [loading, setLoading] = useState(!initialUser);
  const supabase = createClient();
  const router = useRouter();

  async function fetchProfile(userId: string): Promise<Profile | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()
        .abortSignal(controller.signal);
      return data as Profile | null;
    } catch (err) {
      console.error("fetchProfile failed:", err);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  useEffect(() => {
    let mounted = true;

    // INITIAL_SESSION hydrates the UI from browser auth storage. Keeping this
    // client-side allows public pages to remain static and CDN-cacheable.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          // Fire-and-forget: don't await inside the listener. If we await,
          // we can hold the SDK's navigator.locks while other SDK calls
          // are trying to proceed, causing the entire signin-then-redirect
          // flow to deadlock.
          setLoading(true);
          void fetchProfile(currentUser.id).then((nextProfile) => {
            if (!mounted) return;
            setProfile(nextProfile);
            setLoading(false);
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
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
      router.push("/");
      router.refresh();
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
