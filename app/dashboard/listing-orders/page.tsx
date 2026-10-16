"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const money = (n: number) => "GHS " + Number(n).toFixed(2);

function label(s: string) {
  if (s === "awaiting_vendor") return { text: "New order", cls: "bg-amber-100 text-amber-800" };
  if (s === "accepted") return { text: "Accepted - waiting for your payout", cls: "bg-blue-100 text-blue-800" };
  if (s === "vendor_paid") return { text: "Payout sent to you", cls: "bg-green-100 text-green-800" };
  if (s === "cancelled") return { text: "Cancelled - customer will be refunded", cls: "bg-red-100 text-red-800" };
  if (s === "refunded") return { text: "Customer refunded", cls: "bg-gray-100 text-gray-800" };
  return { text: s, cls: "bg-gray-100 text-gray-800" };
}

export default function ListingOrdersPage() {
  const supabase: any = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const { data } = await supabase
      .from("listing_orders")
      .select("*")
      .neq("status", "pending_payment")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(o: any, accept: boolean) {
    const sure = accept
      ? "Take this order? The admin will then pay you " + money(o.cost_price) + " so you can supply the customer."
      : "Cancel this order? The customer will be refunded.";
    if (!window.confirm(sure)) return;
    setError("");
    setBusyId(o.id);
    const { error: err } = await supabase.rpc("vendor_decide_listing_order", {
      p_order_id: o.id,
      p_accept: accept,
    });
    setBusyId("");
    if (err) setError(err.message);
    await load();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl text-indigo">Product orders</h1>
      <p className="mt-1 text-sm text-ink/60">Orders from customers who bought your own products.</p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-ink/60">Loading...</p>}
      {!loading && rows.length === 0 && <p className="mt-4 text-sm text-ink/60">No orders yet.</p>}

      <div className="mt-4 divide-y divide-line border-t border-line">
        {rows.map((o) => {
          const c = label(o.status);
          return (
            <div key={o.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">
                    {o.order_number} <span className="font-normal text-ink/60">| {o.listing_name}</span>
                  </p>
                  <p className="text-xs text-ink/60">
                    {new Date(o.created_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })}
                  </p>
                </div>
                <span className={"rounded-full px-3 py-1 text-xs font-semibold " + c.cls}>{c.text}</span>
              </div>
              <div className="mt-2 rounded-xl bg-paper p-3 text-sm text-ink">
                <p>Customer: {o.customer_name || "Not given"}</p>
                <p>Phone: {o.customer_phone}</p>
                {o.customer_details && <p>Details: {o.customer_details}</p>}
                <p className="mt-1">
                  Customer paid {money(o.amount)} | You receive <b>{money(o.cost_price)}</b>
                </p>
              </div>
              {o.status === "awaiting_vendor" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => decide(o, true)}
                    disabled={busyId === o.id}
                    className="rounded-pill bg-indigo px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Take order
                  </button>
                  <button
                    onClick={() => decide(o, false)}
                    disabled={busyId === o.id}
                    className="rounded-pill border border-line bg-white px-5 py-2 text-sm font-semibold text-red-600 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

// END OF FILE
