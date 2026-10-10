"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = {
  kind: string;
  item_id: string;
  product_name: string;
  variant_name: string | null;
  base_price: number;
  buying_price: number | null;
  current_price: number | null;
};

export default function AdminVendorPricesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [vendors, setVendors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [markup, setMarkup] = useState("10");
  const [levels, setLevels] = useState<{ lvl: number; vendors: number }[]>([]);
  const [level, setLevel] = useState<number>(1);
  const [lvMarkup, setLvMarkup] = useState("10");
  const [items, setItems] = useState<any[]>([]);
  const [itemInputs, setItemInputs] = useState<Record<string, string>>({});
  const [itemMode, setItemMode] = useState<"price" | "add">("price");
  const [showItems, setShowItems] = useState(false);
  const [tpl, setTpl] = useState<{ markup_pct: number | null; items: any[] }>({
    markup_pct: null,
    items: [],
  });

  async function loadTemplate(lvl: number) {
    const { data, error } = await supabase.rpc("admin_level_template", { p_level: lvl });
    if (!error && data) {
      setTpl(data as { markup_pct: number | null; items: any[] });
    } else {
      setTpl({ markup_pct: null, items: [] });
    }
  }

  useEffect(() => {
    loadTemplate(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  function newVendorText(it: any): string {
    const t = tpl.items.find((x: any) => x.kind === it.kind && x.item_id === it.item_id);
    if (t) {
      return t.mode === "price"
        ? "New vendors get GH\u20B5 " + Number(t.value).toFixed(2)
        : "New vendors get their cost + GH\u20B5 " + Number(t.value).toFixed(2);
    }
    if (tpl.markup_pct !== null && tpl.markup_pct !== undefined) {
      return "New vendors get their cost + " + Number(tpl.markup_pct) + "%";
    }
    return "New vendors: not set yet";
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_list_vendors");
      if (error) {
        setMsg({ ok: false, text: error.message });
        return;
      }
      setVendors(data || []);
      const lv = await supabase.rpc("admin_level_counts");
      if (!lv.error && lv.data) {
        setLevels(lv.data as { lvl: number; vendors: number }[]);
      }
      const il = await supabase.rpc("admin_item_list");
      if (!il.error && il.data) {
        setItems(il.data as any[]);
      }
    })();
  }, [supabase]);

  async function loadSheet(vendorId: string) {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_vendor_price_sheet", {
      p_vendor: vendorId,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    const list: Row[] = (data || []) as Row[];
    setRows(list);
    const next: Record<string, string> = {};
    list.forEach((r) => {
      next[r.item_id] = r.current_price !== null ? String(r.current_price) : "";
    });
    setInputs(next);
  }

  function pickVendor(v: any) {
    setSelected(v);
    setMsg(null);
    setRows([]);
    loadSheet(v.id);
  }

  async function saveRow(r: Row) {
    const price = Number(inputs[r.item_id]);
    if (!isFinite(price) || price <= 0) {
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
    loadSheet(selected.id);
  }

  async function quickFill(overwrite: boolean) {
    const pct = Number(markup);
    if (!isFinite(pct) || pct < 0) {
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
      text:
        "Done. Set: " + d.set + ", kept: " + d.kept + ", skipped: " + d.failed + ".",
    });
    loadSheet(selected.id);
  }

  async function levelFill(overwrite: boolean) {
    const pct = Number(lvMarkup);
    if (!isFinite(pct) || pct < 0) {
      setMsg({ ok: false, text: "Enter a markup of 0 or more." });
      return;
    }
    const count = levels.find((x) => x.lvl === level)?.vendors ?? 0;
    if (count === 0) {
      setMsg({ ok: false, text: "There are no vendors at Level " + level + "." });
      return;
    }
    const ask = overwrite
      ? "Replace ALL prices for every Level " + level + " vendor (" + count + ") with cost + " + pct + "%?"
      : "Fill unpriced items for every Level " + level + " vendor (" + count + ") with cost + " + pct + "%?";
    if (!window.confirm(ask)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_fill_level_prices", {
      p_level: level,
      p_markup_pct: pct,
      p_overwrite: overwrite,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    const d: any = data || {};
    const sv = await supabase.rpc("admin_save_level_markup", {
      p_level: level,
      p_markup_pct: pct,
      p_overwrite: overwrite,
    });
    loadTemplate(level);
    setMsg({
      ok: !sv.error,
      text:
        "Level " + level + " done. Vendors: " + d.vendors + ", prices set: " + d.set +
        ", kept: " + d.kept + ", skipped: " + d.failed + "." +
        (sv.error
          ? " But saving it for future vendors failed: " + sv.error.message
          : " New Level " + level + " vendors will get this too."),
    });
  }

  async function applyItemPrices() {
    const count = levels.find((x) => x.lvl === level)?.vendors ?? 0;
    if (count === 0) {
      setMsg({ ok: false, text: "There are no vendors at Level " + level + "." });
      return;
    }
    const payload: { kind: string; id: string; value: number }[] = [];
    for (const it of items) {
      const raw = (itemInputs[it.kind + it.item_id] || "").trim();
      if (raw === "") continue;
      const value = Number(raw);
      if (!isFinite(value) || value < 0 || (itemMode === "price" && value === 0)) {
        setMsg({
          ok: false,
          text: "Check the amount for " + it.product_name + (it.variant_name ? " \u2014 " + it.variant_name : "") + ".",
        });
        return;
      }
      payload.push({ kind: it.kind, id: it.item_id, value });
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
    loadTemplate(level);
    setMsg({
      ok: !sv.error,
      text:
        "Level " + level + " done. Vendors: " + d.vendors + ", prices set: " + d.set +
        ", skipped: " + d.failed + ". (Skipped = below that vendor's cost, or above what their sub-vendors charge.)" +
        (sv.error
          ? " But saving it for future vendors failed: " + sv.error.message
          : " New Level " + level + " vendors will get these prices too."),
    });
  }

  const q = search.trim().toLowerCase();
  const shown = vendors
    .filter((v) => {
      if (!q) return true;
      return (
        String(v.full_name || "").toLowerCase().includes(q) ||
        String(v.phone || "").toLowerCase().includes(q) ||
        String(v.vendor_code || "").toLowerCase().includes(q)
      );
    })
    .slice(0, 60);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <a href="/dashboard" className="text-sm text-indigo-light">
        &larr; Dashboard
      </a>
      <h1 className="mt-2 text-2xl text-indigo">Set prices for vendors</h1>
      <p className="mt-1 text-sm text-ink/60">
        Pick a vendor or sub-vendor, then set their selling prices. They can still change
        them later. Nobody can go below their own cost.
      </p>

      {msg && (
        <div
          className={`mt-4 rounded-xl p-3 text-sm ${
            msg.ok ? "bg-gold/20 text-indigo" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {!selected && (
        <section className="mt-5">
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="text-sm font-semibold">Bulk prices by level</div>
            <p className="mt-1 text-xs text-ink/60">
              Level 1 = your direct vendors. Level 2 = their sub-vendors, and so on. Do
              Level 1 first, then Level 2, because each level's cost is the level above's
              price.
            </p>
            {levels.length === 0 ? (
              <p className="mt-3 text-xs text-ink/50">No vendors yet.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {levels.map((x) => (
                    <button
                      key={x.lvl}
                      onClick={() => setLevel(x.lvl)}
                      className={`rounded-pill px-4 py-2 text-sm ${
                        level === x.lvl
                          ? "bg-indigo font-bold text-white"
                          : "border border-line bg-white"
                      }`}
                    >
                      Level {x.lvl} &middot; {x.vendors}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={lvMarkup}
                    onChange={(e) => setLvMarkup(e.target.value)}
                    inputMode="decimal"
                    className="w-20 rounded-xl border border-line p-2 text-center text-base"
                  />
                  <span className="text-sm">% markup on their cost</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    onClick={() => levelFill(false)}
                    className="rounded-pill bg-gold px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Fill unpriced &ndash; Level {level}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => levelFill(true)}
                    className="rounded-pill border border-line px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Replace all &ndash; Level {level}
                  </button>
                </div>
                <div className="mt-4 border-t border-line pt-4">
                  <button
                    onClick={() => setShowItems(!showItems)}
                    className="text-sm font-semibold text-indigo"
                  >
                    {showItems ? "\u25BE" : "\u25B8"} Set each item's price for Level {level}
                  </button>
                  {showItems && (
                    <div className="mt-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setItemMode("price")}
                          className={`rounded-pill px-3 py-1.5 text-xs ${
                            itemMode === "price"
                              ? "bg-indigo font-bold text-white"
                              : "border border-line"
                          }`}
                        >
                          Exact price
                        </button>
                        <button
                          onClick={() => setItemMode("add")}
                          className={`rounded-pill px-3 py-1.5 text-xs ${
                            itemMode === "add"
                              ? "bg-indigo font-bold text-white"
                              : "border border-line"
                          }`}
                        >
                          Add GH&#8373; to their cost
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-ink/60">
                        {itemMode === "price"
                          ? "Type the selling price every Level " + level + " vendor will get. Leave an item empty to skip it."
                          : "Type the GH\u20B5 amount to add on top of each vendor's own cost. Leave an item empty to skip it."}
                      </p>
                      <div className="mt-3 space-y-2">
                        {items.map((it) => (
                          <div key={it.kind + it.item_id} className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {it.product_name}
                                {it.variant_name ? " \u2014 " + it.variant_name : ""}
                              </div>
                              <div className="text-xs text-ink/50">
                                Admin price GH&#8373; {Number(it.base_price).toFixed(2)}
                              </div>
                              <div className="text-xs text-indigo-light">
                                {newVendorText(it)}
                              </div>
                            </div>
                            <input
                              value={itemInputs[it.kind + it.item_id] ?? ""}
                              onChange={(e) =>
                                setItemInputs({
                                  ...itemInputs,
                                  [it.kind + it.item_id]: e.target.value,
                                })
                              }
                              inputMode="decimal"
                              placeholder={itemMode === "price" ? "Price" : "+ GH\u20B5"}
                              className="w-24 rounded-xl border border-line p-2 text-base"
                            />
                          </div>
                        ))}
                        {items.length === 0 && (
                          <p className="text-xs text-ink/50">No active products.</p>
                        )}
                      </div>
                      <button
                        disabled={busy}
                        onClick={applyItemPrices}
                        className="mt-4 rounded-pill bg-gold px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Apply to all Level {level} vendors
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or Vendor ID"
            className="mt-5 w-full rounded-xl border border-line bg-white p-3 text-base"
          />
          <div className="mt-3 space-y-2">
            {shown.map((v) => (
              <button
                key={v.id}
                onClick={() => pickVendor(v)}
                className="w-full rounded-xl border border-line bg-white p-3 text-left"
              >
                <div className="font-semibold">{v.full_name || "(no name)"}</div>
                <div className="text-xs text-ink/60">
                  {v.vendor_code || "no ID"} &middot; {v.role}
                  {v.parent_name ? " \u00B7 under " + v.parent_name : " \u00B7 direct"}
                </div>
              </button>
            ))}
            {shown.length === 0 && (
              <p className="py-6 text-center text-sm text-ink/50">No vendors found.</p>
            )}
          </div>
        </section>
      )}

      {selected && (
        <section className="mt-5">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-indigo p-4 text-white">
            <div>
              <div className="font-bold">{selected.full_name || "(no name)"}</div>
              <div className="text-xs text-white/80">
                {selected.vendor_code || "no ID"}
                {selected.parent_name ? " \u00B7 under " + selected.parent_name : " \u00B7 direct"}
              </div>
            </div>
            <button
              onClick={() => {
                setSelected(null);
                setRows([]);
                setMsg(null);
              }}
              className="rounded-pill bg-white/20 px-3 py-1 text-sm"
            >
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
                onChange={(e) => setMarkup(e.target.value)}
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
            {rows.map((r) => (
              <div key={r.kind + r.item_id} className="rounded-xl border border-line bg-white p-3">
                <div className="font-semibold">
                  {r.product_name}
                  {r.variant_name ? " \u2014 " + r.variant_name : ""}
        
