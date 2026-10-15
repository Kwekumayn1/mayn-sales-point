"use client";

import { useEffect, useState } from "react";

const money = (n: number) => "GHS " + Number(n).toFixed(2);

async function api(body: any): Promise<any> {
  try {
    const res = await fetch("/api/admin/justice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { error: "Could not reach the server." };
  }
}

function phoneOf(o: any) {
  const v = o && o.custom_field_values;
  if (v && typeof v === "object") {
    const k = Object.keys(v).find((x) => /benef|recipient|phone|number/i.test(x));
    if (k) return String(v[k]);
  }
  return "";
}

function chip(o: any) {
  const s = o.supplier_status;
  if (!s) return { text: "Paid, not sent", cls: "bg-amber-100 text-amber-800" };
  if (s === "sent") return { text: "Sent to Justice", cls: "bg-blue-100 text-blue-800" };
  if (s === "completed") return { text: "Delivered", cls: "bg-green-100 text-green-800" };
  if (s === "failed") return { text: "Failed", cls: "bg-red-100 text-red-800" };
  if (s === "review") return { text: "Needs your check", cls: "bg-red-100 text-red-800" };
  return { text: s, cls: "bg-gray-100 text-gray-800" };
}

export default function JusticePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<string>("...");
  const [autoOn, setAutoOn] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  async function loadRows() {
    const r = await api({ action: "list" });
    setRows(r.rows || []);
    setLoading(false);
  }

  async function loadBalance() {
    setBalance("...");
    const r = await api({ action: "balance" });
    setBalance(r.ok ? money(r.cedis) : "Error: " + (r.message || r.error || "unknown"));
  }

  useEffect(() => {
    void loadRows();
    void loadBalance();
    (async () => {
      const r = await api({ action: "setting_get" });
      setAutoOn(!!r.on);
    })();
  }, []);

  async function run(label: string, body: any) {
    setBusy(label);
    setMsg("");
    const r = await api(body);
    setBusy("");
    if (r.error) setMsg("Error: " + r.error);
    else setMsg(label + " done: " + JSON.stringify(r));
    await loadRows();
    return r;
  }

  async function toggleAuto() {
    const next = !autoOn;
    if (next && !window.confirm("Turn ON auto-send? Paid MTN orders will go to Justice automatically.")) return;
    const r = await api({ action: "setting_set", on: next });
    if (r.error) setMsg("Error: " + r.error);
    else setAutoOn(!!r.on);
  }

  const btn = "rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50";
  const btnMain = "rounded-pill bg-indigo px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl text-indigo">Justice orders</h1>
      <p className="mt-1 text-sm text-ink/60">MTN data orders sent straight to Justice Data Shop.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs text-ink/50">Justice balance</p>
          <p className="mt-1 text-xl font-semibold text-ink">{balance}</p>
          <button className={btn + " mt-2"} onClick={loadBalance}>
            Refresh balance
          </button>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs text-ink/50">Auto-send after payment</p>
          <p className={"mt-1 text-xl font-semibold " + (autoOn ? "text-leaf" : "text-red-600")}>
            {autoOn ? "ON" : "OFF"}
          </p>
          <button className={btn + " mt-2"} onClick={toggleAuto}>
            {autoOn ? "Turn off" : "Turn on"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className={btnMain} disabled={!!busy} onClick={() => run("Send paid orders", { action: "sweep" })}>
          {busy === "Send paid orders" ? "Sending..." : "Send paid orders now"}
        </button>
        <button className={btnMain} disabled={!!busy} onClick={() => run("Refresh statuses", { action: "refresh" })}>
          {busy === "Refresh statuses" ? "Checking..." : "Refresh statuses"}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink/50">
        "Send paid orders now" sends only if auto-send is ON. Use the Send now button on a single order to send it
        even when auto-send is off.
      </p>

      {msg && <p className="mt-3 break-words rounded-xl bg-paper p-3 text-sm text-ink">{msg}</p>}

      {loading && <p className="mt-6 text-sm text-ink/60">Loading...</p>}
      {!loading && rows.length === 0 && <p className="mt-6 text-sm text-ink/60">No Justice orders yet.</p>}

      <div className="mt-5 divide-y divide-line border-t border-line">
        {rows.map((o) => {
          const c = chip(o);
          return (
            <div key={o.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">
                    {o.order_number} <span className="font-normal text-ink/60">| {o.product_name} {o.variant_name}</span>
                  </p>
                  <p className="text-xs text-ink/60">
                    {phoneOf(o)} | {new Date(o.created_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })}
                  </p>
                </div>
                <span className={"rounded-full px-3 py-1 text-xs font-semibold " + c.cls}>{c.text}</span>
              </div>
              {o.supplier_message && <p className="mt-1 text-xs text-ink/60">Justice: {o.supplier_message}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {!o.supplier_status && (
                  <button className={btn} disabled={!!busy} onClick={() => run("Send now", { action: "send_one", id: o.id })}>
                    Send now
                  </button>
                )}
                {o.supplier_status === "sent" && (
                  <button className={btn} disabled={!!busy} onClick={() => run("Check now", { action: "refresh", id: o.id })}>
                    Check now
                  </button>
                )}
                {o.supplier_status === "failed" && (
                  <button className={btn} disabled={!!busy} onClick={() => run("Retry", { action: "retry", id: o.id })}>
                    Retry
                  </button>
                )}
                {(o.supplier_status === "review" || o.supplier_status === "failed") && (
                  <button
                    className={btn}
                    disabled={!!busy}
                    onClick={() => {
                      if (window.confirm("Only tap this if Justice shows this order as delivered. Continue?"))
                        void run("Mark delivered", { action: "mark_delivered", id: o.id });
                    }}
                  >
                    I checked: it was delivered
                  </button>
                )}
                {o.supplier_status === "review" && (
                  <button
                    className={btn}
                    disabled={!!busy}
                    onClick={() => {
                      if (window.confirm("Only tap this if Justice has NO record of this order. Continue?"))
                        void run("Mark not sent", { action: "mark_not_sent", id: o.id });
                    }}
                  >
                    I checked: it was NOT sent
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

// END OF FILE
