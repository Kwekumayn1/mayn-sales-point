"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS_OPTIONS = [
  "pending_payment",
  "paid",
  "processing",
  "awaiting_fulfillment",
  "completed",
  "cancelled",
  "refunded",
  "failed",
];

export default function VendorOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, unit_price, status, created_at, custom_field_values, products(name)"
      )
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });

    setOrders(data ?? []);
    setLoading(false);
  }

  async function handleStatusChange(orderId: string, status: string) {
    setUpdatingId(orderId);
    const supabase = createClient();
    await supabase.from("orders").update({ status }).eq("id", orderId);
    setUpdatingId(null);
    void load();
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Dashboard</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">My Orders</h1>

      {orders.length === 0 && (
        <p className="mt-8 text-sm text-ink/60">
          No orders yet — share your storefront link to start selling.
        </p>
      )}

      <div className="mt-8 divide-y divide-line border-t border-line">
        {orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium">{o.products?.name ?? "Product"}</p>
              <p className="text-xs text-ink/50">
                {o.order_number}
                {(o.customer_name || o.customer_phone) &&
                  ` · ${[o.customer_name, o.customer_phone].filter(Boolean).join(" · ")}`}
              </p>
              <p className="text-xs text-ink/50">
                GH₵{Number(o.unit_price).toFixed(2)} ·{" "}
                {new Date(o.created_at).toLocaleDateString()}
              </p>
              {o.custom_field_values && Object.keys(o.custom_field_values).length > 0 && (
                <p className="mt-1 text-xs text-ink/50">
                  {Object.entries(o.custom_field_values)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </p>
              )}
            </div>
            <select
              value={o.status}
              disabled={updatingId === o.id}
              onChange={(e) => handleStatusChange(o.id, e.target.value)}
              className="border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </main>
  );
                             }
