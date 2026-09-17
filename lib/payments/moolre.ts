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

  const res = await fetch(startUrl(), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const authorizationUrl = data?.data?.authorization_url;

  if (!authorizationUrl) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new Error(message || "Could not start payment with Moolre.");
  }

  return { authorizationUrl };
}

export async function verifyMoolrePayment(reference: string) {
  const res = await fetch(statusUrl(), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      type: 1,
      idtype: "1",
      id: reference,
      accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
    }),
  });

  const data = await res.json();
  const result = data?.data ?? {};

  return {
    status: String(result.txstatus ?? "").toLowerCase(),
    externalRef: result.externalref as string | undefined,
    amount: result.amount as string | undefined,
    accountNumber: result.accountnumber as string | undefined,
  };
      }
