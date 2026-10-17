"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  listingId: string;
  slug: string;
  price: number;
};

type Field = { label: string; required: boolean };

export default function ListingBuy({ listingId, slug, price }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase: any = createClient();
    (async () => {
      const { data } = await supabase
        .from("vendor_listings_public")
        .select("custom_fields")
        .eq("id", listingId)
        .maybeSingle();
      const raw: any[] = data && Array.isArray(data.custom_fields) ? data.custom_fields : [];
      setFields(
        raw
          .filter((f: any) => f && typeof f.label === "string" && f.label.trim())
          .map((f: any) => ({ label: String(f.label), required: !!f.required }))
      );
    })();
  }, [listingId]);

  async function pay() {
    setError("");
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 10) {
      setError("Enter your 10-digit phone number, like 0241234567.");
      return;
    }
    for (const f of fields) {
      if (f.required && !(answers[f.label] || "").trim()) {
        setError("Please fill in: " + f.label);
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          slug,
          customerName: name,
          customerPhone: phone,
          details,
          customValues: answers,
        }),
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
      {fields.map((f) => (
        <input
          key={f.label}
          value={answers[f.label] || ""}
          onChange={(e: any) => setAnswers({ ...answers, [f.label]: e.target.value })}
          placeholder={f.label + (f.required ? " (required)" : " (optional)")}
          className={box}
          maxLength={200}
        />
      ))}
      <textarea
        value={details}
        onChange={(e: any) => setDetails(e.target.value)}
        placeholder="Anything else for the seller (optional)"
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
