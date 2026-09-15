"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PricedProduct = {
  product_id: string;
  selling_price: number;
  name: string;
  base_price: number;
};

export default function WalletOrderPage() {
  const [loading, setLoading] = useState(true);
  const [purchaseBalance, setPurchaseBalance] = useState(0);
  const [products, setProducts] = useState<PricedProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ orderNumber: string; price: number } | null>(
    null
  );

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

    const { data: txns } = await supabase
      .from("wallet_transactions")
      .select("amount")
      .eq("vendor_id", user.id)
      .eq("wallet_type", "purchase");
    const balance = (txns ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
    setPurchaseBalance(balance);

    const { data: priced } = await supabase
      .from("vendor_prices")
      .select("product_id, selling_price, products(name, base_price)")
      .eq("vendor_id", user.id);

    const list: PricedProduct[] = (priced ?? []).map((p: any) => ({
      product_id: p.product_id,
      selling_price: Number(p.selling_price),
      name: p.products?.name ?? "Product",
      base_price: Number(p.products?.base_price ?? 0),
    }));
    setProducts(list);
    if (list.length > 0) setProductId((prev) => prev || list[0].product_id);

    setLoading(false);
  }

  const selected = products.find((p) => p.product_id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!productId) return;

    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("vendor_place_wallet_order", {
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
    setName("");
    setPhone("");
    setEmail("");
    void load();
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Dashboard</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">Buy for a Customer</h1>
      <p className="mt-2 text-sm text-ink/60">
        For customers who cannot access your storefront link. This charges
        your Purchase Wallet the base cost and credits your profit
        immediately.
      </p>

      <div className="mt-4 border border-line bg-white p-4">
        <p className="text-xs text-ink/50">Purchase wallet balance</p>
        <p className="mt-1 font-display text-lg">GH₵{purchaseBalance.toFixed(2)}</p>
      </div>

      {products.length === 0 ? (
        <p className="mt-8 text-sm text-ink/60">
          You have not priced any products yet — set a price under "My
          Prices" first.
        </p>
      ) : confirmation ? (
        <div className="mt-8 border border-line bg-white p-6">
          <p className="text-xs text-ink/50">Order reference</p>
          <p className="mt-1 font-display text-lg">{confirmation.orderNumber}</p>
          <p className="mt-4 text-xs text-ink/50">Amount</p>
          <p className="mt-1 font-display text-lg">GH₵{confirmation.price.toFixed(2)}</p>
          <p className="mt-4 text-sm text-leaf">Order marked as paid.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-sm font-medium">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            >
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} — sells GH₵{p.selling_price.toFixed(2)}
                </option>
              ))}
            </select>
            {selected && (
              <p className="mt-1 text-xs text-ink/50">
                Wallet will be charged GH₵{selected.base_price.toFixed(2)}, your
                profit GH₵{(selected.selling_price - selected.base_price).toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Customer name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Customer phone</label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Customer email (optional)</label>
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
            {submitting ? "Processing…" : "Complete purchase"}
          </button>
        </form>
      )}
    </main>
  );
      }
