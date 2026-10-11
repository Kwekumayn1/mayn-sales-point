"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MOMO_NETWORKS = ["MTN Mobile Money", "Telecel Cash", "AirtelTigo Money"];
const CEDI = "GHS ";

export default function WithdrawBox(props: { withdrawals: any[]; onChange: () => void }) {
  const [wAmount, setWAmount] = useState("");
  const [wNetwork, setWNetwork] = useState(MOMO_NETWORKS[0]);
  const [wNumber, setWNumber] = useState("");
  const [wName, setWName] = useState("");
  const [wSubmitting, setWSubmitting] = useState(false);
  const [wError, setWError] = useState("");
  const [wMessage, setWMessage] = useState("");

  async function submit(e: any) {
    e.preventDefault();
    setWError("");
    setWMessage("");
    const amount = Number(wAmount);
    if (Number.isNaN(amount) || 0 >= amount) {
      setWError("Enter a valid amount.");
      return;
    }
    if (!wNumber.trim()) {
      setWError("Enter your Mobile Money number.");
      return;
    }
    setWSubmitting(true);
    const supabase: any = createClient();
    const { error } = await supabase.rpc("request_withdrawal", {
      p_amount: amount,
      p_momo_network: wNetwork,
      p_momo_number: wNumber.trim(),
      p_account_name: wName.trim() || null,
      p_note: null,
    });
    setWSubmitting(false);
    if (error) {
      setWError(error.message);
      return;
    }
    setWAmount("");
    setWNumber("");
    setWName("");
    setWMessage("Withdrawal requested. Funds are on hold until an admin processes it.");
    props.onChange();
  }

  const box = "mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo";

  return (
    <div className="mt-8 border border-line bg-white p-6">
      <h2 className="font-display text-lg text-indigo">Withdraw Profit</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Amount (GHS)</label>
            <input
              required
              inputMode="decimal"
              value={wAmount}
              onChange={(e: any) => setWAmount(e.target.value)}
              className={box}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Network</label>
            <select
              value={wNetwork}
              onChange={(e: any) => setWNetwork(e.target.value)}
              className={box}
            >
              {MOMO_NETWORKS.map((n: string) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Mobile Money number</label>
            <input
              required
              value={wNumber}
              onChange={(e: any) => setWNumber(e.target.value)}
              className={box}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Account name (optional)</label>
            <input
              value={wName}
              onChange={(e: any) => setWName(e.target.value)}
              className={box}
            />
          </div>
        </div>
        {wError && <p className="text-sm text-red-600">{wError}</p>}
        {wMessage && <p className="text-sm text-leaf">{wMessage}</p>}
        <button
          type="submit"
          disabled={wSubmitting}
          className="rounded-pill bg-gold px-6 py-2 text-sm font-medium text-indigo hover:bg-gold-dark disabled:opacity-60"
        >
          {wSubmitting ? "Requesting..." : "Request withdrawal"}
        </button>
      </form>

      {props.withdrawals.length > 0 && (
        <div className="mt-6 divide-y divide-line border-t border-line">
          {props.withdrawals.map((w: any) => (
            <div key={w.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {CEDI}{Number(w.amount).toFixed(2)} {" - "} {w.momo_network} {w.momo_number}
              </span>
              <span className="text-ink/50">{String(w.status).replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// END OF FILE
