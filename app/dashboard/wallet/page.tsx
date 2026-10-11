"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TopupBox from "./topup-box";
import WithdrawBox from "./withdraw-box";

const CEDI = "GHS ";

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [purchaseBalance, setPurchaseBalance] = useState(0);
  const [profitBalance, setProfitBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [topups, setTopups] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const supabase: any = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: txns } = await supabase
      .from("wallet_transactions")
      .select("id, wallet_type, amount, reason, created_at")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });
    const all: any[] = txns ?? [];
    setTransactions(all.slice(0, 50));

    let purchase = 0;
    let profit = 0;
    all.forEach((t: any) => {
      if (t.wallet_type === "purchase") purchase += Number(t.amount);
      if (t.wallet_type === "profit") profit += Number(t.amount);
    });
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

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink/60">Loading...</main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Dashboard</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">My Wallet</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="border border-line bg-white p-5">
          <p className="text-xs text-ink/50">Purchase wallet</p>
          <p className="mt-1 font-display text-xl">{CEDI}{purchaseBalance.toFixed(2)}</p>
          <p className="mt-1 text-xs text-ink/50">Used to buy for offline customers</p>
        </div>
        <div className="border border-line bg-white p-5">
          <p className="text-xs text-ink/50">Profit wallet</p>
          <p className="mt-1 font-display text-xl text-leaf">{CEDI}{profitBalance.toFixed(2)}</p>
          <p className="mt-1 text-xs text-ink/50">Available to withdraw</p>
        </div>
      </div>

      <TopupBox topups={topups} onChange={load} />
      <WithdrawBox withdrawals={withdrawals} onChange={load} />

      <div className="mt-8">
        <h2 className="font-display text-lg text-indigo">Recent Wallet Activity</h2>
        <div className="mt-4 divide-y divide-line border-t border-line">
          {transactions.length === 0 && (
            <p className="py-4 text-sm text-ink/60">No activity yet.</p>
          )}
          {transactions.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p>{t.reason}</p>
                <p className="text-xs text-ink/50">
                  {t.wallet_type} {" - "} {new Date(t.created_at).toLocaleString()}
                </p>
              </div>
              <span className={Number(t.amount) >= 0 ? "text-leaf" : "text-red-600"}>
                {Number(t.amount) >= 0 ? "+" : ""}
                {CEDI}{Number(t.amount).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// END OF FILE
