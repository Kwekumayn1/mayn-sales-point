"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function CheckoutPage() {
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ orderNumber: string; price: number } | null>(null);

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
      .select("selling_price, products(name)")
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
    setDisplayPrice(Number(priceRow.selling_price));
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId || !productId) return;
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_order", {
      p_vendor_id: vendorId,
      p_product_id: productId,
      p_customer_name: name,
      p_customer_phone: phone,
      p_customer_email: email || null,
    });

    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setConfirmation({ orderNumber: result.order_number, price: Number(result.unit_price) });
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

  if (confirmation) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-2xl text-indigo">Order placed</h1>
        <div className="mt-6 border border-line bg-white p-6">
          <p className="text-xs text-ink/50">Order reference</p>
          <p className="mt-1 font-display text-lg">{confirmation.orderNumber}</p>
          <p className="mt-4 text-xs text-ink/50">Amount</p>
          <p className="mt-1 font-display text-lg">GH₵{confirmation.price.toFixed(2)}</p>
        </div>
        <p className="mt-4 text-sm text-ink/60">
          Save this reference — payment collection is coming in a later
          update. For now, the vendor has been notified of your order.
        </p>
        <Link
          href={`/order-status?number=${confirmation.orderNumber}`}
          className="mt-4 inline-block text-sm text-indigo underline"
        >
          Check order status
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">
        {vendorName}'s Store
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
          <label className="text-sm font-medium">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-pill bg-indigo py-3 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
        >
          {submitting ? "Placing order…" : "Place order"}
        </button>
      </form>
    </main>
  );
    }
