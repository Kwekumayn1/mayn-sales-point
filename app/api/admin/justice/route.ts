import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { justiceBalance } from "@/lib/suppliers/justice";
import { dispatchOrder, sweepPaid, syncOne } from "@/lib/suppliers/dispatch";

export const maxDuration = 60;

const FIELDS =
  "id, order_number, status, product_name, variant_name, customer_name, custom_field_values, supplier_status, supplier_order_id, supplier_message, supplier_sent_at, created_at";

async function isAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return !!data && (data.role === "admin" || data.role === "super_admin");
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
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
    const a = await admin
      .from("orders")
      .select(FIELDS)
      .not("supplier_status", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);
    const b = await admin
      .from("orders")
      .select(FIELDS)
      .eq("status", "paid")
      .is("supplier_status", null)
      .ilike("product_name", "%mtn%")
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = [...(b.data || []), ...(a.data || [])];
    return NextResponse.json({ rows: rows });
  }

  if (action === "balance") {
    const r: any = await justiceBalance();
    return NextResponse.json(r);
  }

  if (action === "setting_get") {
    const { data } = await admin.from("msp_settings").select("value").eq("key", "justice_auto_send").maybeSingle();
    return NextResponse.json({ on: !!data && data.value === "on" });
  }

  if (action === "setting_set") {
    const value = body.on ? "on" : "off";
    const { error } = await admin
      .from("msp_settings")
      .upsert({ key: "justice_auto_send", value: value }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ on: value === "on" });
  }

  if (action === "sweep") {
    const r = await sweepPaid(10);
    return NextResponse.json(r);
  }

  if (action === "send_one") {
    const id = String(body.id || "");
    const r: any = await dispatchOrder(id, { force: true });
    return NextResponse.json(r);
  }

  if (action === "retry") {
    const id = String(body.id || "");
    // Only orders Justice clearly refused (failed) can be retried here.
    const { data: upd } = await admin
      .from("orders")
      .update({ supplier_status: null, supplier_message: null, status: "paid" })
      .eq("id", id)
      .eq("supplier_status", "failed")
      .select("id");
    if (!upd || upd.length === 0) {
      return NextResponse.json({ error: "Only failed orders can be retried." }, { status: 400 });
    }
    const r: any = await dispatchOrder(id, { force: true });
    return NextResponse.json(r);
  }

  if (action === "refresh") {
    if (body.id) {
      const { data: o } = await admin.from("orders").select(FIELDS).eq("id", String(body.id)).maybeSingle();
      const r: any = await syncOne(o);
      return NextResponse.json(r);
    }
    const { data: list } = await admin
      .from("orders")
      .select(FIELDS)
      .eq("supplier_status", "sent")
      .order("created_at", { ascending: true })
      .limit(25);
    let done = 0;
    for (const o of list || []) {
      const r: any = await syncOne(o);
      if (r.ok) done++;
    }
    return NextResponse.json({ checked: (list || []).length, updated: done });
  }

  // Manual decisions for orders stuck in "review" or "failed".
  if (action === "mark_delivered") {
    const id = String(body.id || "");
    const { error } = await admin
      .from("orders")
      .update({ supplier_status: "completed", status: "delivered", supplier_message: "Marked delivered by admin" })
      .eq("id", id)
      .in("supplier_status", ["review", "failed"]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_not_sent") {
    const id = String(body.id || "");
    const { error } = await admin
      .from("orders")
      .update({ supplier_status: "failed", status: "paid", supplier_message: "Admin confirmed it was NOT sent" })
      .eq("id", id)
      .eq("supplier_status", "review");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

// END OF FILE
