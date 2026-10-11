"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ManualCredit() {
  const [vendorCode, setVendorCode] = useState("");
  const [foundVendor, setFoundVendor] = useState<any>(null);
  const [searchError, setSearchError] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditWallet, setCreditWallet] = useState("purchase");
  const [creditReason, setCreditReason] = useState("");
  const [creditSubmitting, setCreditSubmitting] = useState(false);
  const [creditMessage, setCreditMessage] = useState("");

  async function findVendor(e: any) {
    e.preventDefault();
    setSearchError("");
    setFoundVendor(null);
    const supabase: any = createClient();
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

  async function credit(e: any) {
    e.preventDefault();
    setCreditMessage("");
    setSearchError("");
    if (!foundVendor) return;
    const amount = Number(creditAmount);
    if (Number.isNaN(amount) || amount === 0) {
      setSearchError("Enter a valid, non-zero amount.");
      return;
    }
    setCreditSubmitting(true);
    const supabase: any = createClient();
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

  const box = "mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo";

  return (
    <div className="mt-10 border border-line bg-white p-6">
      <h2 className="font-display text-lg text-indigo">Manual wallet credit</h2>
      <p className="mt-2 text-sm text-ink/60">For adjustments outside the normal top-up flow.</p>

      <form onSubmit={findVendor} className="mt-4 flex gap-3">
        <input
          value={vendorCode}
          onChange={(e: any) => setVendorCode(e.target.value)}
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
        <form onSubmit={credit} className="mt-4 space-y-4 border-t border-line pt-4">
          <p className="text-sm">
            Vendor: <span className="font-medium">{foundVendor.full_name}</span> ({foundVendor.vendor_id})
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Amount (GHS, negative to debit)</label>
              <input
                required
                inputMode="decimal"
                value={creditAmount}
                onChange={(e: any) => setCreditAmount(e.target.value)}
                className={box}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Wallet</label>
              <select
                value={creditWallet}
                onChange={(e: any) => setCreditWallet(e.target.value)}
                className={box}
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
              onChange={(e: any) => setCreditReason(e.target.value)}
              className={box}
            />
          </div>
          {creditMessage && <p className="text-sm text-leaf">{creditMessage}</p>}
          <button
            type="submit"
            disabled={creditSubmitting}
            className="rounded-pill bg-indigo px-6 py-2 text-sm font-medium text-white hover:bg-indigo-light disabled:opacity-60"
          >
            {creditSubmitting ? "Saving..." : "Apply"}
          </button>
        </form>
      )}
    </div>
  );
}

// END OF FILE
