import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_URL = "https://src-sms.muviin.co/api/v1/sms/send";
const BATCH_SIZE = 5000;

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "^{}\\[~]|€\f";

// How many SMS parts one message costs
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

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type SendResult =
  | { ok: true; data: any }
  | { ok: false; error: string };

async function postWithRetry(
  apiKey: string,
  payload: unknown
): Promise<SendResult> {
  let lastError = "Network error";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json: any = await res.json().catch(() => null);
      if (res.ok && json && json.status === "success") {
        return { ok: true, data: json.data };
      }
      lastError = json?.data?.error ?? json?.message ?? "HTTP " + res.status;
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      return { ok: false, error: lastError };
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  return { ok: false, error: lastError };
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 }
    );
  }

  let body: { message?: unknown } = {};
  try {
    body = (await request.json()) as { message?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message =
    typeof body.message === "string" ? body.message.replace(/\s+$/, "") : "";
  if (message.length === 0) {
    return NextResponse.json(
      { error: "Write a message first." },
      { status: 400 }
    );
  }
  const parts = countParts(message);
  if (parts > 10) {
    return NextResponse.json(
      { error: "Message is too long. Keep it under 10 SMS parts." },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.MAYNDATA_API_KEY;
  const senderId = process.env.MAYNDATA_SENDER_ID || "MaynBrand";
  if (!url || !serviceKey || !apiKey) {
    return NextResponse.json(
      { error: "SMS is not set up yet. Contact the admin." },
      { status: 500 }
    );
  }
  const admin = createAdminClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: blocked } = await admin
    .from("sms_blocked_vendors")
    .select("vendor_id")
    .eq("vendor_id", user.id)
    .maybeSingle();
  if (blocked) {
    return NextResponse.json(
      { error: "SMS is switched off for your account. Contact the admin." },
      { status: 403 }
    );
  }

  // Load all of this vendor's contacts
  const phones: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("vendor_contacts")
      .select("phone")
      .eq("vendor_id", user.id)
      .order("id")
      .range(from, from + 999);
    if (error) {
      return NextResponse.json(
        { error: "Could not load your contacts." },
        { status: 500 }
      );
    }
    const list = data ?? [];
    for (const c of list) phones.push(c.phone as string);
    if (list.length < 1000) break;
  }
  if (phones.length === 0) {
    return NextResponse.json(
      { error: "You have no contacts yet." },
      { status: 400 }
    );
  }

  // Reserve the units first (takes them from the vendor's balance)
  const units = parts * phones.length;
  const { data: reserved, error: reserveError } = await admin.rpc(
    "sms_reserve",
    {
      p_vendor: user.id,
      p_message: message,
      p_phones: phones,
      p_units: units,
    }
  );
  if (reserveError || !reserved) {
    const text = reserveError?.message ?? "";
    const friendly = text.indexOf("Not enough SMS units") !== -1
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

  for (let start = 0; start < phones.length; start += BATCH_SIZE) {
    const slice = phones.slice(start, start + BATCH_SIZE);
    const payload = {
      senderid: senderId,
      messages: slice.map((phone, j) => ({
        recipient: phone,
        message,
        ref: campaignId + ":" + (start + j + 1),
      })),
    };
    const result = await postWithRetry(apiKey, payload);
    if (!result.ok) {
      console.error("MaynData send failed:", result.error);
      failed += slice.length;
      for (let j = 0; j < slice.length; j++) {
        failedRefs.push(campaignId + ":" + (start + j + 1));
      }
      continue;
    }
    const d = result.data ?? {};
    const accepted = Number(d.accepted ?? 0);
    const duplicates = Number(d.duplicates ?? 0);
    // Duplicates were already sent (and charged) by an earlier try
    unitsUsed += Number(d.creditsRequired ?? 0) + duplicates * parts;
    sent += accepted + duplicates;
    invalid += Number(d.invalid ?? 0);
    for (const item of d.invalidMessages ?? []) {
      if (item && item.ref) {
        invalidRows.push({
          ref: String(item.ref),
          reason: String(item.reason ?? "Invalid number"),
        });
      }
    }
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

  // Refund every unit that was not actually used
  const finalStatus =
    sent === 0 ? "failed" : failed > 0 ? "partial" : "completed";
  await admin.rpc("sms_finalize", {
    p_campaign: campaignId,
    p_units_used: unitsUsed,
    p_status: finalStatus,
  });

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
