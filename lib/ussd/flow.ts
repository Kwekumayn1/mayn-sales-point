import { initiateMoolrePayment } from "@/lib/payments/moolre";
import {
  requestMoolrePrompt,
  channelForNumber,
} from "@/lib/payments/moolre-prompt";
import type { Item, Step } from "@/lib/ussd/core";
import {
  MAX_ORDERS_PER_HOUR,
  localPhone,
  siteShort,
  lookupVendor,
  getCategories,
  renderPackages,
  orderStatusText,
  sendSms,
} from "@/lib/ussd/core";
import { UNAVAILABLE_TEXT, chargeSession } from "@/lib/ussd/billing";

// ---------------------------------------------------------------
// Screens
// ---------------------------------------------------------------
export function menuText(name: string): string {
  return name + "\n1 Buy\n2 Order Status\n3 Help";
}
function servicesText(cats: { label: string }[]): string {
  return (
    "Select service\n" + cats.map((c, i) => i + 1 + " " + c.label).join("\n") + "\n0 Back"
  );
}
const RECIPIENT_TEXT = "Recipient\n1 Myself\n2 Other Number\n0 Back";
const OTHER_TEXT = "Enter recipient number\n(e.g. 0241234567)\n0 Back";
const OTP_TEXT = "Enter the code sent to you by SMS to verify your number:\n0 Cancel";
const UNCERTAIN_TEXT =
  "We could not confirm your payment request. If a prompt appears, approve it. Otherwise check Order Status shortly.";

function promptSentText(orderNumber: string, amount: number): string {
  return (
    "Order " +
    orderNumber +
    ": approve the GHS " +
    amount.toFixed(2) +
    " payment prompt on your phone with your PIN."
  );
}

async function cancelPending(admin: any, orderNumber: string) {
  try {
    await admin
      .from("orders")
      .delete()
      .eq("order_number", orderNumber)
      .eq("status", "pending_payment");
  } catch {
    // nothing more to do
  }
}

// ---------------------------------------------------------------
// Placing the order
// ---------------------------------------------------------------
async function placeOrder(
  admin: any,
  data: any,
  msisdn: string,
  sessionId: string
): Promise<Step> {
  const done = (message: string): Step => ({
    message,
    end: true,
    state: "done",
    data,
  });
  const item: Item = data.item;
  const recipient: string = data.recipient;

  if (!msisdn) return done("We could not read your number. Please try again.");
  const siteUrl = (process.env.SITE_URL || "").replace(/\/+$/, "");
  if (!siteUrl) return done("Service unavailable. Please try again later.");

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("ussd_orders")
    .select("id", { count: "exact", head: true })
    .eq("msisdn", msisdn)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_ORDERS_PER_HOUR) {
    return done("Too many orders. Please try again later.");
  }

  const fields: Record<string, string> = {};
  fields[item.field] = recipient;

  const rpc =
    item.kind === "variant"
      ? await admin.rpc("create_variant_order", {
          p_vendor_id: data.vendorId,
          p_variant_id: item.id,
          p_custom_field_values: fields,
        })
      : await admin.rpc("create_order", {
          p_vendor_id: data.vendorId,
          p_product_id: item.id,
          p_custom_field_values: fields,
        });
  if (rpc.error) {
    console.error("USSD create order failed:", rpc.error.message);
    return done("Sorry, this item is not available right now.");
  }
  const row: any = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  if (!row || !row.order_number) {
    return done("Could not create your order. Please try again.");
  }
  const orderNumber = String(row.order_number);
  const amount = Number(row.unit_price);
  const cleanup = () => cancelPending(admin, orderNumber);

  // The price must still be what the customer confirmed
  if (Math.abs(amount - item.price) >= 0.005) {
    await cleanup();
    return done("The price has changed. Please dial again.");
  }

  await admin.from("ussd_orders").insert({
    order_number: orderNumber,
    msisdn,
    vendor_id: data.vendorId,
    session_id: sessionId,
  });

  // 1) Preferred: a direct Mobile Money prompt on the buyer's phone
  const payer = localPhone(msisdn);
  const channel = payer ? channelForNumber(payer) : null;
  if (payer && channel) {
    const r = await requestMoolrePrompt({
      channel,
      payer,
      amount: amount.toFixed(2),
      externalref: orderNumber,
      sessionid: sessionId,
    });
    if (r.kind === "sent") return done(promptSentText(orderNumber, amount));
    if (r.kind === "otp") {
      return {
        message: OTP_TEXT,
        end: false,
        state: "otp",
        data: {
          ...data,
          pending: { orderNumber, amount, payer, channel },
          last: OTP_TEXT,
        },
      };
    }
    if (r.kind === "uncertain") return done(UNCERTAIN_TEXT);
    console.error("USSD payment prompt refused:", r.message);
    // fall through to the SMS payment link below
  }

  // 2) Fallback: text a payment link
  let payUrl = "";
  try {
    const r = await initiateMoolrePayment({
      reference: orderNumber,
      email: orderNumber.toLowerCase() + "@no-email.maynsalespoint.app",
      amount: amount.toFixed(2),
      callback: siteUrl + "/api/moolre/webhook",
      redirect: siteUrl + "/order-status?number=" + orderNumber,
    });
    payUrl = r.authorizationUrl;
  } catch (e: any) {
    console.error("USSD payment start failed:", e && e.message);
    await cleanup();
    return done("Could not start payment. Please try again later.");
  }

  const sent = await sendSms(
    msisdn,
    "Mayn Sales Point: pay GHS " +
      amount.toFixed(2) +
      " for order " +
      orderNumber +
      " here: " +
      payUrl,
    "ussd-" + orderNumber
  );
  if (!sent) {
    await cleanup();
    return done("Could not send the payment link. Please try again.");
  }

  return done(
    "Order " + orderNumber + " placed. A payment link was sent to you by SMS. Pay to complete."
  );
}

function confirmStep(
  show: (st: string, message: string, d: any) => Step,
  data: any,
  phone: string
): Step {
  const item: Item = data.item;
  const text =
    "Confirm Order\nAmount: " +
    item.price.toFixed(2) +
    " GHS\nRecipient: " +
    phone +
    "\n1 Confirm\n2 Cancel";
  return show("confirm", text, { ...data, recipient: phone });
}

// ---------------------------------------------------------------
// The menu: where the user is + what they pressed = what to show next
// ---------------------------------------------------------------
export async function advance(
  admin: any,
  state: string,
  data: any,
  input: string,
  msisdn: string,
  sessionId: string
): Promise<Step> {
  const show = (st: string, message: string, d: any): Step => ({
    message,
    end: false,
    state: st,
    data: { ...d, last: message },
  });
  const done = (message: string): Step => ({
    message,
    end: true,
    state: "done",
    data,
  });
  const invalid = (extra?: string): Step => ({
    message: (extra || "Invalid choice.") + "\n" + (data.last || ""),
    end: false,
    state,
    data,
  });
  const n = /^[0-9]{1,2}$/.test(input) ? parseInt(input, 10) : -1;

  if (state === "code") {
    const v = await lookupVendor(admin, input);
    if (!v) {
      return {
        message: "Invalid vendor code.\nEnter vendor code:",
        end: false,
        state: "code",
        data,
      };
    }
    // One session is charged to this vendor (once per Uzo session)
    const ok = await chargeSession(admin, v.id, sessionId);
    if (!ok) return done(UNAVAILABLE_TEXT);
    return show("menu", menuText(v.name), { vendorId: v.id, vendorName: v.name });
  }

  if (state === "menu") {
    if (n === 1) {
      const cats = await getCategories(admin);
      if (cats.length === 0) return done("No services available right now.");
      return show("service", servicesText(cats), { ...data, cats });
    }
    if (n === 2) return done(await orderStatusText(admin, msisdn));
    if (n === 3) {
      return done("For help, contact your vendor or visit " + siteShort() + ".");
    }
    return invalid();
  }

  if (state === "service") {
    const cats: any[] = data.cats || [];
    if (n === 0) return show("menu", menuText(data.vendorName), data);
    if (n >= 1 && n <= cats.length) {
      const nd = { ...data, categoryId: cats[n - 1].id };
      const r = await renderPackages(admin, nd, 1);
      if (!r) return invalid("No packages available.");
      return show("package", r.text, {
        ...nd,
        pageItems: r.pageItems,
        page: r.page,
        hasMore: r.hasMore,
      });
    }
    return invalid();
  }

  if (state === "package") {
    const pageItems: Item[] = data.pageItems || [];
    if (n === 0) {
      if (data.hasMore) {
        const r = await renderPackages(admin, data, (data.page || 1) + 1);
        if (r) {
          return show("package", r.text, {
            ...data,
            pageItems: r.pageItems,
            page: r.page,
            hasMore: r.hasMore,
          });
        }
      }
      return show("service", servicesText(data.cats || []), data);
    }
    if (n >= 1 && n <= pageItems.length) {
      return show("recipient", RECIPIENT_TEXT, { ...data, item: pageItems[n - 1] });
    }
    return invalid();
  }

  if (state === "recipient") {
    if (n === 0) {
      const r = await renderPackages(admin, data, data.page || 1);
      if (r) {
        return show("package", r.text, {
          ...data,
          pageItems: r.pageItems,
          page: r.page,
          hasMore: r.hasMore,
        });
      }
      return show("service", servicesText(data.cats || []), data);
    }
    if (n === 1) {
      const phone = localPhone(msisdn);
      if (!phone) return invalid("Could not read your number.");
      return confirmStep(show, data, phone);
    }
    if (n === 2) return show("other", OTHER_TEXT, data);
    return invalid();
  }

  if (state === "other") {
    if (input === "0") return show("recipient", RECIPIENT_TEXT, data);
    const phone = localPhone(input);
    if (!phone) return invalid("Invalid number.");
    return confirmStep(show, data, phone);
  }

  if (state === "confirm") {
    if (n === 2) return done("Order cancelled.");
    if (n === 1) return await placeOrder(admin, data, msisdn, sessionId);
    return invalid();
  }

  if (state === "otp") {
    const pending = data.pending;
    if (!pending) return done("Session expired. Please dial again.");
    if (input === "0") {
      await cancelPending(admin, String(pending.orderNumber));
      return done("Order cancelled.");
    }
    if (!/^[0-9]{3,8}$/.test(input)) return invalid("Enter the code from the SMS.");
    const r = await requestMoolrePrompt({
      channel: String(pending.channel),
      payer: String(pending.payer),
      amount: Number(pending.amount).toFixed(2),
      externalref: String(pending.orderNumber),
      otpcode: input,
      sessionid: sessionId,
    });
    if (r.kind === "sent") {
      return done(promptSentText(String(pending.orderNumber), Number(pending.amount)));
    }
    if (r.kind === "otp") return invalid("Wrong code. Try again.");
    if (r.kind === "uncertain") return done(UNCERTAIN_TEXT);
    console.error("USSD OTP step refused:", r.message);
    await cancelPending(admin, String(pending.orderNumber));
    return done("Could not send the payment request. Please try again later.");
  }

  // Unknown state: start again
  const text = "Mayn Sales Point\nEnter vendor code:";
  return { message: text, end: false, state: "code", data: { last: text } };
}

// END OF FILE
