"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MOMO_NETWORKS = ["MTN Mobile Money", "Telecel Cash", "AirtelTigo Money"];

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [myVendorCode, setMyVendorCode] = useState("");
  const [purchaseBalance, setPurchaseBalance] = useState(0);
  const [profitBalance, setProfitBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [topups, setTopups] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const [topupAmount, setTopupAmount] = useState("");
  const [topupRef, setTopupRef] = useState("");
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [topupMessage, setTopupMessage] = useState<string | null>(null);

  const [wAmount, setWAmount] = useState("");
  const [wNetwork, setWNetwork] = useState(MOMO_NETWORKS[0]);
  const [wNumber, setWNumber] = useState("");
  const [wName, setWName] = useState("");
  const [wSubmitting, setWSubmitting] = useState(false);
  const [wError, setWError] = useState<string | null>(null);
  const [wMessage, setWMessage] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("vendor_id")
      .eq("id", user.id)
      .single();
    setMyVendorCode(profile?.vendor_id ?? "");
    setTopupRef((prev) => prev || profile?.vendor_id || "");

    const { data: txns } = await supabase
      .from("wallet_transactions")
      .select("id, wallet_type, amount, reason, created_at")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTransactions(txns ?? []);

    const purchase = (txns ?? [])
      .filter((t) => t.wallet_type === "purchase")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const profit = (txns ?? [])
      .filter((t) => t.wallet_type === "profit")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    setPurchaseBalance(purchase);
    setProfitBalance(profit);

    const { data: topupList } = await supabase
      .from("topup_requests")
      .select("id, amount, momo_reference, status, created_at")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });
    setTopups(topupList ?? []);

    const { data: withdrawalList } = await supabase
      .from("withdrawal_requests")
      .select("id, amount, momo_network, momo_number, status, created_at")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });
    setWithdrawals(withdrawalList ?? []);

    setLoading(false);
  }

  async function handleTopupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopupError(null);
    setTopupMessage(null);
    const amount = Number(topupAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setTopupError("Enter a valid amount.");
      return;
    }
    if (!topupRef.trim()) {
      setTopupError("Enter the reference you used in the MoMo transaction.");
      return;
    }

    setTopupSubmitting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setTopupSubmitting(false);
      return;
    }

    const { error } = await supabase.from("topup_requests").insert({
      vendor_id: user.id,
      amount,
      momo_reference: topupRef.trim(),
    });

    setTopupSubmitting(false);
    if (error) {
      setTopupError(error.message);
      return;
    }
    setTopupAmount("");
    setTopupMessage(
      "Top-up request submitted — an admin will confirm it once your payment is verified."
    );
    void load();
  }

  async function handleWithdrawalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWError(null);
    setWMessage(null);
    const amount = Number(wAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setWError("Enter a valid amount.");
      return;
    }
    if (!wNumber.trim()) {
      setWError("Enter your Mobile Money number.");
      return;
    }

    setWSubmitting(true);
    const supabase = createClient();
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
    setWMessage("Withdrawal requested — funds are on hold until an admin processes it.");
    void load();
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Dashboard</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">My Wallet</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="border border-line bg-white p-5">
          <p className="text-xs text-ink/50">Purchase wallet</p>
          <p className="mt-1 font-display text-xl">GH₵{purchaseBalance.toFixed(2)}</p>
          <p className="mt-1 text-xs text-ink/50">Used to buy for offline customers</p>
        </div>
        <div className="border border-line bg-white p-5">
          <p className="text-xs text-ink/50">Profit wallet</p>
          <p className="mt-1 font-display text-xl text-leaf">GH₵{profitBalance.toFixed(2)}</p>
          <p className="mt-1 text-xs text-ink/50">Available to withdraw</p>
        </div>
      </div>

      <div className="mt-8 border border-line bg-white p-6">
        <h2 className="font-display text-lg text-indigo">Load Purchase Wallet</h2>
        <p className="mt-2 text-sm text-ink/60">
          Send Mobile Money to the platform's number, using your Vendor ID{" "}
          <span className="font-medium text-indigo">{myVendorCode}</span> as
          the reference. Then submit the details below — an admin will
          confirm it once they see the payment.
        </p>
        <form onSubmit={handleTopupSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Amount sent (GH₵)</label>
              <input
                required
                inputMode="decimal"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reference used</label>
              <input
                required
                value={topupRef}
                onChange={(e) => setTopupRef(e.target.value)}
                className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
              />
            </div>
          </div>
          {topupError && <p className="text-sm text-red-600">{topupError}</p>}
          {topupMessage && <p className="text-sm text-leaf">{topupMessage}</p>}
          <button
            type="submit"
            disabled={topupSubmitting}
            className="rounded-pill bg-indigo px-6 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
          >
            {topupSubmitting ? "Submitting…" : "Submit top-up"}
          </button>
        </form>

        {topups.length > 0 && (
          <div className="mt-6 divide-y divide-line border-t border-line">
            {topups.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  GH₵{Number(t.amount).toFixed(2)} · {t.momo_reference}
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

      <div className="mt-8 border border-line bg-white p-6">
        <h2 className="font-display text-lg text-indigo">Withdraw Profit</h2>
        <form onSubmit={handleWithdrawalSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Amount (GH₵)</label>
              <input
                required
                inputMode="decimal"
                value={wAmount}
                onChange={(e) => setWAmount(e.target.value)}
                className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Network</label>
              <select
                value={wNetwork}
                onChange={(e) => setWNetwork(e.target.value)}
                className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
              >
                {MOMO_NETWORKS.map((n) => (
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
                onChange={(e) => setWNumber(e.target.value)}
                className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Account name (optional)</label>
              <input
                value={wName}
                onChange={(e) => setWName(e.target.value)}
                className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
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
            {wSubmitting ? "Requesting…" : "Request withdrawal"}
          </button>
        </form>

        {withdrawals.length > 0 && (
          <div className="mt-6 divide-y divide-line border-t border-line">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  GH₵{Number(w.amount).toFixed(2)} · {w.momo_network} {w.momo_number}
                </span>
                <span className="text-ink/50">{w.status.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg text-indigo">Recent Wallet Activity</h2>
        <div className="mt-4 divide-y divide-line border-t border-line">
          {transactions.length === 0 && (
            <p className="py-4 text-sm text-ink/60">No activity yet.</p>
          )}
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p>{t.reason}</p>
                <p className="text-xs text-ink/50">
                  {t.wallet_type} · {new Date(t.created_at).toLocaleString()}
                </p>
              </div>
              <span className={Number(t.amount) >= 0 ? "text-leaf" : "text-red-600"}>
                {Number(t.amount) >= 0 ? "+" : ""}
                GH₵{Number(t.amount).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
    }
