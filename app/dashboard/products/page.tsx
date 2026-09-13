"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  base_price: number;
  sku: string | null;
};

export default function VendorProductsPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    setRole(profile?.role ?? "customer");

    const { data: productList } = await supabase
      .from("products")
      .select("id, name, base_price, sku")
      .eq("is_active", true)
      .order("name");
    setProducts(productList ?? []);

    const { data: myPrices } = await supabase
      .from("vendor_prices")
      .select("product_id, selling_price")
      .eq("vendor_id", user.id);

    const priceMap: Record<string, string> = {};
    myPrices?.forEach((p) => {
      priceMap[p.product_id] = String(p.selling_price);
    });
    setPrices(priceMap);

    setLoading(false);
  }

  async function handleSave(productId: string) {
    setErrors((e) => ({ ...e, [productId]: "" }));
    const value = Number(prices[productId]);
    if (Number.isNaN(value) || value < 0) {
      setErrors((e) => ({ ...e, [productId]: "Enter a valid price." }));
      return;
    }

    setSavingId(productId);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingId(null);
      return;
    }

    const { error } = await supabase
      .from("vendor_prices")
      .upsert(
        { vendor_id: user.id, product_id: productId, selling_price: value },
        { onConflict: "vendor_id,product_id" }
      );

    setSavingId(null);
    if (error) {
      setErrors((e) => ({ ...e, [productId]: error.message }));
      return;
    }
    setSavedIds((s) => ({ ...s, [productId]: true }));
    setTimeout(() => setSavedIds((s) => ({ ...s, [productId]: false })), 2000);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  if (role === "customer") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-2xl text-indigo">My Prices</h1>
        <p className="mt-3 text-sm text-ink/70">
          You need to become a vendor first before setting product prices.
        </p>
        <Link
          href="/dashboard/store"
          className="mt-4 inline-block rounded-pill bg-gold px-6 py-2 text-sm font-medium text-indigo hover:bg-gold-dark"
        >
          Become a Vendor
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Dashboard</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">My Prices</h1>
      <p className="mt-2 text-sm text-ink/60">
        Set your own selling price for each product. Your selling price
        cannot be below the base price.
      </p>

      {products.length === 0 && (
        <p className="mt-8 text-sm text-ink/60">No products available yet.</p>
      )}

      <div className="mt-8 divide-y divide-line border-t border-line">
        {products.map((p) => {
          const currentPrice = prices[p.id] ?? "";
          const profit =
            currentPrice && !Number.isNaN(Number(currentPrice))
              ? (Number(currentPrice) - Number(p.base_price)).toFixed(2)
              : null;

          return (
            <div key={p.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-ink/50">
                    Base price GH₵{Number(p.base_price).toFixed(2)}
                    {p.sku ? ` · ${p.sku}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink/50">GH₵</span>
                  <input
                    inputMode="decimal"
                    value={currentPrice}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    className="w-28 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
                  />
                  <button
                    onClick={() => handleSave(p.id)}
                    disabled={savingId === p.id}
                    className="rounded-pill bg-indigo px-4 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
                  >
                    {savingId === p.id ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
              {profit !== null && (
                <p
                  className={`mt-1 text-xs ${
                    Number(profit) >= 0 ? "text-leaf" : "text-red-600"
                  }`}
                >
                  Your profit: GH₵{profit}
                </p>
              )}
              {errors[p.id] && (
                <p className="mt-1 text-xs text-red-600">{errors[p.id]}</p>
              )}
              {savedIds[p.id] && (
                <p className="mt-1 text-xs text-leaf">Saved.</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
    }
