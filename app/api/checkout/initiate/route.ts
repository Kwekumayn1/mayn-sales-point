import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initiateMoolrePayment } from "@/lib/payments/moolre";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vendorId, productId, customFieldValues } = body;

    if (!vendorId || !productId) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const supabase = createClient();

    // Price is recalculated here, server-side, from vendor_prices — the
    // amount sent to Moolre is never taken from what the browser submitted.
    const { data, error } = await supabase.rpc("create_order", {
      p_vendor_id: vendorId,
      p_product_id: productId,
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

    // Moolre's API requires an email even though we no longer collect one
    // from the customer by default — this placeholder is only used
    // internally for the payment request, never shown to anyone.
    const placeholderEmail = `${orderNumber.toLowerCase()}@no-email.maynsalespoint.app`;

    try {
      const { authorizationUrl } = await initiateMoolrePayment({
        reference: orderNumber,
        email: placeholderEmail,
        amount: amount.toFixed(2),
        callback: `${siteUrl}/api/moolre/webhook`,
        redirect: `${siteUrl}/order-status?number=${orderNumber}`,
      });

      return NextResponse.json({ authorizationUrl, orderNumber });
    } catch (e: any) {
      return NextResponse.json(
        { error: e.message || "Could not start payment.", orderNumber },
        { status: 502 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}
