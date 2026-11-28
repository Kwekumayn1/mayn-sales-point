import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendBatch } from "@/lib/sms/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 500;

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "^{}\\[~]|€\f";

function countParts(text: string): number {
  let gsmLength = 0;
  let isGsm = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (GSM7_BASIC.indexOf(ch) !== -1) gsmLength += 1;
    else if (GSM7_EXTENDED.indexOf(ch) !== -1) gsmLength += 2;
    else {
      isGsm = false;
      break;
    }
  }
  if (isGsm) return gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
  return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
}

function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createAdminClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

// This vendor's own store link (empty when they have not set one)
async function getVendorLink(admin: any, vendorId: string): Promise<string> {
  const siteRaw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  const site = siteRaw.replace(/\/+$/, "");
  if (!site) return "";
  const { data: store } = await admin
    .from("storefronts")
    .select("storefront_slug")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  const slug =
    store && store.storefront_slug ? String(store.storefront_slug).trim() : "";
  return slug ? site + "/s/" + slug : "";
}

function fillTemplate(body: string, link: string): string {
  return body.split("{{link}}").join(link).replace(/\s+$/, "");
}

async function isBlocked(admin: any, vendorId: string): Promise<boolean> {
  const { data } = await admin
    .from("sms_blocked_vendors")
    .select("vendor_id")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  return !!data;
}

// The list of approved templates, with this vendor's link filled in
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "SMS is not set up yet. Contact the admin." });
  }
  if (await isBlocked(admin, user.id)) {
    return NextResponse.json({
      ok: false,
      error: "SMS is switched off for your account. Contact the admin.",
    });
  }

  const link = await getVendorLink(admin, user.id);
  const { data: rows } = await admin
    .from("sms_templates")
    .select("id, title, body")
    .eq("active", true)
    .order("created_at", { ascending: true });

  const templates: { id: string; title: string; preview: string; parts: number }[] = [];
  let skippedForLink = false;
  for (const t of rows ?? []) {
    const body = String(t.body);
    if (body.indexOf("{{link}}") !== -1 && !link) {
      skippedForLink = true;
      continue;
    }
    const message = fillTemplate(body, link);
    const parts = countParts(message);
    if (message.length === 0 || parts > 10) continue;
    templates.push({ id: String(t.id), title: String(t.title), preview: message, parts });
  }

  if (templates.length === 0) {
    return NextResponse.json({
      ok: false,
      error: skippedForLink
        ? "Set your store link name first (menu, My Storefront), then come back."
        : "No message templates are available right now. Check again later.",
    });
  }
  return NextResponse.json({ ok: true, templates });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const hasMoolre = !!(process.env.MOOLRE_VAS_KEY && process.env.MOOLRE_SMS_SENDER);
  const hasMayn = !!process.env.MAYNDATA_API_KEY;
  const admin = getAdmin();
  if (!admin || (!hasMoolre && !hasMayn)) {
    return NextResponse.json(
      { error: "SMS is not set up yet. Contact the admin." },
      { status: 500 }
    );
  }

  if (await isBlocked(admin, user.id)) {
    return NextResponse.json(
      { error: "SMS is switched off for your account. Contact the admin." },
      { status: 403 }
    );
  }

  // Only the template id comes from the browser. The text is built here.
  let templateId = "";
  try {
    const body: any = await request.json();
    templateId = typeof body?.templateId === "string" ? body.templateId : "";
  } catch {
    templateId = "";
  }
  if (!templateId) {
    return NextResponse.json({ error: "Choose a message first." }, { status: 400 });
  }

  const { data: tpl } = await admin
    .from("sms_templates")
    .select("body")
    .eq("id", templateId)
    .eq("active", true)
    .maybeSingle();
  if (!tpl || !tpl.body) {
    return NextResponse.json(
      { error: "That message is no longer available. Reload the page and choose again." },
      { status: 400 }
    );
  }

  const link = await getVendorLink(admin, user.id);
  const rawBody = String(tpl.body);
  if (rawBody.indexOf("{{link}}") !== -1 && !link) {
    return NextResponse.json(
      { error: "Set your store link name first (menu, My Storefront), then come back." },
      { status: 400 }
    );
  }
  const message = fillTemplate(rawBody, link);
  const parts = countParts(message);
  if (message.length === 0 || parts > 10) {
    return NextResponse.json(
      { error: "This message cannot be sent. Contact the admin." },
      { status: 400 }
    );
  }

  const phones: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("vendor_contacts")
      .select("phone")
      .eq("vendor_id", user.id)
      .order("id")
      .range(from, from + 999);
    if (error) {
      return NextResponse.json({ error: "Could not load your contacts." }, { status: 500 });
    }
    const list = data ?? [];
    for (const c of list) phones.push(c.phone as string);
    if (list.length < 1000) break;
  }
  if (phones.length === 0) {
    return NextResponse.json({ error: "You have no contacts yet." }, { status: 400 });
  }

  const units = parts * phones.length;
  const { data: reserved, error: reserveError } = await admin.rpc("sms_reserve", {
    p_vendor: user.id,
    p_message: message,
    p_phones: phones,
    p_units: units,
  });
  if (reserveError || !reserved) {
    const text = reserveError?.message ?? "";
    const friendly =
      text.indexOf("Not enough SMS units") !== -1
        ? "Not enough SMS units. You need " + units + " units for this message."
        : "Could not start the campaign. Try again.";
    return NextResponse.json({ error: friendly, needed: units }, { status: 400 });
  }
  const campaignId = String(reserved);

  let unitsUsed = 0;
  let sent = 0;
  let invalid = 0;
  let failed = 0;
  const failedRefs: string[] = [];
  const invalidRows: { ref: string; reason: string }[] = [];
  const providers = new Set<string>();

  for (let start = 0; start < phones.length; start += BATCH_SIZE) {
    const slice = phones.slice(start, start + BATCH_SIZE);
    const items = slice.map((phone, j) => ({
      recipient: phone,
      ref: campaignId + ":" + (start + j + 1),
    }));
    const result = await sendBatch(items, message, parts);
    if (!result.ok) {
      console.error("SMS batch failed:", result.error);
      failed += slice.length;
      for (const it of items) failedRefs.push(it.ref);
      continue;
    }
    providers.add(result.provider);
    unitsUsed += result.unitsUsed;
    sent += result.sent;
    invalid += result.invalid.length;
    for (const row of result.invalid) invalidRows.push(row);
  }

  for (let i = 0; i < failedRefs.length; i += 100) {
    await admin
      .from("sms_messages")
      .update({ status: "failed", error: "Not sent" })
      .in("ref", failedRefs.slice(i, i + 100));
  }
  for (const row of invalidRows) {
    await admin
      .from("sms_messages")
      .update({ status: "invalid", error: row.reason })
      .eq("ref", row.ref);
  }
  await admin
    .from("sms_messages")
    .update({ status: "submitted" })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const finalStatus = sent === 0 ? "failed" : failed > 0 ? "partial" : "completed";
  await admin.rpc("sms_finalize", {
    p_campaign: campaignId,
    p_units_used: unitsUsed,
    p_status: finalStatus,
  });

  const provider =
    providers.size === 0
      ? null
      : providers.size === 1
        ? Array.from(providers)[0]
        : "mixed";
  if (provider) {
    await admin.from("sms_campaigns").update({ provider }).eq("id", campaignId);
  }

  if (sent === 0) {
    return NextResponse.json(
      {
        error:
          "SMS could not be sent right now. Your units were refunded. Try again shortly.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    campaignId,
    recipients: phones.length,
    sent,
    invalid,
    failed,
    unitsCharged: unitsUsed,
  });
}

// END OF FILE
