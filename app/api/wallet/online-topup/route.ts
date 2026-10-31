import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiateMoolrePayment } from "@/lib/payments/moolre";

export const dynamic = "force-dynamic";

async function loadSettings(admin: any) {
  const { data } = await admin
    .from("online_topup_settings")
    .select("fee_percent, moolre_percent, moolre_min, min_amount, max_amount")
    .eq("id", 1)
    .maybeSingle();
  return {
    fee: data ? Number(data.fee_percent) : 2,
    mPct: data && data.moolre_percent != null ? Number(data.moolre_percent) : 1,
    mMin: data && data.moolre_min != null ? Number(data.moolre_min) : 0.5,
    min: data ? Number(data.min_amount) : 5,
    max: data ? Number(data.max_amount) : 10000,
  };
}

// Service charge = Moolre's own charge (a percentage, never below its minimum) plus our extra percentage.
function chargeFor(amount: number, s: any): number {
  const moolre = Math.max((amount * s.mPct) / 100, s.mMin);
  const extra = (amount * s.fee) / 100;
  return Math.round((moolre + extra) * 100) / 100;
}

// The page asks for the fee and limits so it can show the price before paying.
export async function GET() {
  const admin: any = createAdminClient();
  const s = await loadSettings(admin);
  return NextResponse.json({ fee_percent: s.fee, moolre_percent: s.mPct, moolre_min: s.mMin, min: s.min, max: s.max });
}

export async function POST(request: Request) {
  try {
    const supabase: any = createClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u || !u.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const admin: any = createAdminClient();

    const body: any = await request.json().catch(() => ({}));
    const text = String(body.amount == null ? "" : body.amount).trim();
    if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(text)) {
      return NextResponse.json({ error: "Enter an amount like 50 or 50.25." }, { status: 400 });
    }
    const amount = Math.round(Number(text) * 100) / 100;
    const s = await loadSettings(admin);
    if (amount < s.min || amount > s.max) {
      return NextResponse.json({ error: "Amount must be between GHS " + s.min + " and GHS " + s.max + "." }, { status: 400 });
    }
    const fee = chargeFor(amount, s);
    const total = Math.round((amount + fee) * 100) / 100;

    let row: any = null;
    for (let i = 0; i < 5 && !row; i++) {
      const reference = "MSP-W-" + String(Math.floor(100000 + Math.random() * 900000));
      const ins = await admin
        .from("online_topups")
        .insert({ vendor_id: u.user.id, reference, amount, fee, total })
        .select("id, reference")
        .single();
      if (!ins.error && ins.data) row = ins.data;
    }
    if (!row) return NextResponse.json({ error: "Could not start the top-up. Try again." }, { status: 500 });

    const siteUrl = process.env.SITE_URL || new URL(request.url).origin;
    try {
      const { authorizationUrl } = await initiateMoolrePayment({
        reference: row.reference,
        email: u.user.email || row.reference.toLowerCase() + "@no-email.maynsalespoint.app",
        amount: total.toFixed(2),
        callback: siteUrl + "/api/moolre/wallet-webhook",
        redirect: siteUrl + "/dashboard/wallet?topup=" + row.reference,
      });
      return NextResponse.json({ authorizationUrl, reference: row.reference, amount, fee, total });
    } catch (e: any) {
      await admin.from("online_topups").delete().eq("id", row.id).eq("status", "pending_payment");
      return NextResponse.json({ error: e && e.message ? e.message : "Could not start the payment." }, { status: 502 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}

// END OF FILE
