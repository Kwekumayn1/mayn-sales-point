"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AffiliatesPage() {
  const [loading, setLoading] = useState(true);
  const [myVendorCode, setMyVendorCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [subVendors, setSubVendors] = useState<any[]>([]);

  useEffect(() => {
    setOrigin(window.location.origin);
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

    const { data: subs } = await supabase
      .from("profiles")
      .select("id, full_name, vendor_id, role, created_at")
      .eq("parent_vendor_id", user.id)
      .order("created_at", { ascending: false });
    setSubVendors(subs ?? []);

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  const referralLink = `${origin}/signup?ref=${myVendorCode}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-ink/50">Dashboard</p>
      <h1 className="mt-1 font-display text-2xl text-indigo">My Affiliates</h1>
      <p className="mt-2 text-sm text-ink/60">
        Share your referral link — anyone who signs up through it joins as
        your sub-vendor. They can price Mayn Sales Point's products above
        your own price and earn their own profit, while you keep earning
        yours on every sale they make.
      </p>

      <div className="mt-6 border border-line bg-white p-5">
        <p className="text-xs text-ink/50">Your referral link</p>
        <p className="mt-1 break-all text-sm font-medium text-indigo">
          {referralLink}
        </p>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg text-indigo">
          My sub-vendors ({subVendors.length})
        </h2>
        {subVendors.length === 0 && (
          <p className="mt-3 text-sm text-ink/60">
            No one has joined through your link yet.
          </p>
        )}
        <div className="mt-4 divide-y divide-line border-t border-line">
          {subVendors.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{s.full_name ?? "Unnamed"}</p>
                <p className="text-xs text-ink/50">
                  {s.vendor_id} · joined {new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="text-xs capitalize text-ink/50">{s.role}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
      }
