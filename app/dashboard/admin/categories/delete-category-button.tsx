"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteCategoryButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const supabase: any = createClient();
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask() {
    setError("");
    setBusy(true);
    const { data } = await supabase.rpc("admin_category_product_count", { p_category: id });
    setCount(Number(data || 0));
    setBusy(false);
    setStep("confirm");
  }

  async function doDelete() {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("admin_delete_category", { p_category: id });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep("idle");
    router.refresh();
  }

  if (step === "confirm") {
    return (
      <div className="text-right">
        <p className="text-xs text-ink/70">
          Delete &quot;{name}&quot;?{" "}
          {count > 0
            ? count + " product" + (count === 1 ? "" : "s") + " will become uncategorized."
            : "No products use it."}
        </p>
        <div className="mt-1 flex justify-end gap-2">
          <button
            onClick={doDelete}
            disabled={busy}
            className="rounded-pill bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={() => setStep("idle")}
            disabled={busy}
            className="rounded-pill border border-line px-3 py-1 text-xs font-semibold text-ink"
          >
            Cancel
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="text-right">
      <button
        onClick={ask}
        disabled={busy}
        className="rounded-pill border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 disabled:opacity-50"
      >
        Delete
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
      }
