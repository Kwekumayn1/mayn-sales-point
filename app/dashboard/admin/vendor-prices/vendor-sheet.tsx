"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function VendorSheet(props: any) {
  const { selected, onBack, setMsg } = props;
  const supabase: any = createClient();
  const [rows, setRows] = useState<any>([]);
  const [inputs, setInputs] = useState<any>({});
  const [markup, setMarkup] = useState("10");
  const [busy, setBusy] = useState(false);

  async function loadSheet() {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_vendor_price_sheet", {
      p_vendor: selected.id,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    const list: any = data || [];
    setRows(list);
    const next: any = {};
    list.forEach((r: any) => {
      next[r.item_id] = r.current_price !== null ? String(r.current_price) : "";
    });
    setInputs(next);
  }

  useEffect(() => {
    loadSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id]);

  async function saveRow(r: any) {
    const price = Number(inputs[r.item_id]);
    if (!isFinite(price) || 0 >= price) {
      setMsg({ ok: false, text: "Enter a price greater than 0." });
      return;
    }
    setBusy(true);
    const res =
      r.kind === "product"
        ? await supabase.rpc("admin_set_vendor_price", {
            p_vendor: selected.id,
            p_product: r.item_id,
            p_price: price,
          })
        : await supabase.rpc("admin_set_variant_price", {
            p_vendor: selected.id,
            p_variant: r.item_id,
            p_price: price,
          });
    setBusy(false);
    if (res.error) {
      setMsg({ ok: false, text: res.error.message });
      return;
    }
    setMsg({ ok: true, text: "Saved." });
    loadSheet();
  }

  async function quickFill(overwrite: boolean) {
    const pct = Number(markup);
    if (!isFinite(pct) || 0 > pct) {
      setMsg({ ok: false, text: "Enter a markup of 0 or more." });
      return;
    }
    const ask = overwrite
      ? "Replace ALL of this vendor's prices with cost + " + pct + "%?"
      : "Fill every unpriced item with cost + " + pct + "%?";
    if (!window.confirm(ask)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_fill_vendor_prices", {
      p_vendor: selected.id,
      p_markup_pct: pct,
      p_overwrite: overwrite,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    const d: any = data || {};
    setMsg({
      ok: true,
      text: "Done. Set: " + d.set + ", kept: " + d.kept + ", skipped: " + d.failed + ".",
    });
    loadSheet();
  }

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-indigo p-4 text-white">
        <div>
          <div className="font-bold">{selected.full_name || "(no name)"}</div>
          <div className="text-xs text-white/80">
            {selected.vendor_code || "no ID"}
            {selected.parent_name ? " - under " + selected.parent_name : " - direct"}
          </div>
        </div>
        <button onClick={onBack} className="rounded-pill bg-white/20 px-3 py-1 text-sm">
          Change
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <div className="text-sm font-semibold">Quick fill</div>
        <p className="mt-1 text-xs text-ink/60">
          Sets price = their cost + markup %. Pick a % and tap a button.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={markup}
            onChange={(e: any) => setMarkup(e.target.value)}
            inputMode="decimal"
            className="w-20 rounded-xl border border-line p-2 text-center text-base"
          />
          <span className="text-sm">%</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => quickFill(false)}
            className="rounded-pill bg-gold px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Fill unpriced items
          </button>
          <button
            disabled={busy}
            onClick={() => quickFill(true)}
            className="rounded-pill border border-line px-4 py-2 text-sm disabled:opacity-50"
          >
            Replace all prices
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((r: any) => (
          <div key={r.kind + r.item_id} className="rounded-xl border border-line bg-white p-3">
            <div className="font-semibold">
              {r.product_name}
              {r.variant_name ? " - " + r.variant_name : ""}
            </div>
            <div className="mt-0.5 text-xs text-ink/60">
              Their cost: GH&#8373; {Number(r.buying_price).toFixed(2)}
              {r.current_price === null ? " - not priced yet" : ""}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={inputs[r.item_id] ?? ""}
                onChange={(e: any) => setInputs({ ...inputs, [r.item_id]: e.target.value })}
                inputMode="decimal"
                placeholder="Price"
                className="w-full rounded-xl border border-line p-2 text-base"
              />
              <button
                disabled={busy}
                onClick={() => saveRow(r)}
                className="rounded-pill bg-indigo px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && !busy && (
          <p className="py-6 text-center text-sm text-ink/50">No active products.</p>
        )}
      </div>
    </section>
  );
}

// END OF FILE
