const BASE = "https://backend.justicedatashop.com";

async function call(method: "GET" | "POST", path: string, body?: any): Promise<any> {
  const key = process.env.JUSTICE_API_KEY || "";
  if (!key) {
    return { kind: "nokey", message: "JUSTICE_API_KEY is not set on the server." };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(BASE + path, {
      method: method,
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { kind: "http", httpStatus: res.status, json: json, text: text };
  } catch (e: any) {
    const msg = e && e.name === "AbortError" ? "Justice took too long to answer." : "Could not reach Justice.";
    return { kind: "network", message: msg };
  } finally {
    clearTimeout(timer);
  }
}

// ---- small helpers ----

export function normalizePhone(raw: any): string {
  let d = String(raw === undefined || raw === null ? "" : raw).replace(/\D/g, "");
  if (d.startsWith("233") && d.length === 12) d = "0" + d.slice(3);
  if (d.length === 9) d = "0" + d;
  return /^0\d{9}$/.test(d) ? d : "";
}

export function parseSizeGb(name: any): number | null {
  const m = String(name || "").match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

export function networkOf(productName: any): string {
  const p = String(productName || "").toLowerCase();
  if (p.includes("mtn")) return "MTN";
  return "";
}

export function beneficiaryOf(values: any): string {
  if (!values || typeof values !== "object") return "";
  const keys = Object.keys(values);
  // 1) A field whose label looks like a phone/beneficiary field.
  for (const k of keys) {
    if (/benef|recipient|phone|number/i.test(k) && normalizePhone(values[k])) {
      return String(values[k]);
    }
  }
  // 2) Wallet orders save values by field id, not by label:
  //    use the first value that is a valid phone number.
  for (const k of keys) {
    if (normalizePhone(values[k])) return String(values[k]);
  }
  return "";
}

export function mapStatus(s: any): "completed" | "failed" | "pending" {
  const u = String(s || "").toUpperCase();
  if (["COMPLETED", "SUCCESS", "SUCCESSFUL", "DELIVERED", "DONE"].includes(u)) return "completed";
  if (["FAILED", "FAIL", "CANCELLED", "CANCELED", "REJECTED", "REFUNDED", "ERROR"].includes(u)) return "failed";
  return "pending";
}

// ---- API calls ----

// outcome: "sent" (Justice accepted it), "rejected" (clearly NOT sent), "unknown" (cannot tell)
export async function justicePlaceOrder(p: { phone: string; size: number; network: string; callback?: string }) {
  const body: any = { phone: p.phone, size: p.size, network: p.network };
  if (p.callback) body.callback = p.callback;
  const r = await call("POST", "/api/order", body);

  if (r.kind === "nokey") return { outcome: "rejected", message: r.message };
  if (r.kind === "network") return { outcome: "unknown", message: r.message };

  const j = r.json;
  if (j && j.status === true && j.payload && j.payload.id) {
    return {
      outcome: "sent",
      id: String(j.payload.id),
      status: String(j.payload.status || "PENDING"),
      message: String(j.message || "Order created"),
    };
  }
  if (j && (j.status === false || (r.httpStatus >= 400 && r.httpStatus < 500))) {
    return { outcome: "rejected", message: String((j && j.message) || "Justice rejected the order (HTTP " + r.httpStatus + ").") };
  }
  return { outcome: "unknown", message: "Unclear answer from Justice (HTTP " + r.httpStatus + ")." };
}

export async function justiceGetOrder(id: string) {
  const r = await call("GET", "/api/order/" + encodeURIComponent(id));
  if (r.kind !== "http") return { ok: false, message: r.message };
  const j = r.json;
  if (j && j.status === true && j.payload) {
    return { ok: true, status: String(j.payload.status || ""), message: String(j.message || "") };
  }
  return { ok: false, message: String((j && j.message) || "Could not read the order from Justice (HTTP " + r.httpStatus + ").") };
}

export async function justiceBalance() {
  const r = await call("GET", "/api/balance");
  if (r.kind !== "http") return { ok: false, message: r.message };
  const j = r.json;
  if (j && j.status === true && j.payload !== undefined) {
    return { ok: true, cedis: Number(j.payload) / 100 };
  }
  return { ok: false, message: String((j && j.message) || "Could not read the Justice balance.") };
}

// END OF FILE
