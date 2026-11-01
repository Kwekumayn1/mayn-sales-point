"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function label(s: string): string {
  if (s === "paid") return "Paid successfully";
  if (s === "processed") return "Processed";
  if (s === "delivered") return "Delivered";
  if (s === "pending_payment") return "Awaiting payment";
  if (s === "completed") return "Completed";
  if (s === "cancelled") return "Cancelled";
  if (s === "refunded") return "Refunded";
  if (s === "failed") return "Failed";
  return s;
}

function badge(s: string): string {
  if (s === "delivered" || s === "completed") return "bg-green-100 text-green-800";
  if (s === "processed") return "bg-blue-100 text-blue-800";
  if (s === "paid") return "bg-emerald-100 text-emerald-800";
  if (s === "pending_payment") return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-700";
}

function delivery(r: any): any {
  const s = String(r.supplier_status || "");
  if (!s) return null;
  if (s === "sending") return { text: "Sending to the network...", cls: "text-ink/60" };
  if (s === "sent") return { text: "Sent. Waiting for the network to confirm.", cls: "text-blue-700" };
  if (s === "completed") return { text: "Network confirmed delivery.", cls: "text-green-700" };
  if (s === "failed") return { text: "Delivery failed. The admin is looking into it.", cls: "text-red-700" };
  if (s === "review") return { text: "Needs a check by the admin.", cls: "text-amber-700" };
  return null;
}

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return String(iso);
  }
}

export default function MyOrdersPage() {
  const [rows, setRows] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  async function loadRows() {
    const supabase: any = createClient();
    const { data, error } = await supabase.rpc("my_orders", { p_limit: 300 });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setRows(data || []);
  }

  async function syncAndReload() {
    setRefreshing(true);
    try {
      await fetch("/api/orders/sync", { method: "POST" });
    } catch (e) {
      // Show what we already have.
    }
    await loadRows();
    setRefreshing(false);
  }

  useEffect(() => {
    void loadRows().then(() => syncAndReload());
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void syncAndReload();
    }, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = search.trim().toLowerCase();
  const shown = rows.filter((r: any) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (!q) return true;
    const hay = [r.order_number, r.phone, r.product, r.item, r.customer]
      .map((x: any) => String(x || "").toLowerCase())
      .join(" ");
    return hay.includes(q);
  });
  const tabs = [
    ["all", "All"],
    ["paid", "Paid"],
    ["processed", "Processed"],
    ["delivered", "Delivered"],
    ["pending_payment", "Awaiting payment"],
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <h1 className="text-2xl text-indigo">My Orders</h1>
      <p className="mt-1 text-sm text-ink/60">
        Orders placed through your account. Delivery updates come from the network and refresh by themselves.
      </p>
      <button
        onClick={() => void syncAndReload()}
        disabled={refreshing}
        className="mt-2 rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
      >
        {refreshing ? "Checking..." : "Refresh now"}
      </button>

      <input
        value={search}
        onChange={(e: any) => setSearch(e.target.value)}
        placeholder="Search order number, phone or product"
        className="mt-4 w-full rounded-xl border border-line bg-white p-3 text-base"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {tabs.map((t: any) => (
          <button
            key={t[0]}
            onClick={() => setFilter(t[0])}
            className={
              filter === t[0]
                ? "rounded-pill bg-indigo px-3 py-1.5 text-xs font-bold text-white"
                : "rounded-pill border border-line bg-white px-3 py-1.5 text-xs"
            }
          >
            {t[1]}
          </button>
        ))}
      </div>

      {err && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {loading && <p className="mt-6 text-sm text-ink/60">Loading...</p>}

      <div className="mt-4 space-y-3">
        {shown.map((r: any) => (
          <div key={r.order_id} className="rounded-xl border border-line bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">
                  {r.product}
                  {r.item ? " - " + r.item : ""}
                </div>
                <div className="mt-0.5 text-xs text-ink/60">
                  {r.order_number} &middot; {when(r.created_at)}
                </div>
              </div>
              <span className={"shrink-0 rounded-pill px-3 py-1 text-xs font-semibold " + badge(r.status)}>
                {label(r.status)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 text-sm">
              {r.phone ? <span>To: {r.phone}</span> : null}
              <span>GH&#8373; {Number(r.price).toFixed(2)}</span>
            </div>
            {delivery(r) && (
              <div className={"mt-1 text-xs font-medium " + delivery(r).cls}>
                Delivery: {delivery(r).text}
                {r.supplier_sent_at ? " (sent " + when(r.supplier_sent_at) + ")" : ""}
              </div>
            )}
          </div>
        ))}
        {!loading && shown.length === 0 && !err && (
          <p className="py-8 text-center text-sm text-ink/50">No orders found.</p>
        )}
      </div>
    </main>
  );
}

// END OF FILE
