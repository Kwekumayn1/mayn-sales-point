import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMoolrePayment } from "@/lib/payments/moolre";

export async function POST(request: Request) {
  try {
    const { orderNumber } = await request.json();
    if (!orderNumber) {
      return NextResponse.json({ error: "Missing orderNumber." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: order } = await admin
      .from("orders")
      .select("id, status, unit_price")
      .eq("order_number", orderNumber)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status !== "pending_payment") {
      return NextResponse.json({ status: order.status });
    }

    const verification = await verifyMoolrePayment(orderNumber);
    const isSuccessful = ["success", "successful", "1", "paid"].includes(verification.status);
    const amountMatches =
      verification.amount !== undefined &&
      Math.abs(Number(verification.amount) - Number(order.unit_price)) < 0.01;

    if (isSuccessful && amountMatches) {
      await admin.from("orders").update({ status: "paid" }).eq("id", order.id);
      return NextResponse.json({ status: "paid" });
    }

    return NextResponse.json({ status: order.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Verification failed." },
      { status: 500 }
    );
  }
}
