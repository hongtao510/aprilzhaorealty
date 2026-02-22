"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import PortalHeader from "@/components/portal/PortalHeader";
import Sidebar from "@/components/portal/Sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile?.role !== "admin") {
      router.push("/login");
    }
  }, [loading, profile, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400 text-sm uppercase tracking-wider">Loading...</p>
      </div>
    );
  }

  if (profile?.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-white">
      <PortalHeader />
      <div className="flex">
        <Sidebar />
        <div className="flex-1 p-8">{children}</div>
      </div>
    </div>
  );
}
