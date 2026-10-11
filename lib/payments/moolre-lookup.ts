// Read-only lookup of a payment on Moolre, used by the admin
// "Check payments" tool. Uses the same environment settings as
// lib/payments/moolre.ts. It never changes anything by itself.

const SUCCESS_WORDS = ["success", "successful", "1", "paid"];

export async function lookupMoolre(reference: string) {
  const production = process.env.MOOLRE_PRODUCTION === "true";
  const url = production
    ? "https://api.moolre.com/open/transact/status"
    : "https://sandbox.moolre.com/open/transact/status";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.MOOLRE_API_USER) headers["X-API-USER"] = process.env.MOOLRE_API_USER;
  if (process.env.MOOLRE_PUBLIC_KEY) headers["X-API-PUBKEY"] = process.env.MOOLRE_PUBLIC_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: 1,
        idtype: "1",
        id: reference,
        accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
      }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    const why = e && e.name === "AbortError" ? "Moolre took too long to answer." : String((e && e.message) || e);
    return { ok: false, error: "Could not reach Moolre: " + why };
  }
  clearTimeout(timer);

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!json) {
    return { ok: false, error: "Moolre sent an unreadable answer (HTTP " + res.status + ")." };
  }

  const d: any = json.data || {};
  const message = Array.isArray(json.message) ? json.message[0] : json.message;
  const hasTx = d.txstatus !== undefined && d.txstatus !== null;
  return {
    ok: true,
    found: hasTx,
    code: json.code ? String(json.code) : "",
    message: message ? String(message) : "",
    txstatus: hasTx ? String(d.txstatus).toLowerCase() : "",
    amount: d.amount !== undefined ? String(d.amount) : "",
    payer: d.payer ? String(d.payer) : "",
    thirdpartyref: d.thirdpartyref ? String(d.thirdpartyref) : "",
    ts: d.ts ? String(d.ts) : "",
  };
}

// Turns Moolre's answer plus our order price into a plain verdict.
export function judge(look: any, unitPrice: any) {
  if (!look || !look.ok) {
    return { code: "error", text: (look && look.error) || "The check failed." };
  }
  if (!look.found) {
    return {
      code: "not_found",
      text: "Moolre has no record of a payment under this order number." + (look.message ? " (" + look.message + ")" : ""),
    };
  }
  if (SUCCESS_WORDS.indexOf(look.txstatus) < 0) {
    return {
      code: "not_paid",
      text: "Moolre does not show this payment as successful (its status: " + look.txstatus + ")." + (look.message ? " " + look.message : ""),
    };
  }
  const diff = Math.abs(Number(look.amount) - Number(unitPrice));
  if (!(diff < 0.01)) {
    return {
      code: "paid_mismatch",
      text: "Moolre shows a successful payment of " + look.amount + ", but the order price is " + Number(unitPrice).toFixed(2) + ".",
    };
  }
  return { code: "paid_ok", text: "Paid on Moolre. The amount matches the order." };
}

// END OF FILE
