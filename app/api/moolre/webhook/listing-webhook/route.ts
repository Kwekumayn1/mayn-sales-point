import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmListingOrder } from "@/lib/payments/listing-pay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function pickReference(p: any): string {
  const places = [p, p && p.data, p && p.payload, p && p.transaction];
  const keys = ["externalref", "externalRef", "external_ref", "reference", "ref", "id"];
  for (const o of places) {
    if (!o || typeof o !== "object") continue;
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.startsWith("MSP-L-")) return v;
    }
  }
  return "";
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const reference = pickReference(payload);
  console.log("listing-webhook", reference || "(no reference)");
  if (!reference) return NextResponse.json({ ok: true, note: "no listing reference" });

  const admin: any = createAdminClient();
  const { data: order } = await admin
    .from("listing_orders")
    .select("id, order_number, amount, status")
    .eq("order_number", reference)
    .maybeSingle();

  if (!order) return NextResponse.json({ ok: true, note: "order not found" });
  if (order.status !== "pending_payment") return NextResponse.json({ ok: true, note: "already handled" });

  let last = "error";
  for (let i = 0; i < 3; i++) {
    const r = await confirmListingOrder(admin, order);
    last = r.code;
    if (r.code === "paid_ok" || r.code === "already_done") {
      return NextResponse.json({ ok: true, note: "paid" });
    }
    if (r.code === "paid_mismatch") return NextResponse.json({ ok: true, note: "amount mismatch" });
    if (i < 2) await wait(2000);
  }
  console.log("listing-webhook not confirmed:", reference, last);
  return NextResponse.json({ ok: false, note: "not confirmed" }, { status: 503 });
}

// END OF FILE
