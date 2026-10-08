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
    setMsg({
      ok: true,
      text:
        "Level " + level + " done. Vendors: " + d.vendors + ", prices set: " + d.set +
        ", kept: " + d.kept + ", skipped: " + d.failed + ".",
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
        ← Dashboard
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
                      Level {x.lvl} · {x.vendors}
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
                    Fill unpriced – Level {level}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => levelFill(true)}
                    className="rounded-pill border border-line px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Replace all – Level {level}
                  </button>
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
                  {v.vendor_code || "no ID"} · {v.role}
                  {v.parent_name ? " · under " + v.parent_name : " · direct"}
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
                {selected.parent_name ? " · under " + selected.parent_name : " · direct"}
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
                  {r.variant_name ? " — " + r.variant_name : ""}
                </div>
                <div className="mt-0.5 text-xs text-ink/60">
                  Their cost: GH₵ {Number(r.buying_price).toFixed(2)}
                  {r.current_price === null ? " · not priced yet" : ""}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={inputs[r.item_id] ?? ""}
                    onChange={(e) => setInputs({ ...inputs, [r.item_id]: e.target.value })}
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
      )}
    </main>
  );
    }
