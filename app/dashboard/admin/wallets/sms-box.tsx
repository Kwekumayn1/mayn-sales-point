"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function pickAmount(text: string) {
  const start = text.search(/receiv/i);
  const part = start >= 0 ? text.slice(start) : text;
  const m = part.match(/GH\S{0,2}\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (!m) return "";
  return m[1].replace(/,/g, "");
}

function pickTxn(text: string) {
  const m = text.match(
    /(?:financial\s*transaction\s*id|transaction\s*id|trans\.?\s*id|txn\s*id)\s*[:\-]?\s*([A-Za-z0-9]{6,})/i
  );
  if (m) return m[1];
  const m2 = text.match(/\bid\s*[:\-]\s*([A-Za-z0-9]{6,})/i);
  return m2 ? m2[1] : "";
}

function pickSender(text: string) {
  const m = text.match(/from\s+(.+?)(?:\.|,|\s+current|\s+available|\s+balance|\s+reference|$)/i);
  return m ? m[1].trim() : "";
}

function pickBalance(text: string) {
  const m = text.match(/current\s*balance\s*[:\-]?\s*GH\S{0,2}\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  return m ? m[1] : "";
}

function squash(text: string) {
  return String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function SmsBox(props: { pending: any[]; onDone: () => void }) {
  const [sms, setSms] = useState("");
  const [read, setRead] = useState(false);
  const [amount, setAmount] = useState("");
  const [txn, setTxn] = useState("");
  const [sender, setSender] = useState("");
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  function readSms() {
    setError("");
    setDone("");
    setAmount(pickAmount(sms));
    setTxn(pickTxn(sms));
    setSender(pickSender(sms));
    setBalance(pickBalance(sms));
    setRead(true);
  }

  function clearAll() {
    setSms("");
    setRead(false);
    setAmount("");
    setTxn("");
    setSender("");
    setBalance("");
    setError("");
  }

  const smsKey = squash(sms);
  const hits = props.pending.filter((r: any) => {
    const key = squash(r.momo_reference);
    return key.length >= 4 && smsKey.indexOf(key) >= 0;
  });
  const exact = hits.filter((r: any) => Number(r.amount) === Number(amount));
  const looksReceived = /receiv/i.test(sms);

  async function credit(r: any) {
    setError("");
    const supabase: any = createClient();
    setBusy(true);
    const { error: err } = await supabase.rpc("admin_credit_topup_sms", {
      p_request_id: r.id,
      p_txn_id: txn.trim(),
      p_amount: Number(amount),
      p_sms: sms,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const who = r.profiles ? r.profiles.full_name : "vendor";
    setDone("Credited GHS " + Number(amount).toFixed(2) + " to " + who + ".");
    clearAll();
    props.onDone();
  }

  const box = "mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo";

  return (
    <div className="mt-8 border border-line bg-white p-6">
      <h2 className="font-display text-lg text-indigo">Paste MoMo SMS</h2>
      <p className="mt-2 text-sm text-ink/60">
        Paste the full payment SMS from MTN. We read the amount, transaction ID and reference,
        match it to a pending request, and credit the vendor after you confirm.
      </p>
      <textarea
        value={sms}
        onChange={(e: any) => {
          setSms(e.target.value);
          setRead(false);
          setDone("");
        }}
        rows={4}
        placeholder="Paste the MoMo SMS here"
        className="mt-3 w-full border border-line px-3 py-2 text-sm outline-none focus:border-indigo"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={readSms}
          disabled={sms.trim().length === 0}
          className="rounded-pill bg-indigo px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Read SMS
        </button>
        <button onClick={clearAll} className="rounded-pill border border-line px-5 py-2 text-sm">
          Clear
        </button>
      </div>
      {done && <p className="mt-3 text-sm font-medium text-leaf">{done}</p>}

      {read && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          {!looksReceived && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              This does not look like a payment-received SMS. Check it before crediting.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Amount read (GHS)</label>
              <input value={amount} onChange={(e: any) => setAmount(e.target.value)} className={box} />
            </div>
            <div>
              <label className="text-sm font-medium">Transaction ID read</label>
              <input value={txn} onChange={(e: any) => setTxn(e.target.value)} className={box} />
            </div>
          </div>
          <p className="text-xs text-ink/50">
            Sender: {sender || "not found"} {" | "} Balance after: {balance || "not found"}
          </p>

          {hits.length === 0 && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              No pending request has a reference found in this SMS. The vendor may have typed a wrong
              reference. You can still use the Confirm button on the matching request below.
            </p>
          )}
          {hits.length > 0 && exact.length === 0 && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              A request with this reference exists, but its amount is different from the amount in the
              SMS. Do not credit. Reject it or ask the vendor.
            </p>
          )}
          {exact.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-leaf bg-green-50 p-4 text-sm">
              <p className="font-medium">
                Match: {r.profiles ? r.profiles.full_name : ""} ({r.profiles ? r.profiles.vendor_id : ""})
              </p>
              <p className="text-xs text-ink/60">
                Request GHS {Number(r.amount).toFixed(2)} {" | "} reference {r.momo_reference}
              </p>
              <button
                onClick={() => credit(r)}
                disabled={busy || txn.trim().length < 6}
                className="mt-3 rounded-pill bg-leaf px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Crediting..." : "Confirm and credit GHS " + Number(r.amount).toFixed(2)}
              </button>
              {txn.trim().length < 6 && (
                <p className="mt-2 text-xs text-red-600">Type the transaction ID above first.</p>
              )}
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

// END OF FILE
