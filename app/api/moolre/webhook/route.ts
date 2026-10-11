import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupMoolre, judge } from "@/lib/payments/moolre-lookup";

export const maxDuration = 30;

function pickReference(p: any): string {
  const places = [p, p && p.data, p && p.payload, p && p.transaction];
  const keys = ["externalref", "externalRef", "external_ref", "reference", "ref", "id"];
  for (const place of places) {
    if (!place || typeof place !== "object") continue;
    for (const k of keys) {
      const v = place[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return String(v).trim();
      }
    }
  }
  return "";
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: Request) {
  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    try {
      const form = await request.formData();
      payload = Object.fromEntries(form.entries());
    } catch {
      payload = {};
    }
  }

  const reference = pickReference(payload);
  console.log("moolre webhook arrived, reference:", reference || "(none)", JSON.stringify(payload).slice(0, 500));

  if (!reference) {
    return NextResponse.json({ error: "Missing reference." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, status, unit_price, order_number")
    .eq("order_number", reference)
    .maybeSingle();

  if (!order) {
    console.log("moolre webhook: order not found for", reference);
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  // Once an order has moved past pending_payment, repeat calls do nothing.
  if (order.status !== "pending_payment") {
    return NextResponse.json({ ok: true, note: "Already processed." });
  }

  // Never trust the webhook body alone. Ask Moolre directly, and try a few
  // times because the status can lag a moment behind the webhook.
  let verdict: any = { code: "error", text: "No check done." };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const look = await lookupMoolre(reference);
    verdict = judge(look, order.unit_price);
    console.log("moolre webhook check", attempt, reference, verdict.code);
    if (verdict.code === "paid_ok" || verdict.code === "paid_mismatch") break;
    if (attempt < 3) await wait(2000);
  }

  if (verdict.code === "paid_ok") {
    // This update fires the existing profit-crediting trigger.
    const { error: upErr } = await admin
      .from("orders")
      .update({ status: "paid" })
      .eq("id", order.id)
      .eq("status", "pending_payment");
    if (upErr) {
      console.log("moolre webhook update failed", reference, upErr.message);
      return NextResponse.json({ error: "Could not update order." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (verdict.code === "paid_mismatch") {
    // Paid but the amount differs: leave it for an admin to review.
    return NextResponse.json({ ok: true, note: "Amount mismatch. Needs admin review." });
  }

  // Could not confirm. Ask Moolre to try again later.
  return NextResponse.json({ ok: false, note: verdict.text }, { status: 503 });
}

// END OF FILE
