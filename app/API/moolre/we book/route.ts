import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMoolrePayment } from "@/lib/payments/moolre";

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

  const reference =
    payload.reference || payload.externalref || payload.externalRef || payload.id;

  if (!reference) {
    return NextResponse.json({ error: "Missing reference." }, { status: 400 });
  }

  // Never trust the webhook body alone — re-verify directly with Moolre
  // using our own credentials before changing anything.
  const verification = await verifyMoolrePayment(reference);

  const isSuccessful = ["success", "successful", "1", "paid"].includes(verification.status);

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, status, unit_price, order_number")
    .eq("order_number", reference)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  // Idempotent: once an order has moved past pending_payment, further
  // webhook calls (Moolre may retry) do nothing further.
  if (order.status !== "pending_payment") {
    return NextResponse.json({ ok: true, note: "Already processed." });
  }

  const amountMatches =
    verification.amount !== undefined &&
    Math.abs(Number(verification.amount) - Number(order.unit_price)) < 0.01;

  if (isSuccessful && amountMatches) {
    // Updating status here triggers the existing profit-crediting trigger
    // automatically — no extra wallet logic needed in this route.
    await admin.from("orders").update({ status: "paid" }).eq("id", order.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, note: "Payment not confirmed successful." });
}
