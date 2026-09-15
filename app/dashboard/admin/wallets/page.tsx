"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminWalletsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [vendorCode, setVendorCode] = useState("");
  const [foundVendor, setFoundVendor] = useState<any>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditWallet, setCreditWallet] = useState("purchase");
  const [creditReason, setCreditReason] = useState("");
  const [creditSubmitting, setCreditSubmitting] = useState(false);
  const [creditMessage, setCreditMessage] = useState<string | null>(null);

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
      .select("role")
      .eq("id", user.id)
      .single();
    const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
    setAllowed(isAdmin);
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("topup_requests")
      .select("id, amount, momo_reference, status, created_at, profiles(full_name, vendor_id)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setPending(data ?? []);
    setLoading(false);
  }

  async function handleConfirm(id: string) {
    setProcessingId(id);
    const supabase = createClient();
    const { error } = await supabase.rpc("confirm_topup", { p_request_id: id });
    setProcessingId(null);
    if (error) {
      alert(error.message);
      return;
    }
    void load();
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    const supabase = createClient();
    const { error } = await supabase.rpc("reject_topup", {
      p_request_id: id,
      p_note: "Rejected by admin",
    });
    setProcessingId(null);
    if (error) {
      alert(error.message);
      return;
    }
    void load();
  }

  async function handleSearchVendor(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    setFoundVendor(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, vendor_id")
      .eq("vendor_id", vendorCode.trim())
      .single();
    if (!data) {
      setSearchError("No vendor found with that Vendor ID.");
      return;
    }
    setFoundVendor(data);
  }

  async function handleCredit(e: React.FormEvent) {
    e.preventDefault();
    setCreditMessage(null);
    if (!foundVendor) return;
    const amount = Number(creditAmount);
    if (Number.isNaN(amount) || amount === 0) {
      setSearchError("Enter a valid, non-zero amount.");
      return;
    }

    setCreditSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_credit_wallet", {
      p_vendor_id: foundVendor.id,
      p_wallet_type: creditWallet,
      p_amount: amount,
      p_reason: creditReason || null,
    });
    setCreditSubmitting(false);
    if (error) {
      setSearchError(error.message);
      return;
    }
    setCreditMessage("Wallet updated.");
    setCreditAmount("");
    setCreditReason("");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-sm text-ink/60">
        You do not have access to this page.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Admin</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">Wallet Top-ups</h1>

      <div className="mt-8">
        <h2 className="font-display text-lg text-indigo">Pending requests</h2>
        {pending.length === 0 && (
          <p className="mt-3 text-sm text-ink/60">No pending top-up requests.</p>
        )}
        <div className="mt-4 divide-y divide-line border-t border-line">
          {pending.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">
                  {r.profiles?.full_name} ({r.profiles?.vendor_id})
                </p>
                <p className="text-xs text-ink/50">
                  GH₵{Number(r.amount).toFixed(2)} · ref: {r.momo_reference} ·{" "}
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirm(r.id)}
                  disabled={processingId === r.id}
                  className="rounded-pill bg-leaf px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Confirm
                </button>
                <button
                  onClick={() => handleReject(r.id)}
                  disabled={processingId === r.id}
                  className="rounded-pill border border-line px-4 py-2 text-sm disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 border border-line bg-white p-6">
        <h2 className="font-display text-lg text-indigo">Manual wallet credit</h2>
        <p className="mt-2 text-sm text-ink/60">
          For adjustments outside the normal top-up flow.
        </p>

        <form onSubmit={handleSearchVendor} className="mt-4 flex gap-3">
          <input
            value={vendorCode}
            onChange={(e) => setVendorCode(e.target.value)}
            placeholder="Vendor ID, e.g. MSP-000125"
            className="flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
          />
          <button
            type="submit"
            className="rounded-pill bg-indigo px-5 py-2 text-sm font-medium text-white hover:bg-indigo-light"
          >
            Find
          </button>
        </form>
        {searchError && <p className="mt-2 text-sm text-red-600">{searchError}</p>}

        {foundVendor && (
          <form onSubmit={handleCredit} className="mt-4 space-y-4 border-t border-line pt-4">
            <p className="text-sm">
              Vendor: <span className="font-medium">{foundVendor.full_name}</span> (
              {foundVendor.vendor_id})
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Amount (GH₵, negative to debit)</label>
                <input
                  required
                  inputMode="decimal"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Wallet</label>
                <select
                  value={creditWallet}
                  onChange={(e) => setCreditWallet(e.target.value)}
                  className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
                >
                  <option value="purchase">Purchase</option>
                  <option value="profit">Profit</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <input
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
              />
            </div>
            {creditMessage && <p className="text-sm text-leaf">{creditMessage}</p>}
            <button
              type="submit"
              disabled={creditSubmitting}
              className="rounded-pill bg-indigo px-6 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
            >
              {creditSubmitting ? "Saving…" : "Apply"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
      }
