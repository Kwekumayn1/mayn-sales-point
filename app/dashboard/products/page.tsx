"use client";

import { useEffect, useRef, useState } from "react";
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

const money = (n: number) => "GHS " + Number(n).toFixed(2);

export default function VendorProductsPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [items, setItems] = useState<PriceableItem[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const supabase: any = createClient();
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

    // What this vendor really pays (includes prices the admin set for them).
    const { data: buy } = await supabase.rpc("my_buying_prices");
    const cost: Record<string, number> = {};
    (buy || []).forEach((r: any) => {
      cost[r.kind + ":" + r.item_id] = Number(r.price);
    });

    // If I was referred by a parent vendor, my floor is never below their price.
    const parentProductPrices: Record<string, number> = {};
    const parentVariantPrices: Record<string, number> = {};
    if (parentId) {
      const { data: pp } = await supabase
        .from("vendor_prices")
        .select("product_id, selling_price")
        .eq("vendor_id", parentId);
      (pp || []).forEach((p: any) => {
        parentProductPrices[p.product_id] = Number(p.selling_price);
      });

      const { data: pv } = await supabase
        .from("vendor_variant_prices")
        .select("variant_id, selling_price")
        .eq("vendor_id", parentId);
      (pv || []).forEach((v: any) => {
        parentVariantPrices[v.variant_id] = Number(v.selling_price);
      });
    }

    const variantsByProduct: Record<string, any[]> = {};
    (variantList ?? []).forEach((v: any) => {
      variantsByProduct[v.product_id] = variantsByProduct[v.product_id] ?? [];
      variantsByProduct[v.product_id].push(v);
    });

    function floorFor(kind: string, id: string, base: number, parentPrice: number | undefined) {
      const mine = cost[kind + ":" + id] ?? base;
      if (parentPrice !== undefined && parentPrice > mine) {
        return { floorPrice: parentPrice, floorIsParent: true };
      }
      return { floorPrice: mine, floorIsParent: parentPrice !== undefined || mine !== base };
    }

    const builtItems: PriceableItem[] = [];
    (productList ?? []).forEach((p: any) => {
      const variants = variantsByProduct[p.id] ?? [];
      if (variants.length > 0) {
        variants.forEach((v: any) => {
          const f = floorFor("variant", v.id, Number(v.base_price), parentVariantPrices[v.id]);
          builtItems.push({
            key: "variant:" + v.id,
            kind: "variant",
            id: v.id,
            displayName: p.name + " - " + v.name,
            floorPrice: f.floorPrice,
            floorIsParent: f.floorIsParent,
            sku: p.sku,
          });
        });
      } else {
        const f = floorFor("product", p.id, Number(p.base_price), parentProductPrices[p.id]);
        builtItems.push({
          key: "product:" + p.id,
          kind: "product",
          id: p.id,
          displayName: p.name,
          floorPrice: f.floorPrice,
          floorIsParent: f.floorIsParent,
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
    (myProductPrices || []).forEach((p: any) => {
      priceMap["product:" + p.product_id] = String(p.selling_price);
    });
    (myVariantPrices || []).forEach((v: any) => {
      priceMap["variant:" + v.variant_id] = String(v.selling_price);
    });
    setPrices(priceMap);

    setLoading(false);
  }

  function sendToCorrection(key: string, message: string) {
    setErrors((e) => ({ ...e, [key]: message }));
    const el = inputRefs.current[key];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
      el.select();
    }
  }

  async function handleSave(item: PriceableItem) {
    setErrors((e) => ({ ...e, [item.key]: "" }));
    const raw = (prices[item.key] || "").trim();
    const value = Number(raw);
    if (raw === "" || Number.isNaN(value) || value < 0) {
      sendToCorrection(item.key, "Enter a valid price.");
      return;
    }
    if (value + 0.0001 < item.floorPrice) {
      sendToCorrection(
        item.key,
        "Price too low. The lowest you can set is " + money(item.floorPrice) + ". Please enter that or higher."
      );
      return;
    }

    setSavingKey(item.key);
    const supabase: any = createClient();
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
      sendToCorrection(item.key, error.message);
      return;
    }
    setSavedKeys((s) => ({ ...s, [item.key]: true }));
    setTimeout(() => setSavedKeys((s) => ({ ...s, [item.key]: false })), 2000);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink/60">
        Loading...
      </main>
    );
  }

  if (role === "customer") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-2xl text-indigo">My Prices</h1>
        <p className="mt-3 text-sm text-ink/70">
          Your account is not set up as a vendor yet. Please sign out and sign in again, or contact support.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Dashboard</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">My Prices</h1>
      <p className="mt-2 text-sm text-ink/60">
        Set your own selling price for each item. You cannot go below your buying price shown under
        each item. If you joined through someone's referral link, your buying price is their price.
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
                    {item.floorIsParent ? "Buying price" : "Base price"} {money(item.floorPrice)}
                    {item.sku ? " | " + item.sku : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink/50">GHS</span>
                  <input
                    ref={(el) => {
                      inputRefs.current[item.key] = el;
                    }}
                    inputMode="decimal"
                    value={currentPrice}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [item.key]: e.target.value }))
                    }
                    className={
                      "w-28 border px-3 py-2 text-sm outline-none focus:border-indigo " +
                      (errors[item.key] ? "border-red-500" : "border-line")
                    }
                  />
                  <button
                    onClick={() => handleSave(item)}
                    disabled={savingKey === item.key}
                    className="rounded-pill bg-indigo px-4 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
                  >
                    {savingKey === item.key ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
              {profit !== null && (
                <p
                  className={`mt-1 text-xs ${
                    Number(profit) >= 0 ? "text-leaf" : "text-red-600"
                  }`}
                >
                  Your profit: GHS {profit}
                </p>
              )}
              {errors[item.key] && (
                <p className="mt-1 text-xs font-medium text-red-600">{errors[item.key]}</p>
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

// END OF FILE
