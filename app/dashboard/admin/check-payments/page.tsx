"use client";

import { useEffect, useState } from "react";

const TONE: Record<string, string> = {
  paid_ok: "bg-green-50 text-green-800",
  paid_mismatch: "bg-amber-50 text-amber-800",
  not_paid: "bg-red-50 text-red-700",
  not_found: "bg-gray-100 text-gray-700",
  error: "bg-red-50 text-red-700",
};

async function api(body: any) {
  const res = await fetch("/api/admin/reconcile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { ok: res.ok, ...json };
}

function phoneOf(o: any) {
  const vals: any[] = o && o.custom_field_values ? Object.values(o.custom_field_values) : [];
  return vals.length ? String(vals[0]) : "";
}

export default function CheckPaymentsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [days, setDays] = useState("3");
  const [number, setNumber] = useState("");

  async function loadList() {
    setLoading(true);
    const r = await api({ action: "list", days: Number(days) });
    if (!r.ok) setMsg(r.error || "Could not load orders.");
    setOrders(r.orders || []);
    setLoading(false);
  }

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  async function checkOne(num: string) {
    setBusy(num);
    setMsg("");
    const r = await api({ action: "check", orderNumber: num });
    setBusy("");
    if (!r.ok) {
      setMsg(r.error || "Check failed.");
      return null;
    }
    setResults((prev: any) => ({ ...prev, [num]: r }));
    return r;
  }

  async function confirmOne(num: string, force: boolean) {
    const ask = force
      ? "The amount on Moolre is different from the order price. Mark this order as paid anyway?"
      : "Mark order " + num + " as paid?";
    if (!window.confirm(ask)) return;
    setBusy(num);
    const r = await api({ action: "confirm", orderNumber: num, force: force });
    setBusy("");
    if (!r.ok) {
      setMsg(r.error || "Could not mark as paid.");
      return;
    }
    setMsg("Order " + num + " is now paid.");
    setResults((prev: any) => {
      const copy = { ...prev };
      delete copy[num];
      return copy;
    });
    void loadList();
  }

  async function checkAll() {
    setMsg("");
    for (let i = 0; i < orders.length; i++) {
      await checkOne(orders[i].order_number);
    }
    setMsg("Finished checking " + orders.length + " orders.");
  }

  async function confirmVerified() {
    const ready = orders.filter((o: any) => results[o.order_number] && results[o.order_number].verdict.code === "paid_ok");
    if (ready.length === 0) {
      setMsg("No checked orders are verified as paid yet.");
      return;
    }
    if (!window.confirm("Mark " + ready.length + " verified orders as paid?")) return;
    let done = 0;
    for (let i = 0; i < ready.length; i++) {
      const r = await api({ action: "confirm", orderNumber: ready[i].order_number, force: false });
      if (r.ok) done += 1;
    }
    setMsg(done + " orders marked as paid.");
    setResults({});
    void loadList();
  }

  const searched = number.trim() && results[number.trim()] ? results[number.trim()] : null;

  function card(o: any, res: any) {
    const v = res ? res.verdict : null;
    return (
      <div key={o.order_number} className="border-b border-line py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium">{o.order_number}</p>
            <p className="text-xs text-ink/60">
              {o.product_name}
              {o.variant_name ? " - " + o.variant_name : ""} {" | "} GHS {Number(o.unit_price).toFixed(2)}
            </p>
            <p className="text-xs text-ink/50">
              {phoneOf(o)} {" | "} {new Date(o.created_at).toLocaleString()} {" | "} {o.status}
            </p>
          </div>
          <button
            onClick={() => checkOne(o.order_number)}
            disabled={busy === o.order_number}
            className="rounded-pill border border-line px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy === o.order_number ? "Checking..." : "Check with Moolre"}
          </button>
        </div>
        {v && (
          <div className={"mt-3 rounded-xl p-3 text-sm " + (TONE[v.code] || "")}>
            <p>{v.text}</p>
            {res.look && res.look.ok && res.look.found && (
              <p className="mt-1 text-xs opacity-80">
                Moolre: status {res.look.txstatus} {" | "} amount {res.look.amount} {" | "} payer {res.look.payer} {" | "} ref{" "}
                {res.look.thirdpartyref}
              </p>
            )}
            {o.status === "pending_payment" && v.code === "paid_ok" && (
              <button
                onClick={() => confirmOne(o.order_number, false)}
                disabled={busy === o.order_number}
                className="mt-3 rounded-pill bg-leaf px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Mark as paid
              </button>
            )}
            {o.status === "pending_payment" && v.code === "paid_mismatch" && (
              <button
                onClick={() => confirmOne(o.order_number, true)}
                disabled={busy === o.order_number}
                className="mt-3 rounded-pill border border-amber-600 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-50"
              >
                Mark as paid anyway
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Admin</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">Check payments</h1>
      <p className="mt-2 text-sm text-ink/60">
        Finds orders that are stuck on Awaiting payment and asks Moolre if the customer was really charged.
      </p>

      <div className="mt-6 border border-line bg-white p-5">
        <h2 className="font-display text-lg text-indigo">Check one order</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={number}
            onChange={(e: any) => setNumber(e.target.value)}
            placeholder="Order number"
            className="flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
          <button
            onClick={() => number.trim() && checkOne(number.trim())}
            className="rounded-pill bg-indigo px-5 py-2 text-sm font-medium text-white"
          >
            Check
          </button>
        </div>
        {searched && card(searched.order, searched)}
      </div>

      {msg && <p className="mt-4 rounded-xl bg-gray-100 p-3 text-sm text-ink">{msg}</p>}

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg text-indigo">Awaiting payment ({orders.length})</h2>
          <select
            value={days}
            onChange={(e: any) => setDays(e.target.value)}
            className="border border-line px-3 py-2 text-sm"
          >
            <option value="1">Last 24 hours</option>
            <option value="3">Last 3 days</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={checkAll} disabled={busy !== "" || orders.length === 0} className="rounded-pill bg-indigo px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
            Check all with Moolre
          </button>
          <button onClick={confirmVerified} disabled={busy !== ""} className="rounded-pill bg-leaf px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
            Mark all verified as paid
          </button>
        </div>
        {loading && <p className="mt-4 text-sm text-ink/60">Loading...</p>}
        {!loading && orders.length === 0 && <p className="mt-4 text-sm text-ink/60">No orders waiting for payment.</p>}
        <div className="mt-2">{orders.map((o: any) => card(o, results[o.order_number]))}</div>
      </div>
    </main>
  );
}

// END OF FILE
