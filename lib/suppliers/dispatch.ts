import { createAdminClient } from "@/lib/supabase/admin";
import {
  justicePlaceOrder,
  justiceGetOrder,
  mapStatus,
  normalizePhone,
  parseSizeGb,
  networkOf,
  beneficiaryOf,
} from "@/lib/suppliers/justice";

const ORDER_FIELDS =
  "id, order_number, status, product_name, variant_name, custom_field_values, supplier_status, supplier_order_id";

export async function autoSendOn(admin: any): Promise<boolean> {
  const { data } = await admin.from("msp_settings").select("value").eq("key", "justice_auto_send").maybeSingle();
  return !!data && data.value === "on";
}

export function planFor(order: any) {
  const network = networkOf(order.product_name);
  const size = parseSizeGb(order.variant_name);
  const phone = normalizePhone(beneficiaryOf(order.custom_field_values));
  if (!network) return { ok: false, note: "Not an MTN data order." };
  if (!size) return { ok: false, note: "No GB size found in the option name." };
  if (!phone) return { ok: false, note: "Beneficiary number is missing or not a valid 10-digit number." };
  return { ok: true, network: network, size: size, phone: phone };
}

// Sends ONE paid order to Justice. Safe to call many times: an order is
// claimed first, so it can never be sent twice.
export async function dispatchOrder(orderId: string, opts?: { force?: boolean }) {
  const admin: any = createAdminClient();

  const { data: order } = await admin.from("orders").select(ORDER_FIELDS).eq("id", orderId).maybeSingle();
  if (!order) return { result: "skipped", note: "Order not found." };
  if (order.status !== "paid" || order.supplier_status) {
    return { result: "skipped", note: "Already handled." };
  }
  if (!(opts && opts.force) && !(await autoSendOn(admin))) {
    return { result: "skipped", note: "Auto-send is off." };
  }

  const plan: any = planFor(order);
  if (!plan.ok) return { result: "skipped", note: plan.note };

  // Claim the order. If someone else already did, stop.
  const { data: claimed } = await admin
    .from("orders")
    .update({ supplier_status: "sending" })
    .eq("id", order.id)
    .is("supplier_status", null)
    .select("id");
  if (!claimed || claimed.length === 0) return { result: "skipped", note: "Already being sent." };

  const site = String(process.env.SITE_URL || "").replace(/\/+$/, "");
  const callback = site ? site + "/api/justice/webhook" : undefined;

  const placed: any = await justicePlaceOrder({
    phone: plan.phone,
    size: plan.size,
    network: plan.network,
    callback: callback,
  });

  if (placed.outcome === "sent") {
    await admin
      .from("orders")
      .update({
        supplier_status: "sent",
        supplier_order_id: placed.id,
        supplier_message: placed.status,
        supplier_sent_at: new Date().toISOString(),
        status: "processed",
      })
      .eq("id", order.id);
    return { result: "sent", note: placed.status };
  }

  if (placed.outcome === "rejected") {
    await admin
      .from("orders")
      .update({ supplier_status: "failed", supplier_message: placed.message })
      .eq("id", order.id);
    return { result: "failed", note: placed.message };
  }

  // Unknown: we cannot tell if Justice received it. Never auto-retry.
  await admin
    .from("orders")
    .update({
      supplier_status: "review",
      supplier_message: placed.message + " Check Justice before sending again.",
    })
    .eq("id", order.id);
  return { result: "review", note: placed.message };
}

// Dispatch every paid MTN order that has not been sent yet.
export async function sweepPaid(limit: number) {
  const admin: any = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .is("supplier_status", null)
    .ilike("product_name", "%mtn%")
    .order("created_at", { ascending: true })
    .limit(limit);
  const out = { sent: 0, failed: 0, review: 0, skipped: 0 };
  for (const row of data || []) {
    const r: any = await dispatchOrder(row.id);
    if (r.result === "sent") out.sent++;
    else if (r.result === "failed") out.failed++;
    else if (r.result === "review") out.review++;
    else out.skipped++;
  }
  return out;
}

// Ask Justice for the latest status of one sent order and update ours.
export async function syncOne(order: any) {
  const admin: any = createAdminClient();
  if (!order || !order.supplier_order_id) return { ok: false, note: "No Justice id." };
  const got: any = await justiceGetOrder(order.supplier_order_id);
  if (!got.ok) return { ok: false, note: got.message };

  const mapped = mapStatus(got.status);
  if (mapped === "completed") {
    await admin
      .from("orders")
      .update({ supplier_status: "completed", supplier_message: got.status, status: "delivered" })
      .eq("id", order.id);
  } else if (mapped === "failed") {
    await admin
      .from("orders")
      .update({ supplier_status: "failed", supplier_message: got.status, status: "paid" })
      .eq("id", order.id);
  } else {
    await admin.from("orders").update({ supplier_message: got.status }).eq("id", order.id);
  }
  return { ok: true, note: got.status, mapped: mapped };
}

// END OF FILE
