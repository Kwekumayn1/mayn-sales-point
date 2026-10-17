"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ListingForm, { ListingValues } from "./listing-form";

const FEE_PERCENT = 4;
const money = (n: number) => "GHS " + Number(n).toFixed(2);
const withFee = (cost: number) => Math.round(cost * (1 + FEE_PERCENT / 100) * 100) / 100;
const EMPTY: ListingValues = { name: "", desc: "", price: "", imageUrl: "", fields: [] };

function chip(l: any) {
  if (l.status === "pending") return { text: "Under review", cls: "bg-amber-100 text-amber-800" };
  if (l.status === "rejected") return { text: "Removed by admin", cls: "bg-red-100 text-red-800" };
  if (l.paused) return { text: "Paused", cls: "bg-gray-100 text-gray-800" };
  return { text: "Live on your store", cls: "bg-green-100 text-green-800" };
}

export default function SellOwnProductPage() {
  const supabase: any = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [editId, setEditId] = useState("");
  const [formKey, setFormKey] = useState(0);

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

  async function add(v: ListingValues) {
    setError("");
    setNote("");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("vendor_listings").insert({
      vendor_id: u.user.id,
      name: v.name,
      description: v.desc || null,
      cost_price: Number(v.price),
      image_url: v.imageUrl || null,
      custom_fields: v.fields,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setFormKey(formKey + 1);
    setNote("Product added. It is now live on your store link.");
    await load();
  }

  async function saveEdit(l: any, v: ListingValues) {
    setError("");
    setBusy(true);
    const { error: err } = await supabase
      .from("vendor_listings")
      .update({
        name: v.name,
        description: v.desc || null,
        cost_price: Number(v.price),
        image_url: v.imageUrl || null,
        custom_fields: v.fields,
      })
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl text-indigo">Sell own product</h1>
      <p className="mt-1 text-sm text-ink/60">
        List your own products. They show only on your own store link, straight away. The admin can remove anything
        that breaks the rules.
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

      <div className="mt-4 rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-3 font-display text-lg text-indigo">Add a product</h2>
        <ListingForm
          key={formKey}
          initial={EMPTY}
          submitLabel="Add product"
          busy={busy}
          error={editId ? "" : error}
          onSubmit={add}
        />
        {note && <p className="mt-2 text-sm text-leaf">{note}</p>}
      </div>

      <h2 className="mt-8 font-display text-lg text-indigo">Your products</h2>
      {loading && <p className="mt-3 text-sm text-ink/60">Loading...</p>}
      {!loading && rows.length === 0 && <p className="mt-3 text-sm text-ink/60">You have not added a product yet.</p>}

      <div className="mt-3 divide-y divide-line border-t border-line">
        {rows.map((l) => {
          const c = chip(l);
          const editing = editId === l.id;
          const fields: any[] = Array.isArray(l.custom_fields) ? l.custom_fields : [];
          return (
            <div key={l.id} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  {l.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image_url} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" />
                  )}
                  <div>
                    <p className="font-semibold text-ink">{l.name}</p>
                    <p className="text-xs text-ink/60">
                      You receive {money(l.cost_price)} | Customers pay {money(l.customer_price)}
                    </p>
                    {fields.length > 0 && (
                      <p className="text-xs text-ink/60">
                        Asks customers: {fields.map((f: any) => f.label).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <span className={"shrink-0 rounded-full px-3 py-1 text-xs font-semibold " + c.cls}>{c.text}</span>
              </div>
              {l.description && !editing && <p className="mt-1 text-sm text-ink/70">{l.description}</p>}
              {l.status === "rejected" && l.admin_note && (
                <p className="mt-1 text-xs text-red-600">Admin note: {l.admin_note}</p>
              )}

              {editing ? (
                <div className="mt-3">
                  <ListingForm
                    initial={{
                      name: l.name,
                      desc: l.description || "",
                      price: String(l.cost_price),
                      imageUrl: l.image_url || "",
                      fields: fields.map((f: any) => ({ label: String(f.label || ""), required: !!f.required })),
                    }}
                    submitLabel="Save changes"
                    busy={busy}
                    error={error}
                    onSubmit={(v) => saveEdit(l, v)}
                    onCancel={() => setEditId("")}
                  />
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setEditId(l.id);
                      setError("");
                      setNote("");
                    }}
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
