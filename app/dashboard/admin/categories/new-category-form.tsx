"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewCategoryForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.from("product_categories").insert({ name });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Airtime, Data Bundles, Gift Cards"
        className="flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-pill bg-indigo px-5 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
      >
        {loading ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
