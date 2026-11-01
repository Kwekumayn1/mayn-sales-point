import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncOne } from "@/lib/suppliers/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A signed-in vendor opens My Orders: refresh the supplier status of THEIR sent orders.
export async function POST() {
  const supabase: any = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u || !u.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const admin: any = createAdminClient();
  const { data: rows } = await admin
    .from("orders")
    .select("id, supplier_order_id, supplier_status")
    .eq("vendor_id", u.user.id)
    .eq("supplier_status", "sent")
    .not("supplier_order_id", "is", null)
    .order("supplier_sent_at", { ascending: false })
    .limit(30);

  const list: any[] = rows || [];
  let checked = 0;
  for (let i = 0; i < list.length; i += 5) {
    const chunk = list.slice(i, i + 5);
    await Promise.all(
      chunk.map(async (o) => {
        try {
          await syncOne(o);
          checked++;
        } catch (e) {
          // One failed check must not stop the others.
        }
      })
    );
  }
  return NextResponse.json({ ok: true, checked });
}

// END OF FILE
