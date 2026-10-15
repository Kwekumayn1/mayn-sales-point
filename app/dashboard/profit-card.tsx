"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MOMO_NETWORKS = ["MTN Mobile Money", "Telecel Cash", "AirtelTigo Money"];
const money = (n: number) => "GHS " + Number(n).toFixed(2);

export default function ProfitCard(props: { profit: number; purchase: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState(MOMO_NETWORKS[0]);
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e: any) {
    e.preventDefault();
    setError("");
    setMessage("");
    const value = Number(amount);
    if (Number.isNaN(value) || 0 >= value) {
      setError("Enter a valid amount.");
      return;
    }
    if (value > props.profit + 0.0001) {
      setError("You can only withdraw up to " + money(props.profit) + ".");
      return;
    }
    if (!number.trim()) {
      setError("Enter your Mobile Money number.");
      return;
    }
    setBusy(true);
    const supabase: any = createClient();
    const { error: err } = await supabase.rpc("request_withdrawal", {
      p_amount: value,
      p_momo_network: network,
      p_momo_number: number.trim(),
      p_account_name: name.trim() || null,
      p_note: null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setAmount("");
    setNumber("");
    setName("");
    setMessage("Withdrawal requested. The money is on hold until an admin pays it out.");
    router.refresh();
  }

  const box = "mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-indigo";

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-line bg-white p-5 sm:col-span-1">
        <p className="text-xs text-ink/50">Profit balance</p>
        <p className="mt-1 font-display text-3xl text-leaf">{money(props.profit)}</p>
        <button
          onClick={() => {
            setOpen(!open);
            setMessage("");
            setError("");
          }}
          className="mt-4 rounded-pill bg-gold px-5 py-2 text-sm font-semibold text-indigo hover:bg-gold-dark"
        >
          {open ? "Close" : "Withdraw"}
        </button>
        <Link href="/dashboard/wallet" className="ml-3 text-sm text-indigo underline">
          History
        </Link>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 sm:col-span-1">
        <p className="text-xs text-ink/50">Purchase wallet</p>
        <p className="mt-1 font-display text-3xl text-ink">{money(props.purchase)}</p>
        <Link
          href="/dashboard/wallet"
          className="mt-4 inline-block rounded-pill border border-line px-5 py-2 text-sm font-semibold text-ink"
        >
          Top up
        </Link>
      </div>

      {(open || message) && (
        <div className="rounded-2xl border border-line bg-white p-5 sm:col-span-2">
          {message && <p className="mb-3 text-sm text-leaf">{message}</p>}
          {open && (
            <form onSubmit={submit} className="space-y-3">
              <h2 className="font-display text-lg text-indigo">Withdraw profit</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Amount (GHS)</label>
                  <input
                    required
                    inputMode="decimal"
                    value={amount}
                    onChange={(e: any) => setAmount(e.target.value)}
                    className={box}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Network</label>
                  <select
                    value={network}
                    onChange={(e: any) => setNetwork(e.target.value)}
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Mobile Money number</label>
                  <input
                    required
                    inputMode="tel"
                    value={number}
                    onChange={(e: any) => setNumber(e.target.value)}
                    className={box}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Account name (optional)</label>
                  <input
                    value={name}
                    onChange={(e: any) => setName(e.target.value)}
                    className={box}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="rounded-pill bg-indigo px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Requesting..." : "Request withdrawal"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// END OF FILE
