"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { sortVariants } from "./sort-helper";

// Set to true if your order list / export shows field names better when
// stored by label instead of by field id.
const STORE_BY_LABEL = false;

type Product = { id: string; name: string; base_price: number };
type Variant = { id: string; product_id: string; name: string; base_price: number };
type Field = {
  id: string;
  product_id: string;
  label: string;
  field_type: string | null;
  is_required: boolean;
  sort_order: number | null;
};

const money = (n: number) => "GHS " + Number(n).toFixed(2);

function inputModeFor(t: string | null): "numeric" | "tel" | "email" | "text" {
  const x = (t || "").toLowerCase();
  if (x === "number") return "numeric";
  if (x === "phone" || x === "tel") return "tel";
  if (x === "email") return "email";
  return "text";
}

export default function WalletOrderPage() {
  const supabase: any = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState<{ text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadBalance(uid: string) {
    const { data } = await supabase
      .from("wallet_transactions")
      .select("amount")
      .eq("vendor_id", uid)
      .eq("wallet_type", "purchase");
    const sum = (data || []).reduce((a: number, r: any) => a + Number(r.amount || 0), 0);
    setBalance(sum);
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) {
        setError("Please sign in.");
        setLoading(false);
        return;
      }
      const [p, v, f, c] = await Promise.all([
        supabase.from("products").select("id,name,base_price").eq("is_active", true).order("name"),
        supabase
          .from("product_variants")
          .select("id,product_id,name,base_price")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("product_fields")
          .select("id,product_id,label,field_type,is_required,sort_order")
          .order("sort_order"),
        supabase.rpc("my_buying_prices"),
      ]);
      const cm: Record<string, number> = {};
      for (const r of (c.data || []) as any[]) cm[r.kind + ":" + r.item_id] = Number(r.price);
      setCosts(cm);
      if (p.error) setError(p.error.message);
      setProducts((p.data || []) as Product[]);
      setVariants((v.data || []) as Variant[]);
      setFields((f.data || []) as Field[]);
      await loadBalance(uid);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const costOfProduct = (p: Product) => costs["product:" + p.id] ?? Number(p.base_price);
  const costOfVariant = (v: Variant) => costs["variant:" + v.id] ?? Number(v.base_price);
  const variantsOf = (pid: string) =>
    sortVariants(variants.filter((x) => x.product_id === pid), costOfVariant);
  const fieldsOf = (pid: string) => fields.filter((x) => x.product_id === pid);

  const tiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((p) => {
        const vs = variantsOf(p.id);
        const price = vs.length ? Math.min(...vs.map((x) => costOfVariant(x))) : costOfProduct(p);
        return { p, price, hasVariants: vs.length > 0 };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, variants, costs, search]);

  function openSheet(p: Product) {
    setOpen(p);
    setVariantId("");
    setValues({});
    setFormError("");
    setDone(null);
    setCopied(false);
  }

  const openVariants = open ? variantsOf(open.id) : [];
  const openFields = open ? fieldsOf(open.id) : [];
  const chosen = openVariants.find((x) => x.id === variantId);
  const cost = open ? (openVariants.length ? (chosen ? costOfVariant(chosen) : null) : costOfProduct(open)) : null;

  async function buy() {
    if (!open) return;
    setFormError("");
    if (openVariants.length && !variantId) {
      setFormError("Choose an option first.");
      return;
    }
    for (const f of openFields) {
      if (f.is_required && !(values[f.id] || "").trim()) {
        setFormError(f.label + " is required.");
        return;
      }
    }
    setBusy(true);
    const { data, error: err } = await supabase.rpc("vendor_place_wallet_order_v2", {
      p_product_id: open.id,
      p_variant_id: openVariants.length ? variantId : null,
      p_custom_field_values: values,
      p_use_labels: STORE_BY_LABEL,
    });
    setBusy(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const { data: u } = await supabase.auth.getUser();
    if (u?.user?.id) await loadBalance(u.user.id);
    const name = open.name + (chosen ? " - " + chosen.name : "");
    const lines = [
      "Wallet purchase successful",
      "Order: " + row?.order_number,
      "Item: " + name,
      "Amount: " + money(row?.unit_price ?? cost ?? 0),
    ];
    for (const f of openFields) {
      const v = (values[f.id] || "").trim();
      if (v) lines.push(f.label + ": " + v);
    }
    lines.push("Time: " + new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" }));
    setDone({ text: lines.join("\n") });
  }

  async function copy() {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.text);
    } catch {
      const t = document.createElement("textarea");
      t.value = done.text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
    }
    setCopied(true);
  }

  return (
    <div className="mx-auto max-w-4xl p-4 pb-10">
      <h1 className="text-xl font-bold text-indigo">Buy with wallet</h1>
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-white p-4">
        <div>
          <div className="text-xs text-ink/60">Purchase wallet balance</div>
          <div className="text-2xl font-bold text-ink">{money(balance)}</div>
        </div>
        <Link href="/dashboard/wallet" className="rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-white">
          Top up
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products"
        className="mt-4 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-ink/60">Loading...</p>}
      {!loading && tiles.length === 0 && <p className="mt-4 text-sm text-ink/60">No products found.</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ p, price, hasVariants }) => (
          <button
            key={p.id}
            onClick={() => openSheet(p)}
            className="rounded-2xl border border-line bg-white p-3 text-left shadow-sm active:scale-95"
          >
            <div className="text-sm font-semibold text-ink">{p.name}</div>
            <div className="mt-1 text-xs text-leaf">
              {hasVariants ? "From " : ""}
              {money(price)}
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => !busy && setOpen(null)}>
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-ink">{open.name}</h2>
              <button onClick={() => setOpen(null)} className="text-sm text-ink/60">
                Close
              </button>
            </div>

            {done ? (
              <div className="mt-4">
                <pre className="whitespace-pre-wrap rounded-xl border border-line bg-paper p-3 text-sm text-ink">
                  {done.text}
                </pre>
                <p className="mt-2 text-sm text-ink/70">New balance: {money(balance)}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={copy} className="rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-white">
                    {copied ? "Copied" : "Copy receipt"}
                  </button>
                  <button
                    onClick={() => setOpen(null)}
                    className="rounded-pill border border-line px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {openVariants.length > 0 && (
                  <select
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value)}
                    className="mt-4 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Choose an option</option>
                    {openVariants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} - {money(costOfVariant(v))}
                      </option>
                    ))}
                  </select>
                )}

                {openFields.map((f) => (
                  <label key={f.id} className="mt-3 block text-sm">
                    <span className="text-ink/70">
                      {f.label}
                      {f.is_required && <span className="text-red-600"> *</span>}
                    </span>
                    <input
                      value={values[f.id] || ""}
                      onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                      inputMode={inputModeFor(f.field_type)}
                      className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
                    />
                  </label>
                ))}

                {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

                <button
                  onClick={buy}
                  disabled={busy}
                  className="mt-4 w-full rounded-pill bg-gold py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Processing..." : "Buy with wallet" + (cost !== null ? " - " + money(cost) : "")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// END OF FILE
