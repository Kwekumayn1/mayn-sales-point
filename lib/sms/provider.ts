// SMS sending. Which provider goes first is chosen by the admin
// (table sms_settings, edited on the SMS provider admin page).

import { createAdminClient } from "@/lib/supabase/admin";

const MOOLRE_URL = "https://api.moolre.com/open/sms/send";
const MAYNDATA_URL = "https://src-sms.muviin.co/api/v1/sms/send";

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

type Mode = "moolre_first" | "mayndata_first" | "moolre_only" | "mayndata_only";

export type SmsItem = { recipient: string; ref: string }; // recipient: 233XXXXXXXXX
export type BatchResult =
  | {
      ok: true;
      provider: "moolre" | "mayndata";
      sent: number;
      unitsUsed: number;
      invalid: { ref: string; reason: string }[];
    }
  | { ok: false; error: string };
type OkResult = Extract<BatchResult, { ok: true }>;

type MoolreAttempt =
  | { kind: "ok" }
  | { kind: "failed"; error: string }
  | { kind: "uncertain" };
type MaynAttempt =
  | { kind: "ok"; result: OkResult }
  | { kind: "failed"; error: string }
  | { kind: "uncertain" };

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------
// The admin's choice (cached for 30 seconds)
// ---------------------------------------------------------------
let cached: { mode: Mode; at: number } | null = null;

async function getMode(): Promise<Mode> {
  if (cached && Date.now() - cached.at < 30000) return cached.mode;
  let mode: Mode = "moolre_first";
  try {
    const admin: any = createAdminClient();
    const { data } = await admin
      .from("sms_settings")
      .select("provider_mode")
      .eq("id", 1)
      .maybeSingle();
    const m = data && data.provider_mode;
    if (
      m === "moolre_first" ||
      m === "mayndata_first" ||
      m === "moolre_only" ||
      m === "mayndata_only"
    ) {
      mode = m;
    }
  } catch {
    // keep the default
  }
  cached = { mode, at: Date.now() };
  return mode;
}

function toLocal(recipient: string): string {
  const d = String(recipient || "").replace(/\D/g, "");
  if (d.indexOf("233") === 0 && d.length === 12) return "0" + d.slice(3);
  return d;
}

// Moolre is used only for plain (GSM) messages up to 160 characters
function moolreSuitable(message: string): boolean {
  if (!process.env.MOOLRE_VAS_KEY || !process.env.MOOLRE_SMS_SENDER) return false;
  if (message.length === 0 || message.length > 160) return false;
  for (let i = 0; i < message.length; i++) {
    if (GSM7_BASIC.indexOf(message.charAt(i)) === -1) return false;
  }
  return true;
}

// ---------------------------------------------------------------
// Moolre
// ---------------------------------------------------------------
async function sendViaMoolre(items: SmsItem[], message: string): Promise<MoolreAttempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let text = "";
  let status = 0;
  try {
    const res = await fetch(MOOLRE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-VASKEY": process.env.MOOLRE_VAS_KEY as string,
      },
      body: JSON.stringify({
        type: 1,
        senderid: process.env.MOOLRE_SMS_SENDER,
        messages: items.map((i) => ({
          recipient: toLocal(i.recipient),
          message,
        })),
      }),
      signal: controller.signal,
    });
    status = res.status;
    text = await res.text();
  } catch {
    // Timed out or dropped: we cannot know whether it was sent
    return { kind: "uncertain" };
  } finally {
    clearTimeout(timer);
  }

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!json) return { kind: "uncertain" };
  if (String(json.status) === "1") return { kind: "ok" };

  const msg = Array.isArray(json.message)
    ? json.message.join(" ")
    : String(json.message ?? "");
  return { kind: "failed", error: String(json.code ?? status) + " " + msg };
}

// ---------------------------------------------------------------
// MaynData
// ---------------------------------------------------------------
async function postMayndata(
  apiKey: string,
  payload: unknown
): Promise<
  { ok: true; data: any } | { ok: false; error: string; gotReply: boolean }
> {
  let lastError = "Network error";
  let gotReply = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(MAYNDATA_URL, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      gotReply = true;
      const json: any = await res.json().catch(() => null);
      if (res.ok && json && json.status === "success") {
        return { ok: true, data: json.data };
      }
      lastError = json?.data?.error ?? json?.message ?? "HTTP " + res.status;
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      return { ok: false, error: lastError, gotReply };
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  return { ok: false, error: lastError, gotReply };
}

async function sendViaMayndata(
  items: SmsItem[],
  message: string,
  parts: number
): Promise<MaynAttempt> {
  const apiKey = process.env.MAYNDATA_API_KEY;
  const senderId = process.env.MAYNDATA_SENDER_ID || "MaynBrand";
  if (!apiKey) return { kind: "failed", error: "MaynData is not set up." };

  const result = await postMayndata(apiKey, {
    senderid: senderId,
    messages: items.map((i) => ({
      recipient: i.recipient,
      message,
      ref: i.ref,
    })),
  });
  if (!result.ok) {
    return result.gotReply
      ? { kind: "failed", error: result.error }
      : { kind: "uncertain" };
  }

  const d = result.data ?? {};
  const accepted = Number(d.accepted ?? 0);
  const duplicates = Number(d.duplicates ?? 0);
  const invalid: { ref: string; reason: string }[] = [];
  for (const item of d.invalidMessages ?? []) {
    if (item && item.ref) {
      invalid.push({
        ref: String(item.ref),
        reason: String(item.reason ?? "Invalid number"),
      });
    }
  }
  return {
    kind: "ok",
    result: {
      ok: true,
      provider: "mayndata",
      sent: accepted + duplicates,
      unitsUsed: Number(d.creditsRequired ?? 0) + duplicates * parts,
      invalid,
    },
  };
}

// ---------------------------------------------------------------
// Sending one batch, in the order the admin chose
// ---------------------------------------------------------------
export async function sendBatch(
  items: SmsItem[],
  message: string,
  parts: number
): Promise<BatchResult> {
  const mode = await getMode();
  const order: ("moolre" | "mayndata")[] =
    mode === "mayndata_first"
      ? ["mayndata", "moolre"]
      : mode === "moolre_only"
        ? ["moolre"]
        : mode === "mayndata_only"
          ? ["mayndata"]
          : ["moolre", "mayndata"];

  let lastError = "No SMS provider is available.";
  for (const p of order) {
    if (p === "moolre") {
      if (!moolreSuitable(message)) {
        lastError = "This message cannot be sent through Moolre.";
        continue;
      }
      const a = await sendViaMoolre(items, message);
      if (a.kind === "ok") {
        return {
          ok: true,
          provider: "moolre",
          sent: items.length,
          unitsUsed: items.length * parts,
          invalid: [],
        };
      }
      if (a.kind === "uncertain") {
        return { ok: false, error: "Delivery could not be confirmed." };
      }
      lastError = a.error;
      console.error("Moolre SMS refused:", a.error);
      continue;
    }

    const a = await sendViaMayndata(items, message, parts);
    if (a.kind === "ok") return a.result;
    if (a.kind === "uncertain") {
      return { ok: false, error: "Delivery could not be confirmed." };
    }
    lastError = a.error;
    console.error("MaynData SMS refused:", a.error);
  }
  return { ok: false, error: lastError };
}

// One message, used for payment links
export async function sendSms(
  phone: string,
  message: string,
  ref: string
): Promise<boolean> {
  const r = await sendBatch([{ recipient: phone, ref }], message, 1);
  return r.ok && r.sent > 0;
}

// END OF FILE
