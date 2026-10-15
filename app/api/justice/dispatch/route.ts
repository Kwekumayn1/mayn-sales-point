import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchOrder } from "@/lib/suppliers/dispatch";

export const maxDuration = 60;

// A signed-in vendor asks us to send ONE of their own paid orders to Justice.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const number = String(body.order_number || "").trim();
  if (!number) return NextResponse.json({ error: "Missing order number." }, { status: 400 });

  const admin: any = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, vendor_id")
    .eq("order_number", number)
    .maybeSingle();
  if (!order || order.vendor_id !== user.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const r: any = await dispatchOrder(order.id);
  console.log("justice dispatch (wallet)", number, r.result, r.note);
  return NextResponse.json(r);
}

// END OF FILE
