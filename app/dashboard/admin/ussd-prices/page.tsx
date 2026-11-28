"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { id: string; price: string; sessions: string; active: boolean };

const card = "rounded-2xl border border-line bg-white p-5";
const input = "w-full rounded-xl border border-line bg-white px-3 py-3 text-sm";
const button =
  "rounded-xl bg-indigo px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";
const dangerButton =
  "rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-50";

function perSession(price: string, sessions: string): string {
  const p = Number(price);
  const s = parseInt(sessions, 10);
  return p > 0 && s > 0 ? (p / s).toFixed(4) : "-";
}

export default function UssdPricesPage() {
  const supabase: any = useMemo(() => createClient(), []);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [billing, setBilling] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [newPrice, setNewPrice] = useState("");
  const [newSessions, setNewSessions] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data: s } = await supabase
      .from("ussd_settings")
      .select("billing_enabled")
      .eq("id", 1)
      .maybeSingle();
    setBilling(!!(s && s.billing_enabled === true));
    const { data } = await supabase
      .from("ussd_packages")
      .select("id, price, sessions, active")
      .order("price", { ascending: true });
    setRows(
      ((data ?? []) as any[]).map((p) => ({
        id: p.id,
        price: String(p.price),
        sessions: String(p.sessions),
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

  async function toggleBilling() {
    const turningOn = !billing;
    const msg = turningOn
      ? "Turn ON charging? From now on every customer session is charged to the vendor. Vendors with no sessions left will be unavailable on USSD."
      : "Turn OFF charging? USSD will be free for all vendors again.";
    if (!window.confirm(msg)) return;
    setBusy("billing");
    setNotice(null);
    const { error } = await supabase.rpc("admin_set_ussd_billing", { p_enabled: turningOn });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    setNotice({ ok: true, text: turningOn ? "Charging is now ON." : "Charging is now OFF." });
    await load();
  }

  async function save(r: Row) {
    setBusy(r.id);
    setNotice(null);
    const { error } = await supabase.rpc("admin_save_ussd_package", {
      p_id: r.id,
      p_price: Number(r.price),
      p_sessions: parseInt(r.sessions, 10),
      p_active: r.active,
    });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    setNotice({ ok: true, text: "Saved. All vendors see this package now." });
    await load();
  }

  async function remove(r: Row) {
    if (
      !window.confirm(
        "Delete the GHS " + r.price + " package (" + r.sessions + " sessions) for ALL vendors? Past purchases stay safe."
      )
    )
      return;
    setBusy(r.id);
    setNotice(null);
    const { error } = await supabase.rpc("admin_delete_ussd_package", { p_id: r.id });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    setNotice({ ok: true, text: "Package deleted for all vendors." });
    await load();
  }

  async function add() {
    setBusy("add");
    setNotice(null);
    const { error } = await supabase.rpc("admin_save_ussd_package", {
      p_id: null,
      p_price: Number(newPrice),
      p_sessions: parseInt(newSessions, 10),
      p_active: true,
    });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    setNotice({ ok: true, text: "Package added. Vendors can buy it now." });
    setNewPrice("");
    setNewSessions("");
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
      <h1 className="mt-1 font-display text-2xl text-indigo">USSD prices</h1>
      <p className="mt-2 text-sm text-ink/60">
        Vendors buy USSD sessions from their Purchase Wallet. Each customer session on a vendor&apos;s menu
        uses 1 session, whether the customer buys or not.
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
        <h2 className="font-display text-lg text-indigo">Charging</h2>
        <p className="mt-1 text-sm">
          Status:{" "}
          <b className={billing ? "text-green-700" : "text-amber-700"}>
            {billing ? "ON (vendors are charged)" : "OFF (USSD is free)"}
          </b>
        </p>
        <p className="mt-1 text-xs text-ink/50">
          Before turning it on, make sure vendors have had time to buy sessions, or you have given them starter
          sessions. Admin accounts are never charged.
        </p>
        <button className={button + " mt-3"} onClick={toggleBilling} disabled={busy !== ""}>
          {billing ? "Turn charging OFF" : "Turn charging ON"}
        </button>
      </section>

      <section className={card + " mt-6"}>
        <h2 className="font-display text-lg text-indigo">Add a package</h2>
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
            placeholder="Sessions"
            inputMode="numeric"
            value={newSessions}
            onChange={(e) => setNewSessions(e.target.value)}
          />
          <button className={button} onClick={add} disabled={busy !== ""}>
            Add package
          </button>
        </div>
        {newPrice && newSessions && (
          <p className="mt-2 text-xs text-ink/50">GHS {perSession(newPrice, newSessions)} per session</p>
        )}
      </section>

      <section className={card + " mt-6"}>
        <h2 className="font-display text-lg text-indigo">Current packages</h2>
        <div className="mt-3 space-y-4">
          {rows.map((r) => (
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
                  Sessions
                  <input
                    className={input + " mt-1"}
                    inputMode="numeric"
                    value={r.sessions}
                    onChange={(e) => edit(r.id, { sessions: e.target.value })}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-ink/50">GHS {perSession(r.price, r.sessions)} per session</p>
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
                <button className={dangerButton} onClick={() => remove(r)} disabled={busy !== ""}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-ink/50">No packages yet. Add one above.</p>}
        </div>
      </section>
    </main>
  );
}

// END OF FILE
