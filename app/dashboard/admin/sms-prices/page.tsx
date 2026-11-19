"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { id: string; price: string; units: string; active: boolean };

const card = "rounded-2xl border border-line bg-white p-5";
const input = "w-full rounded-xl border border-line bg-white px-3 py-3 text-sm";
const button =
  "rounded-xl bg-indigo px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";

export default function SmsPricesPage() {
  const supabase: any = useMemo(() => createClient(), []);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [newPrice, setNewPrice] = useState("");
  const [newUnits, setNewUnits] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("sms_packages")
      .select("id, price, units, active")
      .order("price", { ascending: true });
    setRows(
      ((data ?? []) as any[]).map((p) => ({
        id: p.id,
        price: String(p.price),
        units: String(p.units),
        active: p.active === true,
      }))
    );
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAllowed(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const ok = profile && (profile.role === "admin" || profile.role === "super_admin");
      setAllowed(!!ok);
      if (ok) await load();
    })();
  }, [supabase, load]);

  function edit(id: string, patch: Partial<Row>) {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save(r: Row) {
    setBusy(r.id);
    setNotice(null);
    const { error } = await supabase.rpc("admin_save_sms_package", {
      p_id: r.id,
      p_price: Number(r.price),
      p_units: parseInt(r.units, 10),
      p_active: r.active,
    });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    setNotice({ ok: true, text: "Saved. All vendors now see this bundle." });
    await load();
  }

  async function remove(r: Row) {
    if (
      !window.confirm(
        "Delete the GHS " + r.price + " bundle (" + r.units + " units) for ALL vendors? Past purchases stay safe."
      )
    )
      return;
    setBusy(r.id);
    setNotice(null);
    const { error } = await supabase.rpc("admin_delete_sms_package", { p_id: r.id });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    setNotice({ ok: true, text: "Bundle deleted for all vendors." });
    await load();
  }

  async function add() {
    setBusy("add");
    setNotice(null);
    const { error } = await supabase.rpc("admin_save_sms_package", {
      p_id: null,
      p_price: Number(newPrice),
      p_units: parseInt(newUnits, 10),
      p_active: true,
    });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    setNotice({ ok: true, text: "Bundle added. All vendors can buy it now." });
    setNewPrice("");
    setNewUnits("");
    await load();
  }

  if (allowed === null) {
    return <main className="mx-auto max-w-4xl px-6 py-10 text-sm text-ink/60">Loading...</main>;
  }
  if (!allowed) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10 text-sm text-red-700">
        This page is for admins only.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-ink/50">Admin</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">SMS prices</h1>
      <p className="mt-2 text-sm text-ink/60">
        These bundles are what every vendor sees on the SMS Marketing page. Changes apply to all vendors
        straight away. Untick Active to hide a bundle without deleting it.
      </p>

      {notice && (
        <div
          className={
            "mt-4 rounded-xl px-4 py-3 text-sm font-semibold " +
            (notice.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900")
          }
        >
          {notice.text}
        </div>
      )}

      <section className={card + " mt-6"}>
        <h2 className="font-display text-lg text-indigo">Add a bundle</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            className={input}
            placeholder="Price in GHS"
            inputMode="decimal"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
          <input
            className={input}
            placeholder="SMS units"
            inputMode="numeric"
            value={newUnits}
            onChange={(e) => setNewUnits(e.target.value)}
          />
          <button className={button} onClick={add} disabled={busy !== ""}>
            Add bundle
          </button>
        </div>
      </section>

      <section className={card + " mt-6"}>
        <h2 className="font-display text-lg text-indigo">Current bundles</h2>
        <div className="mt-3 space-y-4">
          {rows.map((r) => {
            const p = Number(r.price);
            const u = parseInt(r.units, 10);
            const rate = p > 0 && u > 0 ? (u / p).toFixed(1) : "-";
            return (
              <div key={r.id} className="rounded-xl border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs text-ink/50">
                    Price (GHS)
                    <input
                      className={input + " mt-1"}
                      inputMode="decimal"
                      value={r.price}
                      onChange={(e) => edit(r.id, { price: e.target.value })}
                    />
                  </label>
                  <label className="text-xs text-ink/50">
                    SMS units
                    <input
                      className={input + " mt-1"}
                      inputMode="numeric"
                      value={r.units}
                      onChange={(e) => edit(r.id, { units: e.target.value })}
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-ink/50">{rate} units per GHS 1</p>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => edit(r.id, { active: e.target.checked })}
                  />
                  Active (visible to vendors)
                </label>
                <div className="mt-3 flex gap-2">
                  <button className={button} onClick={() => save(r)} disabled={busy !== ""}>
                    {busy === r.id ? "Working..." : "Save"}
                  </button>
                  <button
                    className="rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-50"
                    onClick={() => remove(r)}
                    disabled={busy !== ""}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <p className="text-sm text-ink/50">No bundles yet. Add one above.</p>}
        </div>
      </section>
    </main>
  );
}

// END OF FILE
