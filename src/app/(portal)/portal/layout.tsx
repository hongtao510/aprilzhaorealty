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
  const { profile, loading } = useAuth();
  const router = useRouter();

  // Middleware already verified auth — this is a fallback safety check
  useEffect(() => {
    if (!loading && !profile) {
      router.push("/login");
    }
  }, [loading, profile, router]);

  // Render layout immediately — middleware guarantees access
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
