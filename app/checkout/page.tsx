"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CheckoutPage() {
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("vendor");
    const p = params.get("product");
    setVendorId(v);
    setProductId(p);

    if (!v || !p) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    void loadDetails(v, p);
  }, []);

  async function loadDetails(v: string, p: string) {
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
    setProductName((priceRow as any).products?.name ?? "Product");
    setImageUrl((priceRow as any).products?.image_url ?? null);
    setDisplayPrice(Number(priceRow.selling_price));
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId || !productId) return;
    setError(null);
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
          customerName: name,
          customerPhone: phone,
          customerEmail: email,
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
        <h1 className="font-display text-2xl text-indigo">Product not found</h1>
        <p className="mt-3 text-sm text-ink/60">
          This checkout link looks incomplete or the vendor no longer offers
          this product.
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
      <h1 className="mt-1 font-display text-2xl text-indigo">{productName}</h1>
      {displayPrice !== null && (
        <p className="mt-2 font-display text-lg text-indigo">
          GH₵{displayPrice.toFixed(2)}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium">Full name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Phone number</label>
          <input
            required
            type="tel"
            placeholder="024XXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
          <p className="mt-1 text-xs text-ink/50">Needed to send your payment receipt.</p>
        </div>

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
