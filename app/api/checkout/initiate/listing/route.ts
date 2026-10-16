import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiateMoolrePayment } from "@/lib/payments/moolre";

export const dynamic = "force-dynamic";

function cleanPhone(raw: string): string | null {
  let d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.startsWith("233") && d.length === 12) d = "0" + d.slice(3);
  return /^0[0-9]{9}$/.test(d) ? d : null;
}

export async function POST(request: Request) {
  try {
    const body: any = await request.json().catch(() => ({}));
    const listingId = String(body.listingId || "");
    const slug = String(body.slug || "").slice(0, 80);
    const customerName = String(body.customerName || "").trim().slice(0, 80);
    const details = String(body.details || "").trim().slice(0, 500);
    const phone = cleanPhone(body.customerPhone);

    if (!/^[0-9a-fA-F-]{36}$/.test(listingId)) {
      return NextResponse.json({ error: "Product not found." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit phone number, like 0241234567." },
        { status: 400 }
      );
    }

    const admin: any = createAdminClient();
    const { data: listing } = await admin
      .from("vendor_listings")
      .select("id, vendor_id, name, cost_price, customer_price, status, paused")
      .eq("id", listingId)
      .maybeSingle();

    if (!listing || listing.status !== "approved" || listing.paused) {
      return NextResponse.json({ error: "This product is no longer available." }, { status: 404 });
    }

    const amount = Number(listing.customer_price);
    if (!(amount > 0)) {
      return NextResponse.json({ error: "This product has no valid price." }, { status: 400 });
    }

    const { data: order, error: insErr } = await admin
      .from("listing_orders")
      .insert({
        listing_id: listing.id,
        vendor_id: listing.vendor_id,
        listing_name: listing.name,
        cost_price: listing.cost_price,
        amount,
        customer_name: customerName || null,
        customer_phone: phone,
        customer_details: details || null,
      })
      .select("id, order_number")
      .single();

    if (insErr || !order) {
      return NextResponse.json({ error: "Could not create the order. Try again." }, { status: 500 });
    }

    const orderNumber: string = order.order_number;
    const siteUrl = process.env.SITE_URL || new URL(request.url).origin;
    const placeholderEmail = `${orderNumber.toLowerCase()}@no-email.maynsalespoint.app`;

    try {
      const { authorizationUrl } = await initiateMoolrePayment({
        reference: orderNumber,
        email: placeholderEmail,
        amount: amount.toFixed(2),
        callback: `${siteUrl}/api/moolre/listing-webhook`,
        redirect: `${siteUrl}/s/${encodeURIComponent(slug)}?order=${orderNumber}`,
      });
      return NextResponse.json({ authorizationUrl, orderNumber });
    } catch (e: any) {
      await admin.from("listing_orders").delete().eq("id", order.id).eq("status", "pending_payment");
      return NextResponse.json(
        { error: e && e.message ? e.message : "Could not start the payment." },
        { status: 502 }
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}

// END OF FILE
