"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ItemPrices(props: any) {
  const { level, count, tpl, busy, setBusy, setMsg, onSaved } = props;
  const supabase: any = createClient();
  const [items, setItems] = useState<any>([]);
  const [itemInputs, setItemInputs] = useState<any>({});
  const [itemMode, setItemMode] = useState<any>("price");
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      const il = await supabase.rpc("admin_item_list");
      if (!il.error && il.data) {
        setItems(il.data);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function newVendorText(it: any): string {
    const list: any = tpl && tpl.items ? tpl.items : [];
    const t = list.find((x: any) => x.kind === it.kind && x.item_id === it.item_id);
    if (t) {
      return t.mode === "price"
        ? "New vendors get GHS " + Number(t.value).toFixed(2)
        : "New vendors get their cost + GHS " + Number(t.value).toFixed(2);
    }
    if (tpl && tpl.markup_pct !== null && tpl.markup_pct !== undefined) {
      return "New vendors get their cost + " + Number(tpl.markup_pct) + "%";
    }
    return "New vendors: not set yet";
  }

  async function apply() {
    if (count === 0) {
      setMsg({ ok: false, text: "There are no vendors at Level " + level + "." });
      return;
    }
    const payload: any = [];
    for (const it of items) {
      const raw = String(itemInputs[it.kind + it.item_id] || "").trim();
      if (raw === "") continue;
      const value = Number(raw);
      if (!isFinite(value) || 0 > value || (itemMode === "price" && value === 0)) {
        setMsg({ ok: false, text: "Check the amount for " + it.product_name + "." });
        return;
      }
      payload.push({ kind: it.kind, id: it.item_id, value: value });
    }
    if (payload.length === 0) {
      setMsg({ ok: false, text: "Type a price next to at least one item." });
      return;
    }
    const ask =
      "Apply " + payload.length + " item price(s) to all " + count + " Level " + level +
      " vendor(s)? This replaces their current price for those items.";
    if (!window.confirm(ask)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_set_level_item_prices", {
      p_level: level,
      p_items: payload,
      p_mode: itemMode,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    const d: any = data || {};
    const sv = await supabase.rpc("admin_save_level_items", {
      p_level: level,
      p_items: payload,
      p_mode: itemMode,
    });
    onSaved();
    setMsg({
      ok: !sv.error,
      text:
        "Level " + level + " done. Vendors: " + d.vendors + ", prices set: " + d.set +
        ", skipped: " + d.failed + "." +
        (sv.error
          ? " But saving it for future vendors failed: " + sv.error.message
          : " New Level " + level + " vendors will get these prices too."),
    });
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button onClick={() => setShow(!show)} className="text-sm font-semibold text-indigo">
        {show ? "Hide" : "Show"} each item's price for Level {level}
      </button>
      {show && (
        <div className="mt-3">
          <div className="flex gap-2">
            <button
              onClick={() => setItemMode("price")}
              className={itemMode === "price" ? "rounded-pill bg-indigo px-3 py-1.5 text-xs font-bold text-white" : "rounded-pill border border-line px-3 py-1.5 text-xs"}
            >
              Exact price
            </button>
            <button
              onClick={() => setItemMode("add")}
              className={itemMode === "add" ? "rounded-pill bg-indigo px-3 py-1.5 text-xs font-bold text-white" : "rounded-pill border border-line px-3 py-1.5 text-xs"}
            >
              Add GH&#8373; to their cost
            </button>
          </div>
          <p className="mt-2 text-xs text-ink/60">
            {itemMode === "price"
              ? "Type the selling price every vendor at this level will get. Leave an item empty to skip it."
              : "Type the GHS amount to add on top of each vendor's own cost. Leave an item empty to skip it."}
          </p>
          <div className="mt-3 space-y-2">
            {items.map((it: any) => (
              <div key={it.kind + it.item_id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {it.product_name}
                    {it.variant_name ? " - " + it.variant_name : ""}
                  </div>
                  <div className="text-xs text-ink/50">
                    Admin price GH&#8373; {Number(it.base_price).toFixed(2)}
                  </div>
                  <div className="text-xs text-indigo-light">{newVendorText(it)}</div>
                </div>
                <input
                  value={itemInputs[it.kind + it.item_id] ?? ""}
                  onChange={(e: any) =>
                    setItemInputs({ ...itemInputs, [it.kind + it.item_id]: e.target.value })
                  }
                  inputMode="decimal"
                  placeholder={itemMode === "price" ? "Price" : "+ amount"}
                  className="w-24 rounded-xl border border-line p-2 text-base"
                />
              </div>
            ))}
            {items.length === 0 && <p className="text-xs text-ink/50">No active products.</p>}
          </div>
          <button
            disabled={busy}
            onClick={apply}
            className="mt-4 rounded-pill bg-gold px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Apply to all Level {level} vendors
          </button>
        </div>
      )}
    </div>
  );
}

// END OF FILE
