import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncOne } from "@/lib/suppliers/dispatch";

export const maxDuration = 30;

// Justice calls this when an order changes. We never trust the body:
// we only read the order id from it, then ask Justice directly for the status.
export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const places = [body, body && body.data, body && body.payload, body && body.order];
  let id = "";
  for (const p of places) {
    if (p && typeof p === "object") {
      const v = p.id || p.orderId || p.order_id;
      if (v) {
        id = String(v);
        break;
      }
    }
  }
  console.log("justice webhook arrived, id:", id || "(none)", JSON.stringify(body).slice(0, 400));
  if (!id) return NextResponse.json({ error: "Missing order id." }, { status: 400 });

  const admin: any = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, supplier_status, supplier_order_id")
    .eq("supplier_order_id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const r: any = await syncOne(order);
  console.log("justice webhook sync", id, r.ok ? r.note : "failed: " + r.note);
  return NextResponse.json({ ok: !!r.ok });
}

// END OF FILE
