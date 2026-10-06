"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type PriceableItem = {
  key: string;
  kind: "product" | "variant";
  id: string;
  displayName: string;
  floorPrice: number;
  floorIsParent: boolean;
  sku: string | null;
};

export default function VendorProductsPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [items, setItems] = useState<PriceableItem[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});

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
      .select("role, parent_vendor_id")
      .eq("id", user.id)
      .single();
    setRole(profile?.role ?? "customer");
    const parentId: string | null = profile?.parent_vendor_id ?? null;

    const { data: productList } = await supabase
      .from("products")
      .select("id, name, base_price, sku")
      .eq("is_active", true)
      .order("name");

    const { data: variantList } = await supabase
      .from("product_variants")
      .select("id, product_id, name, base_price")
      .eq("is_active", true)
      .order("sort_order");

    // If I was referred by a parent vendor, fetch their prices so my
    // floor is their price (not the admin's base price) wherever they've
    // priced the same item.
    let parentProductPrices: Record<string, number> = {};
    let parentVariantPrices: Record<string, number> = {};
    if (parentId) {
      const { data: pp } = await supabase
        .from("vendor_prices")
        .select("product_id, selling_price")
        .eq("vendor_id", parentId);
      pp?.forEach((p) => {
        parentProductPrices[p.product_id] = Number(p.selling_price);
      });

      const { data: pv } = await supabase
        .from("vendor_variant_prices")
        .select("variant_id, selling_price")
        .eq("vendor_id", parentId);
      pv?.forEach((v) => {
        parentVariantPrices[v.variant_id] = Number(v.selling_price);
      });
    }

    const variantsByProduct: Record<string, any[]> = {};
    (variantList ?? []).forEach((v) => {
      variantsByProduct[v.product_id] = variantsByProduct[v.product_id] ?? [];
      variantsByProduct[v.product_id].push(v);
    });

    const builtItems: PriceableItem[] = [];
    (productList ?? []).forEach((p) => {
      const variants = variantsByProduct[p.id] ?? [];
      if (variants.length > 0) {
        variants.forEach((v) => {
          const parentPrice = parentVariantPrices[v.id];
          builtItems.push({
            key: `variant:${v.id}`,
            kind: "variant",
            id: v.id,
            displayName: `${p.name} — ${v.name}`,
            floorPrice: parentPrice ?? Number(v.base_price),
            floorIsParent: parentPrice !== undefined,
            sku: p.sku,
          });
        });
      } else {
        const parentPrice = parentProductPrices[p.id];
        builtItems.push({
          key: `product:${p.id}`,
          kind: "product",
          id: p.id,
          displayName: p.name,
          floorPrice: parentPrice ?? Number(p.base_price),
          floorIsParent: parentPrice !== undefined,
          sku: p.sku,
        });
      }
    });
    setItems(builtItems);

    const { data: myProductPrices } = await supabase
      .from("vendor_prices")
      .select("product_id, selling_price")
      .eq("vendor_id", user.id);

    const { data: myVariantPrices } = await supabase
      .from("vendor_variant_prices")
      .select("variant_id, selling_price")
      .eq("vendor_id", user.id);

    const priceMap: Record<string, string> = {};
    myProductPrices?.forEach((p) => {
      priceMap[`product:${p.product_id}`] = String(p.selling_price);
    });
    myVariantPrices?.forEach((v) => {
      priceMap[`variant:${v.variant_id}`] = String(v.selling_price);
    });
    setPrices(priceMap);

    setLoading(false);
  }

  async function handleSave(item: PriceableItem) {
    setErrors((e) => ({ ...e, [item.key]: "" }));
    const value = Number(prices[item.key]);
    if (Number.isNaN(value) || value < 0) {
      setErrors((e) => ({ ...e, [item.key]: "Enter a valid price." }));
      return;
    }

    setSavingKey(item.key);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingKey(null);
      return;
    }

    const { error } =
      item.kind === "product"
        ? await supabase
            .from("vendor_prices")
            .upsert(
              { vendor_id: user.id, product_id: item.id, selling_price: value },
              { onConflict: "vendor_id,product_id" }
            )
        : await supabase
            .from("vendor_variant_prices")
            .upsert(
              { vendor_id: user.id, variant_id: item.id, selling_price: value },
              { onConflict: "vendor_id,variant_id" }
            );

    setSavingKey(null);
    if (error) {
      setErrors((e) => ({ ...e, [item.key]: error.message }));
      return;
    }
    setSavedKeys((s) => ({ ...s, [item.key]: true }));
    setTimeout(() => setSavedKeys((s) => ({ ...s, [item.key]: false })), 2000);
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
        Set your own selling price for each item. If you joined through
        someone's referral link, your price must be above theirs — otherwise
        it must be above the platform's base price.
      </p>

      {items.length === 0 && (
        <p className="mt-8 text-sm text-ink/60">No products available yet.</p>
      )}

      <div className="mt-8 divide-y divide-line border-t border-line">
        {items.map((item) => {
          const currentPrice = prices[item.key] ?? "";
          const profit =
            currentPrice && !Number.isNaN(Number(currentPrice))
              ? (Number(currentPrice) - item.floorPrice).toFixed(2)
              : null;

          return (
            <div key={item.key} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{item.displayName}</p>
                  <p className="text-xs text-ink/50">
                    {item.floorIsParent ? "Buying price" : "Base price"} GH₵
                    {item.floorPrice.toFixed(2)}
                    {item.sku ? ` · ${item.sku}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink/50">GH₵</span>
                  <input
                    inputMode="decimal"
                    value={currentPrice}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [item.key]: e.target.value }))
                    }
                    className="w-28 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
                  />
                  <button
                    onClick={() => handleSave(item)}
                    disabled={savingKey === item.key}
                    className="rounded-pill bg-indigo px-4 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
                  >
                    {savingKey === item.key ? "Saving…" : "Save"}
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
              {errors[item.key] && (
                <p className="mt-1 text-xs text-red-600">{errors[item.key]}</p>
              )}
              {savedKeys[item.key] && (
                <p className="mt-1 text-xs text-leaf">Saved.</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
      }
