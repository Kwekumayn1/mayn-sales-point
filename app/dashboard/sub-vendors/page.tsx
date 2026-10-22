"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SubVendorsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const supabase: any = createClient();
    (async () => {
      const { data, error: e } = await supabase.rpc("my_sub_vendors");
      if (e) setError(e.message);
      else setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const total = rows.length;
  const direct = rows.filter((r) => r.level === 1).length;
  const deeper = total - direct;
  const blocked = rows.filter((r) => r.is_blocked).length;
  const paidOrders = rows.reduce((a, r) => a + Number(r.orders_paid || 0), 0);

  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (!needle) return true;
    return (
      String(r.full_name || "").toLowerCase().includes(needle) ||
      String(r.phone || "").toLowerCase().includes(needle) ||
      String(r.vendor_no || "").toLowerCase().includes(needle)
    );
  });

  const box = "rounded-xl border border-line bg-white p-3 text-center";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl text-indigo">My sub-vendors</h1>
      <p className="mt-1 text-sm text-ink/60">
        Every vendor registered under you. This is your running record, and it only grows as you bring in more people.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-ink/60">Loading...</p>}

      {!loading && !error && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className={box}>
              <p className="text-2xl font-bold text-indigo">{total}</p>
              <p className="text-xs text-ink/60">Total sub-vendors</p>
            </div>
            <div className={box}>
              <p className="text-2xl font-bold text-indigo">{direct}</p>
              <p className="text-xs text-ink/60">Brought in by you</p>
            </div>
            <div className={box}>
              <p className="text-2xl font-bold text-indigo">{deeper}</p>
              <p className="text-xs text-ink/60">Brought in by your sub-vendors</p>
            </div>
            <div className={box}>
              <p className="text-2xl font-bold text-indigo">{paidOrders}</p>
              <p className="text-xs text-ink/60">Paid orders from them</p>
            </div>
          </div>
          {blocked > 0 && (
            <p className="mt-2 text-xs text-ink/60">{blocked} of them currently blocked by admin.</p>
          )}

          <input
            value={q}
            onChange={(e: any) => setQ(e.target.value)}
            placeholder="Search by name, phone or ID number"
            className="mt-4 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-indigo"
          />

          {total === 0 && (
            <p className="mt-4 text-sm text-ink/60">You have no sub-vendors yet.</p>
          )}
          {total > 0 && shown.length === 0 && (
            <p className="mt-4 text-sm text-ink/60">No one matches that search.</p>
          )}

          <div className="mt-4 divide-y divide-line border-t border-line">
            {shown.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold text-ink">
                    {r.full_name || "No name"}{" "}
                    <span className="font-normal text-ink/50">(ID {r.vendor_no || "-"})</span>
                  </p>
                  <p className="text-xs text-ink/60">{r.phone || "No phone"}</p>
                  <p className="text-xs text-ink/60">
                    {r.level === 1 ? "Direct sub-vendor" : "Level " + (r.level + 1) + ", under " + (r.parent_name || "a sub-vendor")}
                    {" | Joined "}
                    {r.joined ? new Date(r.joined).toLocaleDateString("en-GB") : "not recorded"}
                    {" | " + r.orders_paid + " paid order" + (Number(r.orders_paid) === 1 ? "" : "s")}
                  </p>
                </div>
                <span
                  className={
                    "rounded-full px-3 py-1 text-xs font-semibold " +
                    (r.is_blocked ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800")
                  }
                >
                  {r.is_blocked ? "Blocked" : "Active"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

// END OF FILE
