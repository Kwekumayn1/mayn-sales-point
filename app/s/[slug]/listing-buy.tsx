"use client";

import { useState } from "react";

type Props = {
  listingId: string;
  slug: string;
  price: number;
};

export default function ListingBuy({ listingId, slug, price }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setError("");
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 10) {
      setError("Enter your 10-digit phone number, like 0241234567.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, slug, customerName: name, customerPhone: phone, details }),
      });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || !j.authorizationUrl) {
        setError(j.error || "Could not start the payment. Try again.");
        setBusy(false);
        return;
      }
      window.location.href = j.authorizationUrl;
    } catch {
      setError("No connection. Check your network and try again.");
      setBusy(false);
    }
  }

  const box = "w-full rounded-xl border border-line bg-white p-3 text-base";
  return (
    <div className="flex flex-col gap-2">
      <input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Your name" className={box} maxLength={80} />
      <input
        value={phone}
        onChange={(e: any) => setPhone(e.target.value)}
        placeholder="Your phone number"
        inputMode="tel"
        className={box}
      />
      <textarea
        value={details}
        onChange={(e: any) => setDetails(e.target.value)}
        placeholder="Extra details for the seller (optional)"
        rows={2}
        className={box}
        maxLength={500}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={pay}
        disabled={busy}
        className="block rounded-pill bg-gold py-3 text-center text-base font-bold text-white shadow disabled:opacity-60"
      >
        {busy ? "Please wait..." : "Pay GH\u20B5 " + price.toFixed(2)}
      </button>
    </div>
  );
}

// END OF FILE
