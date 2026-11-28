"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Pkg = { id: string; price: number; sessions: number };

const card = "rounded-2xl border border-line bg-white p-5";
const button =
  "rounded-xl bg-indigo px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";

export default function MyUssdPage() {
  const supabase: any = useMemo(() => createClient(), []);
  const [vendorId, setVendorId] = useState("");
  const [code, setCode] = useState("*426*240#");
  const [billing, setBilling] = useState(false);
  const [balance, setBalance] = useState(0);
  const [wallet, setWallet] = useState(0);
  const [usage, setUsage] = useState({ today: 0, month: 0 });
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: p } = await supabase
      .from("profiles")
      .select("vendor_id")
      .eq("id", user.id)
      .single();
    setVendorId(p && p.vendor_id ? String(p.vendor_id) : "");

    const { data: s } = await supabase
      .from("ussd_settings")
      .select("billing_enabled, ussd_code")
      .eq("id", 1)
      .maybeSingle();
    if (s) {
      setBilling(s.billing_enabled === true);
      if (s.ussd_code) setCode(String(s.ussd_code));
    }

    const { data: b } = await supabase.rpc("my_ussd_balance");
    setBalance(typeof b === "number" ? b : 0);
    const { data: u } = await supabase.rpc("my_ussd_usage");
    if (u) setUsage({ today: Number(u.today) || 0, month: Number(u.month) || 0 });

    let total = 0;
    for (let from = 0; ; from += 1000) {
      const { data: rows } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("vendor_id", user.id)
        .eq("wallet_type", "purchase")
        .range(from, from + 999);
      const list = rows ?? [];
      for (const r of list) total += Number(r.amount);
      if (list.length < 1000) break;
    }
    setWallet(total);

    const { data: pk } = await supabase
      .from("ussd_packages")
      .select("id, price, sessions")
      .eq("active", true)
      .order("price", { ascending: true });
    setPackages(
      ((pk ?? []) as any[]).map((x) => ({
        id: x.id,
        price: Number(x.price),
        sessions: Number(x.sessions),
      }))
    );
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const shareText =
    "Buy from me on USSD: dial " + code + " then enter " + vendorId + " to view my products and buy.";

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice({ ok: false, text: "Could not copy. Press and hold the text above to copy it." });
    }
  }

  async function buy(p: Pkg) {
    if (
      !window.confirm(
        "Buy " + p.sessions.toLocaleString() + " USSD sessions for GHS " + p.price + " from your Purchase Wallet?"
      )
    )
      return;
    setBusy(p.id);
    setNotice(null);
    const { error } = await supabase.rpc("buy_ussd_package", { p_package_id: p.id });
    setBusy("");
    if (error) {
      setNotice({ ok: false, text: error.message });
      return;
    }
    setNotice({ ok: true, text: "Bought " + p.sessions.toLocaleString() + " USSD sessions." });
    await load();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-ink/50">Mayn Sales Point</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">My USSD</h1>

      <section className={card + " mt-6"}>
        <p className="text-xs text-ink/50">Your customers dial</p>
        <p className="mt-1 font-display text-3xl text-indigo">{code}</p>
        <p className="mt-4 text-xs text-ink/50">Then they enter your Vendor ID as the key</p>
        <p className="mt-1 font-display text-3xl text-indigo">{vendorId || "-"}</p>
        <p className="mt-4 text-sm text-ink/70">
          They will see your products, and can buy right from their phone.
        </p>
        <div className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm">{shareText}</div>
        <button className={button + " mt-3"} onClick={copyShare}>
          {copied ? "Copied" : "Copy message to share"}
        </button>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className={card}>
          <p className="text-xs text-ink/50">USSD sessions left</p>
          <p className="mt-1 font-display text-2xl">{balance.toLocaleString()}</p>
          <p className="mt-2 text-xs text-ink/50">
            Used today: {usage.today.toLocaleString()} &middot; This month: {usage.month.toLocaleString()}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs text-ink/50">Purchase Wallet</p>
          <p className="mt-1 font-display text-2xl">GHS {wallet.toFixed(2)}</p>
        </div>
      </div>

      {notice && (
        <div
          className={
            "mt-4 rounded-xl px-4 py-3 text-sm font-semibold " +
            (notice.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900")
          }
        >
          {notice.text}
        </div>
      )}

      <section className={card + " mt-6"}>
        <h2 className="font-display text-lg text-indigo">Buy USSD sessions</h2>
        <p className="mt-1 text-xs text-ink/50">
          {billing
            ? "Every time a customer dials and enters your ID, 1 session is used, whether they buy or not. When your sessions run out, customers cannot open your USSD menu."
            : "USSD sessions are free for now. You will be told before charging starts."}
        </p>
        {billing && balance < 50 && (
          <div className="mt-3 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
            {balance < 1 ? "You have no sessions left. Buy a package so customers can reach you." : "Your sessions are running low."}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {packages.map((p) => (
            <button
              key={p.id}
              onClick={() => buy(p)}
              disabled={busy !== "" || wallet < p.price}
              className="rounded-xl border border-line px-3 py-4 text-left disabled:opacity-40"
            >
              <div className="font-display text-lg">GHS {p.price}</div>
              <div className="text-sm text-ink/70">{p.sessions.toLocaleString()} sessions</div>
              <div className="text-xs text-ink/50">GHS {(p.price / p.sessions).toFixed(4)} each</div>
            </button>
          ))}
        </div>
        {packages.length > 0 && wallet < packages[0].price && (
          <p className="mt-3 text-xs text-red-700">Top up your Purchase Wallet first to buy sessions.</p>
        )}
      </section>
    </main>
  );
}

// END OF FILE
