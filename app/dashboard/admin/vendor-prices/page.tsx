"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LevelPanel from "./level-panel";
import VendorSheet from "./vendor-sheet";

export default function AdminVendorPricesPage() {
  const supabase: any = createClient();
  const [vendors, setVendors] = useState<any>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [msg, setMsg] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_list_vendors");
      if (error) {
        setMsg({ ok: false, text: error.message });
        return;
      }
      setVendors(data || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = search.trim().toLowerCase();
  const shown = vendors
    .filter((v: any) => {
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
          className={
            msg.ok
              ? "mt-4 rounded-xl bg-gold/20 p-3 text-sm text-indigo"
              : "mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          }
        >
          {msg.text}
        </div>
      )}

      {!selected && (
        <section className="mt-5">
          <LevelPanel setMsg={setMsg} />
          <input
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            placeholder="Search name, phone or Vendor ID"
            className="mt-5 w-full rounded-xl border border-line bg-white p-3 text-base"
          />
          <div className="mt-3 space-y-2">
            {shown.map((v: any) => (
              <button
                key={v.id}
                onClick={() => {
                  setMsg(null);
                  setSelected(v);
                }}
                className="w-full rounded-xl border border-line bg-white p-3 text-left"
              >
                <div className="font-semibold">{v.full_name || "(no name)"}</div>
                <div className="text-xs text-ink/60">
                  {v.vendor_code || "no ID"} &middot; {v.role}
                  {v.parent_name ? " - under " + v.parent_name : " - direct"}
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
        <VendorSheet
          selected={selected}
          setMsg={setMsg}
          onBack={() => {
            setSelected(null);
            setMsg(null);
          }}
        />
      )}
    </main>
  );
}

// END OF FILE
