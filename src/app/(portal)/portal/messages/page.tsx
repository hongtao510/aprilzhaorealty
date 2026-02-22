"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import MessageThread from "@/components/portal/MessageThread";

export default function ClientMessagesPage() {
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <div>
      <div className="mb-8">
        <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
          Communication
        </p>
        <h1 className="font-serif text-3xl text-neutral-900">Messages</h1>
        <div className="w-16 h-0.5 bg-[#d4a012] mt-4" />
        <p className="text-neutral-500 text-sm mt-4">
          Chat with April about your properties and documents.
        </p>
      </div>

      <MessageThread clientId={profile.id} apiBase="/api/portal/messages" />
    </div>
  );
}
