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

export default function AdminOrderStatusPage() {
  const [rows, setRows] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function load() {
    const supabase: any = createClient();
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_all_orders", {
      p_status: null,
      p_limit: 400,
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  const processedCount = rows.filter((r: any) => r.status === "processed").length;

  async function markDelivered() {
    if (processedCount === 0) return;
    const ask =
      "Mark all " + processedCount + " processed orders as delivered? Vendors will see them as Delivered.";
    if (!window.confirm(ask)) return;
    const supabase: any = createClient();
    setBusy(true);
    setErr("");
    setMsg("");
    const { data, error } = await supabase.rpc("admin_mark_processed_delivered");
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg(String(data) + " orders marked as delivered.");
    load();
  }

  const q = search.trim().toLowerCase();
  const shown = rows.filter((r: any) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (!q) return true;
    const hay = [r.order_number, r.phone, r.product, r.item, r.vendor]
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
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <h1 className="text-2xl text-indigo">Order status</h1>
      <p className="mt-1 text-sm text-ink/60">
        New paid orders show as Paid successfully. Exported orders become Processed.
        Use the button to turn all processed orders into Delivered.
      </p>

      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <div className="text-sm">
          Processed orders waiting: <b>{processedCount}</b>
        </div>
        <button
          disabled={busy || processedCount === 0}
          onClick={markDelivered}
          className="mt-3 rounded-pill bg-gold px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Mark all processed as delivered
        </button>
      </div>

      {err && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {msg && <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{msg}</div>}

      <input
        value={search}
        onChange={(e: any) => setSearch(e.target.value)}
        placeholder="Search order number, phone, product or vendor"
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
              {r.vendor ? <span>Vendor: {r.vendor}</span> : null}
            </div>
          </div>
        ))}
        {!loading && shown.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/50">No orders found.</p>
        )}
      </div>
    </main>
  );
}

// END OF FILE
