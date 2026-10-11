import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupMoolre, judge } from "@/lib/payments/moolre-lookup";

const FIELDS =
  "id, order_number, status, unit_price, product_name, variant_name, customer_name, created_at, custom_field_values";

async function isAdmin() {
  const supabase: any = createClient();
  const { data } = await supabase.auth.getUser();
  const user = data ? data.user : null;
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile ? profile.role : "";
  return role === "admin" || role === "super_admin";
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const action = String(body.action || "");
  const admin: any = createAdminClient();

  if (action === "list") {
    const days = Number(body.days) > 0 ? Number(body.days) : 3;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await admin
      .from("orders")
      .select(FIELDS)
      .eq("status", "pending_payment")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ orders: data || [] });
  }

  const orderNumber = String(body.orderNumber || "").trim();
  if (!orderNumber) {
    return NextResponse.json({ error: "Type an order number." }, { status: 400 });
  }

  const { data: order } = await admin.from("orders").select(FIELDS).eq("order_number", orderNumber).maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "No order found with that number." }, { status: 404 });
  }

  const look: any = await lookupMoolre(orderNumber);
  const verdict = judge(look, order.unit_price);

  if (action === "check") {
    return NextResponse.json({ order, look, verdict });
  }

  if (action === "confirm") {
    if (order.status !== "pending_payment") {
      return NextResponse.json({ error: "This order is already " + order.status + "." }, { status: 400 });
    }
    const allowed = verdict.code === "paid_ok" || (verdict.code === "paid_mismatch" && body.force === true);
    if (!allowed) {
      return NextResponse.json({ error: "Moolre does not confirm this payment: " + verdict.text }, { status: 400 });
    }
    // Same change the webhook makes. The existing trigger credits profits.
    const { data: updated, error } = await admin
      .from("orders")
      .update({ status: "paid" })
      .eq("id", order.id)
      .eq("status", "pending_payment")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "The order changed while checking. Refresh and try again." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, order_number: orderNumber });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

// END OF FILE
