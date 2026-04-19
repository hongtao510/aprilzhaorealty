"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  current: string;
  options: Array<{ value: string; label: string }>;
}

export function SortSelect({ current, options }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (e.target.value === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", e.target.value);
    }
    const qs = params.toString();
    router.push(qs ? `/portal/listings?${qs}` : "/portal/listings");
  }

  return (
    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500">
      <span>Sort</span>
      <select
        value={current}
        onChange={onChange}
        className="bg-white border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-[#d4a012]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
