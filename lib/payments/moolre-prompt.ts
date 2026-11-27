// Direct Mobile Money prompt (Moolre "Mobile Money Collection API").
// This call moves money, so it is NEVER retried automatically.

export type PromptResult =
  | { kind: "sent" }
  | { kind: "otp" }
  | { kind: "uncertain" }
  | { kind: "error"; message: string };

function paymentUrl(): string {
  return process.env.MOOLRE_PRODUCTION === "true"
    ? "https://api.moolre.com/open/transact/payment"
    : "https://sandbox.moolre.com/open/transact/payment";
}

// Moolre channel codes: 13 = MTN, 6 = Telecel, 7 = AT
export function channelForNumber(local: string): string | null {
  const p = String(local || "").slice(0, 3);
  if (["024", "025", "053", "054", "055", "059"].indexOf(p) !== -1) return "13";
  if (["020", "050"].indexOf(p) !== -1) return "6";
  if (["026", "027", "056", "057"].indexOf(p) !== -1) return "7";
  return null;
}

export async function requestMoolrePrompt(params: {
  channel: string;
  payer: string; // 0XXXXXXXXX
  amount: string; // e.g. "5.99"
  externalref: string; // must be unique
  otpcode?: string;
  sessionid?: string; // Uzo USSD session ID, sent only when the switch is on
}): Promise<PromptResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.MOOLRE_API_USER) headers["X-API-USER"] = process.env.MOOLRE_API_USER;
  if (process.env.MOOLRE_PUBLIC_KEY) headers["X-API-PUBKEY"] = process.env.MOOLRE_PUBLIC_KEY;

  const body: Record<string, any> = {
    type: 1,
    channel: params.channel,
    currency: "GHS",
    payer: params.payer,
    amount: params.amount,
    externalref: params.externalref,
    accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
  };
  if (params.otpcode) body.otpcode = params.otpcode;

  // The switch: only when MOOLRE_SEND_SESSIONID is exactly "true"
  const sendSession =
    process.env.MOOLRE_SEND_SESSIONID === "true" && !!params.sessionid;
  if (sendSession) body.sessionid = params.sessionid;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let text = "";
  let httpStatus = 0;
  try {
    const res = await fetch(paymentUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    httpStatus = res.status;
    text = await res.text();
  } catch {
    // Timed out or dropped: we cannot know whether the prompt went out
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
  if (!json) {
    return { kind: "error", message: "Non-JSON reply (status " + httpStatus + ")" };
  }

  const message = Array.isArray(json.message)
    ? json.message.join(" ")
    : String(json.message ?? "");

  // "Please complete the verification process sent to you via SMS"
  if (/verif|otp/i.test(message)) {
    console.log("Moolre prompt: code requested", { sessionidSent: sendSession });
    return { kind: "otp" };
  }
  if (String(json.status) === "1") {
    console.log("Moolre prompt: sent", {
      sessionidSent: sendSession,
      withCode: !!params.otpcode,
    });
    return { kind: "sent" };
  }
  console.log("Moolre prompt: refused", { sessionidSent: sendSession, message });
  return { kind: "error", message: message || "Request refused (status " + httpStatus + ")" };
}

// END OF FILE
