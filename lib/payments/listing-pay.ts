// Confirms a vendor-product order with Moolre and marks it as paid.
// Used by the listing webhook and by the admin "Check listing payments" button.
import { lookupMoolre, judge } from "@/lib/payments/moolre-lookup";

export type ListingCheck = { code: string; changed: boolean };

export async function confirmListingOrder(admin: any, order: any): Promise<ListingCheck> {
  if (!order || order.status !== "pending_payment") return { code: "already_done", changed: false };

  const look: any = await lookupMoolre(order.order_number);
  const verdict: any = judge(look, order.amount);
  const code: string = typeof verdict === "string" ? verdict : (verdict && verdict.code) || "error";

  if (code !== "paid_ok") return { code, changed: false };

  const payer = look && look.payer ? String(look.payer) : null;
  const { data, error } = await admin
    .from("listing_orders")
    .update({
      status: "awaiting_vendor",
      paid_at: new Date().toISOString(),
      payer_number: payer,
    })
    .eq("id", order.id)
    .eq("status", "pending_payment")
    .select("id");

  if (error) return { code: "error", changed: false };
  return { code: "paid_ok", changed: !!(data && data.length) };
}

// END OF FILE
