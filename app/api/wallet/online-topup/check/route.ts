import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmWalletTopup } from "@/lib/payments/wallet-pay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The vendor (or the page after Moolre returns) asks us to re-check one top-up.
export async function POST(request: Request) {
  const supabase: any = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u || !u.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body: any = await request.json().catch(() => ({}));
  const reference = String(body.reference || "");
  if (!/^MSP-W-[0-9]{6}$/.test(reference)) return NextResponse.json({ error: "Unknown top-up." }, { status: 400 });

  const admin: any = createAdminClient();
  const { data: row } = await admin
    .from("online_topups")
    .select("id, reference, vendor_id, total, status")
    .eq("reference", reference)
    .maybeSingle();
  if (!row || row.vendor_id !== u.user.id) return NextResponse.json({ error: "Unknown top-up." }, { status: 404 });
  if (row.status === "credited") return NextResponse.json({ status: "credited" });

  const r = await confirmWalletTopup(admin, row);
  if (r.code === "paid_ok" || r.code === "already_done") return NextResponse.json({ status: "credited" });
  if (r.code === "paid_mismatch") return NextResponse.json({ status: "mismatch" });
  return NextResponse.json({ status: "pending" });
}

// END OF FILE
