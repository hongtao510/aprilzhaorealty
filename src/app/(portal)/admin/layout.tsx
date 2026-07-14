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
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // Middleware already verified admin access — this is a fallback safety check
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push("/login");
      return;
    }

    if (!loading && profile?.role !== "admin") {
      router.push("/login");
    }
  }, [loading, profile, router, user]);

  if (loading || !user || profile?.role !== "admin") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <p className="text-sm text-neutral-500">Checking access...</p>
      </div>
    );
  }

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
