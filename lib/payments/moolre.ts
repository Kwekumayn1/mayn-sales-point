// Moolre payment provider adapter.
//
// This is the one file that knows Moolre's specific request/response
// shape. If the platform ever switches or adds another Ghana payment
// provider, only this file (and its env vars) needs to change — the
// rest of the app just calls initiateMoolrePayment/verifyMoolrePayment.

type InitiateParams = {
  reference: string;
  email: string;
  amount: string; // e.g. "120.00"
  callback: string;
  redirect: string;
};

function isProduction() {
  return process.env.MOOLRE_PRODUCTION === "true";
}

function startUrl() {
  return isProduction()
    ? "https://api.moolre.com/embed/src/start"
    : "https://sandbox.moolre.com/embed/src/start";
}

function statusUrl() {
  return isProduction()
    ? "https://api.moolre.com/open/transact/status"
    : "https://sandbox.moolre.com/open/transact/status";
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.MOOLRE_API_USER) headers["X-API-USER"] = process.env.MOOLRE_API_USER;
  if (process.env.MOOLRE_PUBLIC_KEY) headers["X-API-PUBKEY"] = process.env.MOOLRE_PUBLIC_KEY;
  return headers;
}

// Fetch with a hard timeout, and always return the raw text alongside
// whatever we could parse — so a wrong endpoint, auth failure, or
// non-JSON response is visible instead of causing a silent crash.
async function safeFetch(url: string, body: object) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeout);
    throw new Error(
      `Could not reach Moolre at ${url}: ${e?.name === "AbortError" ? "request timed out after 8s" : e?.message || String(e)}`
    );
  }
  clearTimeout(timeout);

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Moolre returned something that isn't JSON at all.
  }

  if (!json) {
    throw new Error(
      `Moolre returned a non-JSON response (status ${res.status}) from ${url}: ${text.slice(0, 300)}`
    );
  }

  return { status: res.status, json };
}

export async function initiateMoolrePayment(params: InitiateParams) {
  const body = {
    state: "starter",
    accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
    reference: params.reference,
    email: params.email,
    amount: params.amount,
    currency: "GHS",
    callback: params.callback,
    redirect: params.redirect,
    expiration_time: 30,
  };

  const { status, json } = await safeFetch(startUrl(), body);
  const authorizationUrl = json?.data?.authorization_url;

  if (!authorizationUrl) {
    const message = Array.isArray(json?.message) ? json.message[0] : json?.message;
    throw new Error(
      message
        ? `Moolre (status ${status}): ${message}`
        : `Moolre (status ${status}) did not return a payment link: ${JSON.stringify(json).slice(0, 300)}`
    );
  }

  return { authorizationUrl: authorizationUrl as string };
}

export async function verifyMoolrePayment(reference: string) {
  const { json } = await safeFetch(statusUrl(), {
    type: 1,
    idtype: "1",
    id: reference,
    accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
  });

  const result = json?.data ?? {};

  return {
    status: String(result.txstatus ?? "").toLowerCase(),
    externalRef: result.externalref as string | undefined,
    amount: result.amount as string | undefined,
    accountNumber: result.accountnumber as string | undefined,
  };
    }
