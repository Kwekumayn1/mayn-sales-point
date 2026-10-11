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

export default function MyOrdersPage() {
  const [rows, setRows] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const supabase: any = createClient();
    (async () => {
      const { data, error } = await supabase.rpc("my_orders", { p_limit: 300 });
      setLoading(false);
      if (error) {
        setErr(error.message);
        return;
      }
      setRows(data || []);
    })();
  }, []);

  const shown = rows.filter((r: any) => filter === "all" || r.status === filter);
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
        Orders placed through your account. The status is updated by the admin.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
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
          </div>
        ))}
        {!loading && shown.length === 0 && !err && (
          <p className="py-8 text-center text-sm text-ink/50">No orders here yet.</p>
        )}
      </div>
    </main>
  );
}

// END OF FILE
