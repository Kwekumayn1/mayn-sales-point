// USSD session billing and the vendor key from the dialled code.

export const UNAVAILABLE_TEXT =
  "This vendor's USSD service is unavailable right now. Please try again later.";

const DEFAULT_BASE_CODE = "*426*240#";

function groupsOf(code: string): string[] {
  return String(code || "")
    .replace(/^\*/, "")
    .replace(/#$/, "")
    .split("*")
    .filter((g) => g !== "");
}

// Your own code (*426*240#) is the base. Only something extra after it,
// like *426*240*116#, is read as a vendor key. The base code on its own
// is never mistaken for a vendor.
export function extractVendorKey(body: any): string {
  const base = groupsOf(process.env.USSD_BASE_CODE || DEFAULT_BASE_CODE);
  const candidates = [String(body?.ussdString ?? ""), String(body?.code ?? "")];
  for (const c of candidates) {
    const s = c.trim();
    if (!/^\*[0-9*]+#$/.test(s)) continue;
    const g = groupsOf(s);
    if (g.length !== base.length + 1) continue;
    let same = true;
    for (let i = 0; i < base.length; i++) {
      if (g[i] !== base[i]) same = false;
    }
    const key = g[base.length];
    if (same && /^[0-9]{1,8}$/.test(key)) return key;
  }
  return "";
}

// Charges one session to the vendor (once per Uzo session ID).
// Returns false only when the vendor has no sessions left.
// If anything goes wrong with billing, customers are NOT blocked.
export async function chargeSession(
  admin: any,
  vendorId: string,
  sessionId: string
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("ussd_charge_session", {
      p_vendor: vendorId,
      p_session: sessionId,
    });
    if (error) {
      console.error("USSD charge error:", error.message);
      return true;
    }
    return data === true;
  } catch (e: any) {
    console.error("USSD charge crashed:", e && e.message);
    return true;
  }
}

// END OF FILE
