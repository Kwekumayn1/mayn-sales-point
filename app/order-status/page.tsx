"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  processing: "Processing",
  awaiting_fulfillment: "Awaiting fulfillment",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

export default function OrderStatusPage() {
  const [loading, setLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const number = params.get("number") ?? "";
    setOrderNumber(number);
    if (number) {
      void lookup(number);
    } else {
      setLoading(false);
    }
  }, []);

  async function lookup(number: string) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("order_status_lookup")
      .select("order_number, status, unit_price, created_at, product_name")
      .eq("order_number", number.trim())
      .single();

    setLoading(false);
    if (error || !data) {
      setError("No order found with that reference.");
      setOrder(null);
      return;
    }
    setOrder(data);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void lookup(orderNumber);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-2xl text-indigo">Order status</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-3">
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="MSP-ORD-001000"
          className="flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
        />
        <button
          type="submit"
          className="rounded-pill bg-indigo px-5 py-2 text-sm font-medium text-white hover:bg-indigo-light"
        >
          Check
        </button>
      </form>

      {loading && <p className="mt-6 text-sm text-ink/60">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {order && (
        <div className="mt-6 border border-line bg-white p-6">
          <p className="text-xs text-ink/50">Product</p>
          <p className="mt-1 font-medium">{order.product_name}</p>

          <p className="mt-4 text-xs text-ink/50">Status</p>
          <p className="mt-1 font-display text-lg text-indigo">
            {STATUS_LABELS[order.status] ?? order.status}
          </p>

          <p className="mt-4 text-xs text-ink/50">Amount</p>
          <p className="mt-1 font-medium">GH₵{Number(order.unit_price).toFixed(2)}</p>
        </div>
      )}
    </main>
  );
      }
