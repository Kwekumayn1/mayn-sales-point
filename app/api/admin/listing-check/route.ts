import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmListingOrder } from "@/lib/payments/listing-pay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin button: re-checks vendor-product orders still waiting for payment.
export async function POST() {
  const supabase: any = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u || !u.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const admin: any = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (!me || (me.role !== "admin" && me.role !== "super_admin")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await admin
    .from("listing_orders")
    .select("id, order_number, amount, status")
    .eq("status", "pending_payment")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);

  let confirmed = 0;
  for (const o of rows || []) {
    const r = await confirmListingOrder(admin, o);
    if (r.changed) confirmed++;
  }
  return NextResponse.json({ checked: (rows || []).length, confirmed });
}

// END OF FILE
