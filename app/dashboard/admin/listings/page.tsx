"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const money = (n: number) => "GHS " + Number(n).toFixed(2);

function who(p: any) {
  if (!p) return "Unknown vendor";
  return (p.full_name || "Vendor") + (p.phone ? " - " + p.phone : "");
}

export default function AdminListingsPage() {
  const supabase: any = createClient();
  const [tab, setTab] = useState<"approve" | "pay">("pay");
  const [listings, setListings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function load() {
    const a = await supabase
      .from("vendor_listings")
      .select("*, profiles!vendor_id(full_name, phone)")
      .order("created_at", { ascending: false })
      .limit(200);
    const b = await supabase
      .from("listing_orders")
      .select("*, profiles!vendor_id(full_name, phone)")
      .neq("status", "pending_payment")
      .order("created_at", { ascending: false })
      .limit(200);
    if (a.error) setError(a.error.message);
    else if (b.error) setError(b.error.message);
    setListings(a.data || []);
    setOrders(b.data || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function review(l: any, approve: boolean) {
    let note = "";
    if (!approve) {
      const r = window.prompt("Reason for rejecting (the vendor will see this):", "");
      if (r === null) return;
      note = r;
    }
    setError("");
    setBusyId(l.id);
    const { error: err } = await supabase.rpc("admin_review_listing", {
      p_listing_id: l.id,
      p_approve: approve,
      p_note: note,
    });
    setBusyId("");
    if (err) setError(err.message);
    await load();
  }

  async function settle(o: any) {
    const text =
      o.status === "accepted"
        ? "Confirm you have PAID the vendor " + money(o.cost_price) + "?"
        : "Confirm you have REFUNDED the customer " + money(o.amount) + "?";
    if (!window.confirm(text)) return;
    const note = window.prompt("Add a note, such as the MoMo transaction ID (optional):", "");
    if (note === null) return;
    setError("");
    setBusyId(o.id);
    const { error: err } = await supabase.rpc("admin_settle_listing_order", {
      p_order_id: o.id,
      p_note: note,
    });
    setBusyId("");
    if (err) setError(err.message);
    await load();
  }

  const pending = listings.filter((l) => l.status === "pending");
  const others = listings.filter((l) => l.status !== "pending");
  const todo = orders.filter((o) => o.status === "accepted" || o.status === "cancelled");
  const waiting = orders.filter((o) => o.status === "awaiting_vendor");
  const done = orders.filter((o) => o.status === "vendor_paid" || o.status === "refunded").slice(0, 30);

  const tabBtn = (id: "approve" | "pay", text: string) => (
    <button
      onClick={() => setTab(id)}
      className={
        "rounded-pill px-4 py-2 text-sm font-semibold " +
        (tab === id ? "bg-indigo text-white" : "border border-line bg-white text-ink")
      }
    >
      {text}
    </button>
  );
  async function checkPay() {
    setError("");
    setBusyId("check");
    try {
      const res = await fetch("/api/admin/listing-check", { method: "POST" });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || "Could not check payments.");
      else setInfo("Checked " + j.checked + " unpaid orders. Newly confirmed: " + j.confirmed + ".");
    } catch {
      setError("Could not reach the server.");
    }
    setBusyId("");
    await load();
  }

  const btn = "rounded-pill px-4 py-2 text-xs font-semibold disabled:opacity-60";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl text-indigo">Vendor listings</h1>
      <div className="mt-4 flex gap-2">
        {tabBtn("pay", "Payouts and refunds (" + todo.length + ")")}
        {tabBtn("approve", "All products (" + listings.length + ")")}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {info && <p className="mt-3 text-sm text-leaf">{info}</p>}
      {loading && <p className="mt-4 text-sm text-ink/60">Loading...</p>}

      {tab === "pay" && !loading && (
        <div className="mt-5">
          <button
            onClick={checkPay}
            disabled={busyId === "check"}
            className={btn + " border border-line bg-white text-ink"}
          >
            {busyId === "check" ? "Checking..." : "Check unpaid orders now"}
          </button>
          <h2 className="mt-5 font-display text-lg text-indigo">To do now</h2>
          {todo.length === 0 && <p className="mt-2 text-sm text-ink/60">Nothing to pay or refund.</p>}
          <div className="mt-2 divide-y divide-line border-t border-line">
            {todo.map((o) => (
              <div key={o.id} className="py-4">
                {o.status === "accepted" ? (
                  <p className="font-semibold text-blue-800">
                    PAY VENDOR {money(o.cost_price)} - {who(o.profiles)}
                  </p>
                ) : (
                  <p className="font-semibold text-red-700">
                    REFUND CUSTOMER {money(o.amount)} to the number they paid from: {o.payer_number || "not recorded"}
                  </p>
                )}
                <p className="text-xs text-ink/60">
                  {o.order_number} | {o.listing_name} | customer {o.customer_name || ""} {o.customer_phone}
                </p>
                <p className="text-xs text-ink/60">
                  Customer paid {money(o.amount)} | Your 4% is {money(o.amount - o.cost_price)}
                </p>
                <button
                  onClick={() => settle(o)}
                  disabled={busyId === o.id}
                  className={btn + " mt-2 bg-indigo text-white"}
                >
                  {o.status === "accepted" ? "Mark paid" : "Mark refunded"}
                </button>
              </div>
            ))}
          </div>

          <h2 className="mt-8 font-display text-lg text-indigo">Waiting for the vendor ({waiting.length})</h2>
          <div className="mt-2 divide-y divide-line border-t border-line">
            {waiting.map((o) => (
              <p key={o.id} className="py-2 text-sm text-ink/70">
                {o.order_number} | {o.listing_name} | {money(o.amount)} | {who(o.profiles)}
              </p>
            ))}
          </div>

          <h2 className="mt-8 font-display text-lg text-indigo">Recently settled</h2>
          <div className="mt-2 divide-y divide-line border-t border-line">
            {done.map((o) => (
              <p key={o.id} className="py-2 text-sm text-ink/70">
                {o.order_number} | {o.status === "vendor_paid" ? "Vendor paid " + money(o.cost_price) : "Refunded " + money(o.amount)}{" "}
                | {who(o.profiles)} {o.admin_note ? "| " + o.admin_note : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      {tab === "approve" && !loading && (
        <div className="mt-5">
          <h2 className="font-display text-lg text-indigo">Under review</h2>
          {pending.length === 0 && <p className="mt-2 text-sm text-ink/60">No products under review.</p>}
          <div className="mt-2 divide-y divide-line border-t border-line">
            {pending.map((l) => (
              <div key={l.id} className="py-4">
                <p className="font-semibold text-ink">{l.name}</p>
                <p className="text-xs text-ink/60">{who(l.profiles)}</p>
                {l.description && <p className="mt-1 text-sm text-ink/70">{l.description}</p>}
                <p className="mt-1 text-xs text-ink/60">
                  Vendor receives {money(l.cost_price)} | Customers pay {money(l.customer_price)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => review(l, true)} disabled={busyId === l.id} className={btn + " bg-indigo text-white"}>
                    Approve
                  </button>
                  <button
                    onClick={() => review(l, false)}
                    disabled={busyId === l.id}
                    className={btn + " border border-line bg-white text-red-600"}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h2 className="mt-8 font-display text-lg text-indigo">Live and removed products</h2>
          <div className="mt-2 divide-y divide-line border-t border-line">
            {others.map((l) => (
              <div key={l.id} className="py-3">
                <p className="text-sm font-semibold text-ink">
                  {l.name} <span className="font-normal text-ink/60">| {l.status}{l.paused ? " | paused" : ""}</span>
                </p>
                <p className="text-xs text-ink/60">
                  {who(l.profiles)} | {money(l.cost_price)} to {money(l.customer_price)}
                </p>
                <div className="mt-1 flex gap-2">
                  {l.status !== "approved" && (
                    <button onClick={() => review(l, true)} disabled={busyId === l.id} className={btn + " border border-line bg-white text-ink"}>
                      Approve
                    </button>
                  )}
                  {l.status !== "rejected" && (
                    <button onClick={() => review(l, false)} disabled={busyId === l.id} className={btn + " border border-line bg-white text-red-600"}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// END OF FILE
