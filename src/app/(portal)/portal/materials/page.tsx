"use client";

import { useEffect, useState } from "react";

interface MaterialWithUrl {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  description: string | null;
  created_at: string;
  download_url: string;
}

export default function ClientMaterialsPage() {
  const [materials, setMaterials] = useState<MaterialWithUrl[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMaterials() {
      try {
        const res = await fetch("/api/portal/materials");
        if (res.ok) {
          setMaterials(await res.json());
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchMaterials();
  }, []);

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
          Documents
        </p>
        <h1 className="font-serif text-3xl text-neutral-900">Materials</h1>
        <div className="w-16 h-0.5 bg-[#d4a012] mt-4" />
      </div>

      {loading ? (
        <p className="text-neutral-400 text-sm">Loading materials...</p>
      ) : materials.length === 0 ? (
        <div className="bg-neutral-50 border border-neutral-200 p-12 text-center">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-neutral-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p className="text-neutral-500">No materials have been shared yet.</p>
          <p className="text-neutral-400 text-sm mt-2">
            April will share documents with you here when they&apos;re ready.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((material) => (
            <div
              key={material.id}
              className="flex items-center justify-between bg-neutral-50 border border-neutral-200 p-5 hover:border-[#d4a012] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 border border-neutral-200 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-neutral-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
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
                    {formatFileSize(material.file_size)} &middot;{" "}
                    {new Date(material.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <a
                href={material.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 bg-[#d4a012] text-white text-xs uppercase tracking-wider hover:bg-[#b8890f] transition-colors flex-shrink-0"
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
