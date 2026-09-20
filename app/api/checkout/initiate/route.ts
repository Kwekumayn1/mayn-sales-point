import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initiateMoolrePayment } from "@/lib/payments/moolre";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      vendorId,
      productId,
      customerName,
      customerPhone,
      customerEmail,
      customFieldValues,
    } = body;

    if (!vendorId || !productId || !customerName || !customerPhone || !customerEmail) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const supabase = createClient();

    // Price is recalculated here, server-side, from vendor_prices — the
    // amount sent to Moolre is never taken from what the browser submitted.
    const { data, error } = await supabase.rpc("create_order", {
      p_vendor_id: vendorId,
      p_product_id: productId,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_customer_email: customerEmail,
      p_custom_field_values: customFieldValues || {},
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || !result.order_number) {
      return NextResponse.json(
        { error: "Order was not created correctly." },
        { status: 500 }
      );
    }

    const orderNumber: string = result.order_number;
    const amount: number = Number(result.unit_price);

    const siteUrl = process.env.SITE_URL || request.headers.get("origin") || "";

    try {
      const { authorizationUrl } = await initiateMoolrePayment({
        reference: orderNumber,
        email: customerEmail,
        amount: amount.toFixed(2),
        callback: `${siteUrl}/api/moolre/webhook`,
        redirect: `${siteUrl}/order-status?number=${orderNumber}`,
      });

      return NextResponse.json({ authorizationUrl, orderNumber });
    } catch (e: any) {
      // The order already exists as pending_payment — the customer can
      // retry, or an admin can follow up, but nothing is lost.
      return NextResponse.json(
        { error: e.message || "Could not start payment.", orderNumber },
        { status: 502 }
      );
    }
  } catch (err: any) {
    // Catch-all so a crash anywhere above always returns real JSON with
    // the actual reason, instead of a generic HTML error page.
    return NextResponse.json(
      { error: err?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}
