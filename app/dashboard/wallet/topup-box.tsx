"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PAY_NUMBER = "0247205450";
const PAY_NAME = "JO FORD VENTURES";
const CEDI = "GHS ";

export default function TopupBox(props: { topups: any[]; onChange: () => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState<any>(null);

  async function request(e: any) {
    e.preventDefault();
    setError("");
    setFresh(null);
    const value = Number(amount);
    if (Number.isNaN(value) || 0 >= value) {
      setError("Enter a valid amount.");
      return;
    }
    const supabase: any = createClient();
    setBusy(true);
    const { data, error: err } = await supabase.rpc("vendor_request_topup", {
      p_amount: value,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setFresh({ code: data, amount: value });
    setAmount("");
    props.onChange();
  }

  const pending = props.topups.filter((t: any) => t.status === "pending");

  return (
    <div className="mt-8 border border-line bg-white p-6">
      <h2 className="font-display text-lg text-indigo">Load Purchase Wallet</h2>
      <p className="mt-2 text-sm text-ink/60">
        1. Enter the amount you want to load and tap Get my reference.
        <br />
        2. Send that exact amount by Mobile Money and type the reference we give you.
      </p>

      <form onSubmit={request} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-sm font-medium">Amount (GHS)</label>
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
          disabled={busy}
          className="rounded-pill bg-indigo px-6 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Please wait..." : "Get my reference"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {fresh && (
        <div className="mt-4 rounded-xl border border-leaf bg-green-50 p-4 text-sm">
          <p className="font-medium text-indigo">Now send the money:</p>
          <p className="mt-2">
            Amount: <b>{CEDI}{Number(fresh.amount).toFixed(2)}</b> (send exactly this)
          </p>
          <p>
            Number: <b>{PAY_NUMBER}</b> ({PAY_NAME})
          </p>
          <p>
            Reference: <b className="text-lg">{fresh.code}</b>
          </p>
          <p className="mt-2 text-xs text-ink/60">
            Type the reference exactly as shown. Your wallet is credited as soon as the admin sees your payment.
          </p>
        </div>
      )}

      {pending.length > 0 && !fresh && (
        <div className="mt-4 rounded-xl border border-line bg-gray-50 p-4 text-sm">
          <p className="font-medium text-indigo">Waiting for your payment:</p>
          {pending.map((t: any) => (
            <p key={t.id} className="mt-1">
              Send <b>{CEDI}{Number(t.amount).toFixed(2)}</b> to <b>{PAY_NUMBER}</b> ({PAY_NAME}) with
              reference <b>{t.momo_reference}</b>
            </p>
          ))}
        </div>
      )}

      {props.topups.length > 0 && (
        <div className="mt-6 divide-y divide-line border-t border-line">
          {props.topups.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {CEDI}{Number(t.amount).toFixed(2)} {" - "} {t.momo_reference}
              </span>
              <span
                className={
                  t.status === "confirmed"
                    ? "text-leaf"
                    : t.status === "rejected"
                    ? "text-red-600"
                    : "text-ink/50"
                }
              >
                {t.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// END OF FILE
