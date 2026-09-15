"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS_OPTIONS = [
  "requested",
  "under_review",
  "approved",
  "processing",
  "paid",
  "rejected",
  "failed",
];

export default function AdminWithdrawalsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
      .from("withdrawal_requests")
      .select(
        "id, amount, momo_network, momo_number, account_name, status, created_at, profiles(full_name, vendor_id)"
      )
      .order("created_at", { ascending: false });
    setWithdrawals(data ?? []);
    setLoading(false);
  }

  async function handleStatusChange(id: string, status: string) {
    setUpdatingId(id);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_update_withdrawal", {
      p_id: id,
      p_status: status,
      p_admin_note: null,
    });
    setUpdatingId(null);
    if (error) {
      alert(error.message);
      return;
    }
    void load();
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
      <h1 className="mt-1 font-display text-2xl text-indigo">Withdrawals</h1>

      {withdrawals.length === 0 && (
        <p className="mt-8 text-sm text-ink/60">No withdrawal requests yet.</p>
      )}

      <div className="mt-8 divide-y divide-line border-t border-line">
        {withdrawals.map((w) => (
          <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium">
                {w.profiles?.full_name} ({w.profiles?.vendor_id})
              </p>
              <p className="text-xs text-ink/50">
                GH₵{Number(w.amount).toFixed(2)} · {w.momo_network} {w.momo_number}
                {w.account_name ? ` · ${w.account_name}` : ""}
              </p>
              <p className="text-xs text-ink/50">
                {new Date(w.created_at).toLocaleString()}
              </p>
            </div>
            <select
              value={w.status}
              disabled={updatingId === w.id}
              onChange={(e) => handleStatusChange(w.id, e.target.value)}
              className="border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </main>
  );
      }
