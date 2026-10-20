"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SmsBox from "./sms-box";
import ManualCredit from "./manual-credit";

export default function AdminWalletsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load();
    }, 20000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // "profiles!vendor_id" names exactly which link to use (the vendor who asked).
    const first = await supabase
      .from("topup_requests")
      .select("id, vendor_id, amount, momo_reference, status, created_at, profiles!vendor_id(full_name, vendor_id)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!first.error) {
      setLoadError("");
      setPending(first.data ?? []);
      setLoading(false);
      return;
    }

    // Fallback: load the requests without names, so they are never hidden.
    const second = await supabase
      .from("topup_requests")
      .select("id, vendor_id, amount, momo_reference, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (second.error) {
      setLoadError(second.error.message);
    } else {
      setLoadError("");
      setPending(second.data ?? []);
    }
    setLoading(false);
  }

  async function handleConfirm(id: string) {
    setProcessingId(id);
    const supabase: any = createClient();
    const { error } = await supabase.rpc("confirm_topup", { p_request_id: id });
    setProcessingId("");
    if (error) {
      alert(error.message);
      return;
    }
    void load();
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    const supabase: any = createClient();
    const { error } = await supabase.rpc("reject_topup", {
      p_request_id: id,
      p_note: "Rejected by admin",
    });
    setProcessingId("");
    if (error) {
      alert(error.message);
      return;
    }
    void load();
  }

  if (loading) {
    return <main className="mx-auto max-w-4xl px-6 py-16 text-sm text-ink/60">Loading...</main>;
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

      <SmsBox pending={pending} onDone={load} />

      <div className="mt-10">
        <h2 className="font-display text-lg text-indigo">Pending requests ({pending.length})</h2>
