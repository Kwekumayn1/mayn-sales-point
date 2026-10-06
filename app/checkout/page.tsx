"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CheckoutPage() {
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [itemLabel, setItemLabel] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notFound, setNotFound] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("vendor");
    const p = params.get("product");
    const variant = params.get("variant");
    setVendorId(v);

    if (!v || (!p && !variant)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    if (variant) {
      setVariantId(variant);
      void loadVariantDetails(v, variant);
    } else if (p) {
      setProductId(p);
      void loadProductDetails(v, p);
    }
  }, []);

  async function loadProductDetails(v: string, p: string) {
    const supabase = createClient();

    const { data: vendorRow } = await supabase
      .from("storefronts")
      .select("full_name")
      .eq("vendor_id", v)
      .single();

    const { data: priceRow } = await supabase
      .from("vendor_prices")
      .select("selling_price, products(name, image_url)")
      .eq("vendor_id", v)
      .eq("product_id", p)
      .single();

    if (!vendorRow || !priceRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setVendorName(vendorRow.full_name ?? "Vendor");
    setItemLabel((priceRow as any).products?.name ?? "Product");
    setImageUrl((priceRow as any).products?.image_url ?? null);
    setDisplayPrice(Number(priceRow.selling_price));

    const { data: fields } = await supabase
      .from("product_fields")
      .select("id, label, field_type, is_required")
      .eq("product_id", p)
      .order("sort_order");
    setCustomFields(fields ?? []);

    setLoading(false);
  }

  async function loadVariantDetails(v: string, variantIdParam: string) {
    const supabase = createClient();

    const { data: vendorRow } = await supabase
      .from("storefronts")
      .select("full_name")
      .eq("vendor_id", v)
      .single();

    const { data: priceRow } = await supabase
      .from("vendor_variant_prices")
      .select(
        "selling_price, product_variants(name, product_id, products(name, image_url))"
      )
      .eq("vendor_id", v)
      .eq("variant_id", variantIdParam)
      .single();

    if (!vendorRow || !priceRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const variantInfo = (priceRow as any).product_variants;
    const productInfo = variantInfo?.products;
    const pId = variantInfo?.product_id;

    setVendorName(vendorRow.full_name ?? "Vendor");
    setItemLabel(
      productInfo?.name ? `${productInfo.name} — ${variantInfo.name}` : variantInfo?.name ?? "Item"
    );
    setImageUrl(productInfo?.image_url ?? null);
    setDisplayPrice(Number(priceRow.selling_price));

    if (pId) {
      const { data: fields } = await supabase
        .from("product_fields")
        .select("id, label, field_type, is_required")
        .eq("product_id", pId)
        .order("sort_order");
      setCustomFields(fields ?? []);
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId || (!productId && !variantId)) return;
    setError(null);

    for (const f of customFields) {
      if (f.is_required && !fieldValues[f.label]?.trim()) {
        setError(`Please fill in "${f.label}".`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch("/api/checkout/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          productId,
          variantId,
          customFieldValues: fieldValues,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();

      if (!res.ok || !data.authorizationUrl) {
        setSubmitting(false);
        setError(data.error || "Could not start payment. Please try again.");
        return;
      }

      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      setSubmitting(false);
      setError(
        err?.name === "AbortError"
          ? "The payment request timed out after 20 seconds. Please try again."
          : err?.message || "Something went wrong starting payment."
      );
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-2xl text-indigo">Item not found</h1>
        <p className="mt-3 text-sm text-ink/60">
          This checkout link looks incomplete or the vendor no longer offers
          this item.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="mb-4 h-48 w-full rounded object-cover"
        />
      )}
      <p className="text-xs uppercase tracking-wide text-ink/50">
        {vendorName} — Store
      </p>
      <h1 className="mt-1 font-display text-2xl text-indigo">{itemLabel}</h1>
      {displayPrice !== null && (
        <p className="mt-2 font-display text-lg text-indigo">
          GH₵{displayPrice.toFixed(2)}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {customFields.length === 0 && (
          <p className="text-sm text-ink/60">
            No extra details needed — just confirm your purchase below.
          </p>
        )}

        {customFields.map((f) => (
          <div key={f.id}>
            <label className="text-sm font-medium">
              {f.label}
              {f.is_required && " *"}
            </label>
            <input
              required={f.is_required}
              type={f.field_type === "number" ? "number" : f.field_type}
              value={fieldValues[f.label] ?? ""}
              onChange={(e) =>
                setFieldValues((prev) => ({ ...prev, [f.label]: e.target.value }))
              }
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            />
          </div>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-pill bg-indigo py-3 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
        >
          {submitting ? "Redirecting to payment…" : "Pay with Mobile Money"}
        </button>
      </form>
    </main>
  );
}
