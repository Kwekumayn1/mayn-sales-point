"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SubItem(props: {
  v: any;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const v = props.v;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(v.name);
  const [price, setPrice] = useState(String(v.base_price));
  const [busy, setBusy] = useState(false);

  async function save() {
    props.onError("");
    const num = Number(price);
    if (name.trim() === "") {
      props.onError("Name cannot be empty.");
      return;
    }
    if (price.trim() === "" || isNaN(num) || num < 0) {
      props.onError("Enter a valid price.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const res = await supabase
      .from("product_variants")
      .update({ name: name.trim(), base_price: num })
      .eq("id", v.id);
    setBusy(false);
    if (res.error) {
      props.onError(res.error.message);
      return;
    }
    setEditing(false);
    props.onChanged();
  }

  async function remove() {
    if (!confirm("Delete this sub-product? Past orders stay in your records. This cannot be undone.")) {
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const res = await supabase.from("product_variants").delete().eq("id", v.id);
    setBusy(false);
    if (res.error) {
      props.onError(res.error.message);
      return;
    }
    props.onChanged();
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 border border-line bg-white px-3 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          className="w-28 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
        />
        <button onClick={save} disabled={busy} className="text-xs font-medium text-indigo">
          Save
        </button>
        <button onClick={() => setEditing(false)} disabled={busy} className="text-xs text-ink/60">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border border-line bg-white px-3 py-2">
      <span>
        {v.name} - GH₵{Number(v.base_price).toFixed(2)}
      </span>
      <span className="flex gap-3">
        <button onClick={() => setEditing(true)} disabled={busy} className="text-xs text-indigo">
          Edit
        </button>
        <button onClick={remove} disabled={busy} className="text-xs text-red-600">
          Delete
        </button>
      </span>
    </div>
  );
}
