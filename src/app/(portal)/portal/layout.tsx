"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import PortalHeader from "@/components/portal/PortalHeader";
import ClientSidebar from "@/components/portal/ClientSidebar";

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const hasPortalAccess =
    !!user && (profile?.role === "client" || profile?.role === "admin");

  // Middleware already verified auth — this is a fallback safety check
  useEffect(() => {
    if (!loading && !hasPortalAccess) {
      router.push("/login");
    }
  }, [hasPortalAccess, loading, router]);

  if (loading || !hasPortalAccess) {
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
        <ClientSidebar />
        <div className="flex-1 p-8">{children}</div>
      </div>
    </div>
  );
}
