"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Display only. The database always works out the real customer price.
const FEE_PERCENT = 4;
const money = (n: number) => "GHS " + Number(n).toFixed(2);
const withFee = (cost: number) => Math.round(cost * (1 + FEE_PERCENT / 100) * 100) / 100;

function chip(l: any) {
  if (l.status === "pending") return { text: "Under review", cls: "bg-amber-100 text-amber-800" };
  if (l.status === "rejected") return { text: "Removed by admin", cls: "bg-red-100 text-red-800" };
  if (l.paused) return { text: "Paused", cls: "bg-gray-100 text-gray-800" };
  return { text: "Live on your store", cls: "bg-green-100 text-green-800" };
}

export default function MyListingsPage() {
  const supabase: any = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [editId, setEditId] = useState("");
  const [eName, setEName] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [ePrice, setEPrice] = useState("");

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u || !u.user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("vendor_listings")
      .select("*")
      .eq("vendor_id", u.user.id)
      .order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function checkPrice(v: string): number | null {
    const n = Number(v);
    if (!v.trim() || Number.isNaN(n) || n <= 0) return null;
    if (Math.round(n * 100) !== n * 100 && Math.abs(Math.round(n * 100) - n * 100) > 0.0001) return null;
    return n;
  }

  async function add(e: any) {
    e.preventDefault();
    setError("");
    setNote("");
    if (name.trim().length < 3) {
      setError("Give the product a name (at least 3 letters).");
      return;
    }
    const n = checkPrice(price);
    if (n === null) {
      setError("Enter a price above 0, with at most 2 decimals.");
      return;
    }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("vendor_listings").insert({
      vendor_id: u.user.id,
      name: name.trim(),
      description: desc.trim() || null,
      cost_price: n,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setName("");
    setDesc("");
    setPrice("");
    setNote("Product added. It is now live on your store link.");
    await load();
  }

  function startEdit(l: any) {
    setEditId(l.id);
    setEName(l.name);
    setEDesc(l.description || "");
    setEPrice(String(l.cost_price));
    setError("");
    setNote("");
  }

  async function saveEdit(l: any) {
    setError("");
    const n = checkPrice(ePrice);
    if (eName.trim().length < 3) {
      setError("Give the product a name (at least 3 letters).");
      return;
    }
    if (n === null) {
      setError("Enter a price above 0, with at most 2 decimals.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase
      .from("vendor_listings")
      .update({ name: eName.trim(), description: eDesc.trim() || null, cost_price: n })
      .eq("id", l.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditId("");
    setNote("Saved.");
    await load();
  }

  async function togglePause(l: any) {
    setError("");
    const { error: err } = await supabase.from("vendor_listings").update({ paused: !l.paused }).eq("id", l.id);
    if (err) setError(err.message);
    await load();
  }

  const box = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-indigo";
  const preview = checkPrice(price);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl text-indigo">My Products</h1>
      <p className="mt-1 text-sm text-ink/60">
        List your own products. They show only on your own store link, straight away. The admin can remove anything that breaks the rules.
      </p>

      <div className="mt-4 rounded-2xl border border-line bg-white p-4 text-sm text-ink/70">
        <p className="font-semibold text-ink">How the price works</p>
        <p className="mt-1">
          You enter the amount you want to receive. We add a {FEE_PERCENT}% service charge, and customers pay the
          total. For example, you enter GHS 100 and customers pay GHS {withFee(100).toFixed(2)}.
        </p>
        <p className="mt-2 text-xs text-ink/50">
          Not allowed: illegal items, counterfeit goods, weapons, adult content, or anything misleading. Listings
          that break these rules are removed.
        </p>
      </div>

      <form onSubmit={add} className="mt-4 space-y-3 rounded-2xl border border-line bg-white p-4">
        <h2 className="font-display text-lg text-indigo">Add a product</h2>
        <div>
          <label className="text-sm font-medium">Product name</label>
          <input value={name} onChange={(e: any) => setName(e.target.value)} className={box} maxLength={80} />
        </div>
        <div>
          <label className="text-sm font-medium">Details (optional)</label>
          <textarea
            value={desc}
            onChange={(e: any) => setDesc(e.target.value)}
            className={box}
            rows={3}
            maxLength={500}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Your price (what you receive), GHS</label>
          <input inputMode="decimal" value={price} onChange={(e: any) => setPrice(e.target.value)} className={box} />
          {preview !== null && (
            <p className="mt-1 text-xs text-leaf">
              Customers will pay {money(withFee(preview))} (includes {FEE_PERCENT}% service charge).
            </p>
          )}
        </div>
        {error && !editId && <p className="text-sm text-red-600">{error}</p>}
        {note && <p className="text-sm text-leaf">{note}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-pill bg-indigo px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving..." : "Add product"}
        </button>
      </form>

      <h2 className="mt-8 font-display text-lg text-indigo">Your products</h2>
      {loading && <p className="mt-3 text-sm text-ink/60">Loading...</p>}
      {!loading && rows.length === 0 && <p className="mt-3 text-sm text-ink/60">You have not added a product yet.</p>}

      <div className="mt-3 divide-y divide-line border-t border-line">
        {rows.map((l) => {
          const c = chip(l);
          const editing = editId === l.id;
          return (
            <div key={l.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{l.name}</p>
                  <p className="text-xs text-ink/60">
                    You receive {money(l.cost_price)} | Customers pay {money(l.customer_price)}
                  </p>
                </div>
                <span className={"rounded-full px-3 py-1 text-xs font-semibold " + c.cls}>{c.text}</span>
              </div>
              {l.description && !editing && <p className="mt-1 text-sm text-ink/70">{l.description}</p>}
              {l.status === "rejected" && l.admin_note && (
                <p className="mt-1 text-xs text-red-600">Admin note: {l.admin_note}</p>
              )}

              {editing ? (
                <div className="mt-3 space-y-2">
                  <input value={eName} onChange={(e: any) => setEName(e.target.value)} className={box} maxLength={80} />
                  <textarea
                    value={eDesc}
                    onChange={(e: any) => setEDesc(e.target.value)}
                    className={box}
                    rows={3}
                    maxLength={500}
                  />
                  <input
                    inputMode="decimal"
                    value={ePrice}
                    onChange={(e: any) => setEPrice(e.target.value)}
                    className={box}
                  />
                  {checkPrice(ePrice) !== null && (
                    <p className="text-xs text-leaf">Customers will pay {money(withFee(checkPrice(ePrice) as number))}</p>
                  )}
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(l)}
                      disabled={busy}
                      className="rounded-pill bg-indigo px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Save changes
                    </button>
                    <button
                      onClick={() => setEditId("")}
                      className="rounded-pill border border-line px-4 py-2 text-xs font-semibold text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => startEdit(l)}
                    className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
                  >
                    Edit
                  </button>
                  {l.status !== "rejected" && (
                    <button
                      onClick={() => togglePause(l)}
                      className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
                    >
                      {l.paused ? "Show on my store again" : "Pause (hide from store)"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

// END OF FILE
