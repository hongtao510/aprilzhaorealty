"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import type { Profile, Material, SavedHome } from "@/lib/types";
import FileUpload from "@/components/portal/FileUpload";
import MessageThread from "@/components/portal/MessageThread";
import SavedHomeCard from "@/components/portal/SavedHomeCard";

type Tab = "materials" | "messages" | "saved-homes";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [client, setClient] = useState<Profile | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [savedHomes, setSavedHomes] = useState<SavedHome[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("materials");
  const [loading, setLoading] = useState(true);

  async function fetchClient() {
    try {
      const [clientRes, homesRes] = await Promise.all([
        fetch(`/api/admin/clients/${id}`),
        fetch(`/api/admin/saved-homes?client_id=${id}`),
      ]);
      if (clientRes.ok) {
        const data = await clientRes.json();
        setClient(data.profile);
        setMaterials(data.materials);
      }
      if (homesRes.ok) {
        const homes = await homesRes.json();
        setSavedHomes(homes);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDeleteMaterial(materialId: string) {
    if (!confirm("Delete this file?")) return;
    try {
      const res = await fetch(`/api/admin/materials/${materialId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMaterials(materials.filter((m) => m.id !== materialId));
      }
    } catch {
      // fail silently
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-neutral-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500 mb-4">Client not found.</p>
        <Link href="/admin/clients" className="text-[#d4a012] text-sm">
          Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/clients"
          className="text-neutral-400 text-sm hover:text-neutral-900 transition-colors uppercase tracking-wider"
        >
          &larr; Back to Clients
        </Link>
      </div>

      {/* Client info */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-neutral-900 mb-2">
          {client.full_name}
        </h1>
        <div className="w-16 h-0.5 bg-[#d4a012] mb-4" />
        <div className="flex gap-6 text-sm text-neutral-500">
          <span>{client.email}</span>
          {client.phone && <span>{client.phone}</span>}
          <span>
            Joined {new Date(client.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-neutral-200 mb-6">
        {(["materials", "messages", "saved-homes"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[#d4a012] text-[#d4a012]"
                : "border-transparent text-neutral-400 hover:text-neutral-900"
            }`}
          >
            {tab === "saved-homes" ? "Saved Homes" : tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "materials" && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-4">
              Upload New Material
            </h2>
            <FileUpload clientId={id} onUploadComplete={fetchClient} />
          </div>

          <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-4">
            Shared Materials ({materials.length})
          </h2>
          {materials.length === 0 ? (
            <p className="text-neutral-400 text-sm bg-neutral-50 border border-neutral-200 p-6 text-center">
              No materials shared yet.
            </p>
          ) : (
            <div className="space-y-2">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="flex items-center justify-between bg-neutral-50 border border-neutral-200 p-4 hover:border-[#d4a012] transition-colors"
                >
                  <div>
                    <p className="text-neutral-900 text-sm font-medium">
                      {material.file_name}
                    </p>
                    {material.description && (
                      <p className="text-neutral-400 text-xs mt-1">
                        {material.description}
                      </p>
                    )}
                    <p className="text-neutral-400 text-xs mt-1">
                      {(material.file_size / 1024).toFixed(1)} KB &middot;{" "}
                      {new Date(material.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteMaterial(material.id)}
                    className="text-neutral-400 hover:text-red-500 transition-colors text-xs uppercase tracking-wider"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "messages" && (
        <MessageThread clientId={id} apiBase="/api/admin/messages" />
      )}

      {activeTab === "saved-homes" && (
        <div>
          <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-4">
            Saved Homes ({savedHomes.length})
          </h2>
          {savedHomes.length === 0 ? (
            <p className="text-neutral-400 text-sm bg-neutral-50 border border-neutral-200 p-6 text-center">
              No saved homes yet.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedHomes.map((home) => (
                <SavedHomeCard
                  key={home.id}
                  home={home}
                  showRemove={false}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
