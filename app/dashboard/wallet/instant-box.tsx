"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CEDI = "GHS ";

export default function InstantBox(props: { onChange: () => void }) {
  const [cfg, setCfg] = useState<any>({ fee_percent: 2, moolre_percent: 1, moolre_min: 0.5, min: 5, max: 10000 });
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [list, setList] = useState<any[]>([]);

  async function loadList() {
    const supabase: any = createClient();
    const { data } = await supabase
      .from("online_topups")
      .select("id, reference, amount, total, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    setList(data || []);
  }

  async function check(reference: string): Promise<string> {
    try {
      const res = await fetch("/api/wallet/online-topup/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const j: any = await res.json().catch(() => ({}));
      return String(j.status || "pending");
    } catch (e) {
      return "pending";
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/wallet/online-topup", { cache: "no-store" });
        const j: any = await r.json();
        if (j && typeof j.min === "number") setCfg(j);
      } catch (e) {
        // Keep the defaults.
      }
      await loadList();
      // Coming back from Moolre: confirm the payment, trying a few times.
      const ref = new URLSearchParams(window.location.search).get("topup");
      if (ref) {
        setNote("Checking your payment...");
        let st = "pending";
        for (let i = 0; i < 6 && st === "pending"; i++) {
          st = await check(ref);
          if (st === "pending") await new Promise((res) => setTimeout(res, 3000));
        }
        if (st === "credited") setNote("Payment received. Your wallet has been loaded.");
        else if (st === "mismatch") setNote("The amount paid did not match. Please contact the admin with reference " + ref + ".");
        else setNote("We have not seen the payment yet. If you paid, tap Check payment below in a minute.");
        await loadList();
        props.onChange();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = Number(amount);
  const valid = /^[0-9]+(\.[0-9]{1,2})?$/.test(amount.trim()) && value >= cfg.min && value <= cfg.max;
  const fee = valid
    ? Math.round((Math.max((value * cfg.moolre_percent) / 100, cfg.moolre_min) + (value * cfg.fee_percent) / 100) * 100) / 100
    : 0;
  const total = valid ? Math.round((value + fee) * 100) / 100 : 0;

  async function start(e: any) {
    e.preventDefault();
    setError("");
    setNote("");
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/online-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount.trim() }),
      });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || !j.authorizationUrl) {
        setError(j.error || "Could not start the payment.");
        setBusy(false);
        return;
      }
      window.location.href = j.authorizationUrl;
    } catch (err) {
      setError("Could not start the payment.");
      setBusy(false);
    }
  }

  async function recheck(ref: string) {
    setNote("Checking...");
    const st = await check(ref);
    setNote(st === "credited" ? "Payment received. Your wallet has been loaded." : "Not paid yet.");
    await loadList();
    props.onChange();
  }

  return (
    <div className="border border-line bg-white p-6">
      <h2 className="font-display text-lg text-indigo">Load instantly with Mobile Money</h2>
      <p className="mt-2 text-sm text-ink/60">
        Enter an amount, pay on the Moolre page, and your wallet is credited automatically. Between {CEDI}
        {cfg.min} and {CEDI}
        {cfg.max} each time.
      </p>
      <form onSubmit={start} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-sm font-medium">Amount to load (GHS)</label>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e: any) => setAmount(e.target.value)}
            className="mt-1 w-40 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !valid}
          className="rounded-pill bg-indigo px-6 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Please wait..." : "Pay with Mobile Money"}
        </button>
      </form>
      {valid && (
        <p className="mt-3 text-sm">
          Wallet receives <b>{CEDI}{value.toFixed(2)}</b>. Service charge {CEDI}{fee.toFixed(2)}. You pay{" "}
          <b>{CEDI}{total.toFixed(2)}</b>.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {note && <p className="mt-2 text-sm font-medium text-leaf">{note}</p>}

      {list.length > 0 && (
        <div className="mt-6 divide-y divide-line border-t border-line">
          {list.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {CEDI}{Number(t.amount).toFixed(2)} {" - "} {t.reference}
              </span>
              {t.status === "pending_payment" ? (
                <button onClick={() => recheck(t.reference)} className="text-xs font-semibold text-indigo underline">
                  Check payment
                </button>
              ) : (
                <span className="text-leaf">loaded</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// END OF FILE
