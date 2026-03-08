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

  // Middleware already verified admin access — this is a fallback safety check
  useEffect(() => {
    if (!loading && profile && profile.role !== "admin") {
      router.push("/login");
    }
  }, [loading, profile, router]);

  // Render layout immediately — middleware guarantees admin access,
  // so no need to block on client-side auth loading
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
