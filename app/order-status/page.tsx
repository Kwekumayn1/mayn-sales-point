"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  processing: "Processing",
  awaiting_fulfillment: "Awaiting fulfillment",
  completed: "Completed",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

// Statuses that mean the customer's payment went through.
const PAID_STATUSES = ["paid", "processing", "awaiting_fulfillment", "completed", "delivered"];

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

// Extra details (e.g. phone number) if the order lookup provides them.
// Accepts an object like { Number: "024..." } or a plain text value.
function extraLines(order: any): { label: string; value: string }[] {
  const d = order?.receipt_details;
  if (!d) return [];
  if (typeof d === "string") return [{ label: "Details", value: d }];
  if (Array.isArray(d)) {
    return d
      .filter((x: any) => x && x.value !== undefined && x.value !== null && x.value !== "")
      .map((x: any) => ({ label: String(x.label ?? "Detail"), value: String(x.value) }));
  }
  if (typeof d === "object") {
    return Object.entries(d)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => ({ label: k, value: String(v) }));
  }
  return [];
}

function buildReceiptText(order: any): string {
  const lines: string[] = [];
  lines.push("PAYMENT SUCCESSFUL");
  lines.push("Mayn Sales Point");
  lines.push("");
  lines.push("Receipt No: " + order.order_number);
  lines.push("Product: " + order.product_name);
  lines.push("Amount: GH₵" + Number(order.unit_price).toFixed(2));
  const when = formatTime(order.created_at);
  if (when) lines.push("Date & time: " + when);
  extraLines(order).forEach((x) => lines.push(x.label + ": " + x.value));
  lines.push("Status: " + (STATUS_LABELS[order.status] ?? order.status));
  lines.push("");
  lines.push("Thank you for your purchase!");
  return lines.join("\n");
}

export default function OrderStatusPage() {
  const [loading, setLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const number = params.get("number") ?? "";
    setOrderNumber(number);
    if (number) {
      void lookup(number);
    } else {
      setLoading(false);
    }
  }, []);

  async function lookup(number: string) {
    setLoading(true);
    setError(null);
    setCopied(false);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("order_status_lookup")
      .select("*")
      .eq("order_number", number.trim())
      .single();

    if (error || !data) {
      setLoading(false);
      setError("No order found with that reference.");
      setOrder(null);
      return;
    }

    if (data.status === "pending_payment") {
      // Don't just trust what's stored — ask the server to re-check
      // directly with Moolre in case the webhook hasn't landed yet.
      try {
        const res = await fetch("/api/orders/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNumber: number.trim() }),
        });
        const result = await res.json();
        if (result?.status && result.status !== data.status) {
          data.status = result.status;
        }
      } catch {
        // If this check fails, just show what we already had.
      }
    }

    if (PAID_STATUSES.includes(data.status)) {
      try {
        const rd = await supabase.rpc("get_receipt_details", {
          p_order_number: number.trim(),
        });
        if (!rd.error && rd.data) {
          data.receipt_details = rd.data;
        }
      } catch {
        // Receipt still works without the extra details.
      }
    }

    setLoading(false);
    setOrder(data);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void lookup(orderNumber);
  }

  async function copyReceipt() {
    if (!order) return;
    const text = buildReceiptText(order);
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2500);
  }

  const isPaid = !!order && PAID_STATUSES.includes(order.status);
  const extras = order ? extraLines(order) : [];

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="font-display text-2xl text-indigo">Order status</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-3">
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="MSP-ORD-001000"
          className="flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-indigo"
        />
        <button
          type="submit"
          className="rounded-pill bg-indigo px-5 py-2 text-sm font-medium text-white hover:bg-indigo-light"
        >
          Check
        </button>
      </form>

      {loading && <p className="mt-6 text-sm text-ink/60">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {order && isPaid && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="bg-gold px-6 py-5 text-white">
            <div className="text-3xl leading-none">✓</div>
            <p className="mt-2 text-lg font-bold">Payment successful</p>
            <p className="text-sm text-white/90">Thank you for your purchase!</p>
          </div>

          <div className="space-y-4 p-6">
            <div>
              <p className="text-xs text-ink/50">Receipt number</p>
              <p className="mt-0.5 font-mono text-base font-semibold">{order.order_number}</p>
            </div>
            <div>
              <p className="text-xs text-ink/50">Product</p>
              <p className="mt-0.5 font-medium">{order.product_name}</p>
            </div>
            <div>
              <p className="text-xs text-ink/50">Amount paid</p>
              <p className="mt-0.5 font-medium">GH₵{Number(order.unit_price).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-ink/50">Date and time</p>
              <p className="mt-0.5 font-medium">{formatTime(order.created_at)}</p>
            </div>
            {extras.map((x) => (
              <div key={x.label}>
                <p className="text-xs text-ink/50">{x.label}</p>
                <p className="mt-0.5 font-medium">{x.value}</p>
              </div>
            ))}
            <div>
              <p className="text-xs text-ink/50">Status</p>
              <p className="mt-0.5 font-display text-lg text-indigo">
                {STATUS_LABELS[order.status] ?? order.status}
              </p>
            </div>
          </div>

          <div className="border-t border-line bg-paper p-4">
            <pre className="whitespace-pre-wrap rounded-xl border border-line bg-white p-3 text-xs leading-relaxed text-ink/80">
              {buildReceiptText(order)}
            </pre>
            <button
              onClick={copyReceipt}
              className="mt-3 w-full rounded-pill bg-indigo py-3 text-sm font-bold text-white"
            >
              {copied ? "Copied ✓" : "Copy receipt"}
            </button>
          </div>
        </div>
      )}

      {order && !isPaid && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6">
          <p className="text-xs text-ink/50">Product</p>
          <p className="mt-1 font-medium">{order.product_name}</p>

          <p className="mt-4 text-xs text-ink/50">Status</p>
          <p className="mt-1 font-display text-lg text-indigo">
            {STATUS_LABELS[order.status] ?? order.status}
          </p>

          <p className="mt-4 text-xs text-ink/50">Amount</p>
          <p className="mt-1 font-medium">GH₵{Number(order.unit_price).toFixed(2)}</p>

          {order.status === "pending_payment" && (
            <p className="mt-4 text-sm text-ink/60">
              We have not received your payment yet. If you already paid, wait a moment
              and tap Check again.
            </p>
          )}
        </div>
      )}
    </main>
  );
  }
